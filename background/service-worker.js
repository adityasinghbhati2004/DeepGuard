/**
 * Trustlens — Background Service Worker (Manifest V3)
 *
 * Responsibilities:
 *  - Manage extension lifecycle and session state
 *  - Route messages between popup, content scripts, and offscreen document
 *  - Coordinate AI inference via offscreen document
 *  - Manage detection history in chrome.storage
 *  - Send notifications on high-risk detections
 *  - Maintain icon badge with current risk level
 */

import './utils-sw.js';

// ── Session state (in-memory, rebuilt on SW wake) ──────────────
let state = {
  status:          DEEPGUARD.STATE.IDLE,
  platform:        null,
  tabId:           null,
  sessionStart:    null,
  framesAnalysed:  0,
  currentRisk:     DEEPGUARD.RISK.UNAVAILABLE,
  currentScore:    0,
  lastAlertAt:     0,
  modelReady:      false,
  offscreenReady:  false,
  paused:          false,
};

// ── Offscreen document management ─────────────────────────────
async function ensureOffscreen() {
  const existing = await chrome.offscreen.hasDocument();
  if (!existing) {
    await chrome.offscreen.createDocument({
      url:    DEEPGUARD.OFFSCREEN_URL,
      reasons: ['BLOBS'],
      justification: 'Run ONNX inference for deepfake detection off the main thread',
    });
    swLog('Offscreen document created');
  }
}

async function closeOffscreen() {
  try {
    if (await chrome.offscreen.hasDocument()) {
      await chrome.offscreen.closeDocument();
      state.offscreenReady = false;
      swLog('Offscreen document closed');
    }
  } catch (e) { /* already closed */ }
}

// ── Logging helper ─────────────────────────────────────────────
function swLog(...args) {
  console.log('[Trustlens SW]', ...args);
}
function swWarn(...args) {
  console.warn('[Trustlens SW]', ...args);
}
function swError(...args) {
  console.error('[Trustlens SW]', ...args);
}

// ── Badge helpers ──────────────────────────────────────────────
const BADGE_CONFIG = {
  [DEEPGUARD.RISK.LOW]:         { text: 'LOW',  color: '#22d3ee' },
  [DEEPGUARD.RISK.ELEVATED]:    { text: 'MED',  color: '#f59e0b' },
  [DEEPGUARD.RISK.HIGH]:        { text: 'HIGH', color: '#ef4444' },
  [DEEPGUARD.RISK.INCONCLUSIVE]:{ text: '...',  color: '#6b7280' },
  [DEEPGUARD.RISK.UNAVAILABLE]: { text: '',     color: '#374151' },
};

function updateBadge(risk) {
  const cfg = BADGE_CONFIG[risk] ?? BADGE_CONFIG[DEEPGUARD.RISK.UNAVAILABLE];
  chrome.action.setBadgeText({ text: cfg.text });
  chrome.action.setBadgeBackgroundColor({ color: cfg.color });
}

function clearBadge() {
  chrome.action.setBadgeText({ text: '' });
}

// ── Notification helpers ───────────────────────────────────────
function sendRiskNotification(result) {
  const now = Date.now();
  if (now - state.lastAlertAt < DEEPGUARD.ALERT.COOLDOWN_MS) return;
  if (result.risk !== DEEPGUARD.RISK.HIGH) return;

  state.lastAlertAt = now;

  chrome.notifications.create(`deepguard-alert-${now}`, {
    type:     'basic',
    iconUrl:  'assets/icons/icon128.png',
    title:    '⚠ Trustlens — High Risk Detected',
    message:  `Potential deepfake manipulation detected.\nRisk Score: ${Math.round(result.score * 100)}%\nPlatform: ${state.platform ?? 'Unknown'}`,
    priority: 2,
  });
}

// ── History management ─────────────────────────────────────────
async function appendHistory(result) {
  const key = DEEPGUARD.SESSION.STORAGE_KEY;
  const stored = await chrome.storage.local.get(key);
  const history = stored[key] || [];

  history.unshift({
    id:           Date.now(),
    timestamp:    new Date().toISOString(),
    platform:     state.platform ?? 'unknown',
    risk:         result.risk,
    score:        result.score,
    faces:        result.faces,
    frameId:      state.framesAnalysed,
  });

  // Keep only MAX_HISTORY_ENTRIES
  if (history.length > DEEPGUARD.SESSION.MAX_HISTORY_ENTRIES) {
    history.length = DEEPGUARD.SESSION.MAX_HISTORY_ENTRIES;
  }

  await chrome.storage.local.set({ [key]: history });
}

// ── Persist / restore session state ───────────────────────────
async function persistState() {
  await chrome.storage.session.set({ deepguard_sw_state: {
    status:         state.status,
    platform:       state.platform,
    tabId:          state.tabId,
    sessionStart:   state.sessionStart,
    framesAnalysed: state.framesAnalysed,
    currentRisk:    state.currentRisk,
    currentScore:   state.currentScore,
    modelReady:     state.modelReady,
    paused:         state.paused,
  }});
}

async function restoreState() {
  const stored = await chrome.storage.session.get('deepguard_sw_state');
  if (stored.deepguard_sw_state) {
    Object.assign(state, stored.deepguard_sw_state);
    swLog('State restored from session storage:', state.status);
  }
}

// ── Broadcast to popup (if open) ──────────────────────────────
function broadcastToPopup(type, payload) {
  chrome.runtime.sendMessage({ type, payload }).catch(() => {
    // Popup may not be open — ignore
  });
}

// ── Broadcast to content script ───────────────────────────────
function broadcastToTab(tabId, type, payload) {
  if (!tabId) return;
  chrome.tabs.sendMessage(tabId, { type, payload }).catch(() => {});
}

// ── Session start ──────────────────────────────────────────────
async function startSession(tabId, platform) {
  if (state.status === DEEPGUARD.STATE.ACTIVE) {
    swWarn('Session already active');
    return { success: false, reason: 'Already active' };
  }

  swLog(`Starting session | tab=${tabId} | platform=${platform}`);

  state.status        = DEEPGUARD.STATE.STARTING;
  state.tabId         = tabId;
  state.platform      = platform;
  state.sessionStart  = Date.now();
  state.framesAnalysed= 0;
  state.currentRisk   = DEEPGUARD.RISK.INCONCLUSIVE;
  state.currentScore  = 0;
  state.paused        = false;

  await persistState();

  // Ensure offscreen document is ready for inference
  await ensureOffscreen();

  // Tell the content script to begin frame capture
  broadcastToTab(tabId, DEEPGUARD.MSG.SESSION_STATE, {
    status:    DEEPGUARD.STATE.STARTING,
    platform,
  });

  state.status = DEEPGUARD.STATE.ACTIVE;
  await persistState();

  updateBadge(DEEPGUARD.RISK.INCONCLUSIVE);

  return { success: true };
}

// ── Session stop ───────────────────────────────────────────────
async function stopSession() {
  swLog('Stopping session');
  state.status = DEEPGUARD.STATE.IDLE;
  state.paused = false;

  broadcastToTab(state.tabId, DEEPGUARD.MSG.SESSION_STATE, {
    status: DEEPGUARD.STATE.IDLE,
  });

  await closeOffscreen();
  clearBadge();
  await persistState();
}

// ── Session pause / resume ─────────────────────────────────────
async function pauseSession() {
  if (state.status !== DEEPGUARD.STATE.ACTIVE) return;
  state.paused = true;
  state.status = DEEPGUARD.STATE.PAUSED;
  broadcastToTab(state.tabId, DEEPGUARD.MSG.SESSION_STATE, { status: DEEPGUARD.STATE.PAUSED });
  await persistState();
}

async function resumeSession() {
  if (state.status !== DEEPGUARD.STATE.PAUSED) return;
  state.paused = false;
  state.status = DEEPGUARD.STATE.ACTIVE;
  broadcastToTab(state.tabId, DEEPGUARD.MSG.SESSION_STATE, { status: DEEPGUARD.STATE.ACTIVE });
  await persistState();
}

// ── Handle incoming frame data from content script ────────────
async function handleFrameData(frameB64, senderId) {
  if (state.status !== DEEPGUARD.STATE.ACTIVE) return;
  if (state.paused) return;

  state.framesAnalysed++;

  // Send to offscreen document for AI inference
  await ensureOffscreen();

  chrome.runtime.sendMessage({
    type:    DEEPGUARD.MSG.OFFSCREEN_DETECT,
    target:  'offscreen',
    payload: {
      frameB64,
      frameId: state.framesAnalysed,
    },
  });
}

// ── Handle detection result from offscreen document ───────────
async function handleDetectionResult(result) {
  const { risk, score, faces, frameId, aggregated } = result;

  state.currentRisk  = risk;
  state.currentScore = score;

  // Update badge
  updateBadge(risk);

  // Notify if high risk
  sendRiskNotification(result);

  // Append notable results to history (not every frame)
  if (risk === DEEPGUARD.RISK.HIGH || risk === DEEPGUARD.RISK.ELEVATED) {
    await appendHistory(result);
  }

  // Broadcast to popup
  broadcastToPopup(DEEPGUARD.MSG.DETECTION_RESULT, {
    risk, score, faces, frameId, aggregated,
    framesAnalysed:  state.framesAnalysed,
    sessionDuration: Date.now() - (state.sessionStart ?? Date.now()),
    platform:        state.platform,
  });

  // Broadcast alert to content script overlay
  if (risk === DEEPGUARD.RISK.HIGH) {
    broadcastToTab(state.tabId, DEEPGUARD.MSG.RISK_ALERT, { risk, score });
  }

  await persistState();
}

// ── Message router ─────────────────────────────────────────────
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  const { type, payload, target } = msg;

  // Ignore messages not meant for the service worker
  if (target && target !== 'background') return false;

  swLog(`MSG ← ${type}`, payload ?? '');

  switch (type) {

    // ── From Popup ─────────────────────────────────────────
    case DEEPGUARD.MSG.POPUP_START: {
      chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
        const tab = tabs[0];
        if (!tab) { sendResponse({ success: false, reason: 'No active tab' }); return; }
        const platform = detectPlatform(tab.url);
        const result   = await startSession(tab.id, platform);
        sendResponse(result);
      });
      return true; // async
    }

    case DEEPGUARD.MSG.POPUP_STOP: {
      stopSession().then(() => sendResponse({ success: true }));
      return true;
    }

    case DEEPGUARD.MSG.POPUP_PAUSE: {
      pauseSession().then(() => sendResponse({ success: true }));
      return true;
    }

    case DEEPGUARD.MSG.POPUP_RESUME: {
      resumeSession().then(() => sendResponse({ success: true }));
      return true;
    }

    case DEEPGUARD.MSG.POPUP_GET_STATE: {
      sendResponse({
        status:          state.status,
        platform:        state.platform,
        currentRisk:     state.currentRisk,
        currentScore:    state.currentScore,
        framesAnalysed:  state.framesAnalysed,
        sessionDuration: state.sessionStart ? Date.now() - state.sessionStart : 0,
        modelReady:      state.modelReady,
        paused:          state.paused,
      });
      return false;
    }

    case DEEPGUARD.MSG.POPUP_GET_HISTORY: {
      chrome.storage.local.get(DEEPGUARD.SESSION.STORAGE_KEY, (r) => {
        sendResponse({ history: r[DEEPGUARD.SESSION.STORAGE_KEY] || [] });
      });
      return true;
    }

    case DEEPGUARD.MSG.POPUP_CLEAR_HISTORY: {
      chrome.storage.local.set({ [DEEPGUARD.SESSION.STORAGE_KEY]: [] }, () => {
        sendResponse({ success: true });
      });
      return true;
    }

    // ── From Content Script ────────────────────────────────
    case DEEPGUARD.MSG.FRAME_DATA: {
      handleFrameData(payload.frameB64, sender.tab?.id);
      return false;
    }

    case DEEPGUARD.MSG.PLATFORM_DETECTED: {
      state.platform = payload.platform;
      swLog(`Platform detected: ${payload.platform}`);
      return false;
    }

    case DEEPGUARD.MSG.STATUS_REQUEST: {
      sendResponse({
        status:      state.status,
        modelReady:  state.modelReady,
        currentRisk: state.currentRisk,
      });
      return false;
    }

    // ── From Offscreen Document ────────────────────────────
    case DEEPGUARD.MSG.OFFSCREEN_RESULT: {
      handleDetectionResult(payload);
      return false;
    }

    case DEEPGUARD.MSG.OFFSCREEN_READY: {
      state.offscreenReady = true;
      state.modelReady     = payload?.modelLoaded ?? false;
      swLog(`Offscreen ready | model=${state.modelReady}`);
      broadcastToPopup(DEEPGUARD.MSG.MODEL_READY, { loaded: state.modelReady });
      return false;
    }

    case DEEPGUARD.MSG.MODEL_ERROR: {
      swError('Model load error:', payload?.error);
      state.modelReady = false;
      broadcastToPopup(DEEPGUARD.MSG.MODEL_ERROR, payload);
      return false;
    }

    default:
      return false;
  }
});

// ── Helper: detect platform from URL ──────────────────────────
function detectPlatform(url = '') {
  if (!url) return 'unknown';
  for (const [, p] of Object.entries(DEEPGUARD.PLATFORMS)) {
    if (url.includes(p.match)) return p.id;
  }
  return 'unknown';
}

// ── Extension install / update ─────────────────────────────────
chrome.runtime.onInstalled.addListener(async ({ reason }) => {
  swLog(`Installed | reason=${reason}`);

  if (reason === 'install') {
    // Set default settings
    await chrome.storage.local.set({
      [DEEPGUARD.SESSION.SETTINGS_KEY]: {
        sampleIntervalMs:   DEEPGUARD.CAPTURE.INTERVAL_MS,
        showOverlay:        true,
        notificationsOn:    true,
        autoStartOnMeet:    false,
        debugMode:          false,
      },
      [DEEPGUARD.SESSION.STORAGE_KEY]: [],
    });
    swLog('Default settings written');
  }
});

// ── Service worker startup ────────────────────────────────────
(async () => {
  await restoreState();
  swLog(`Service worker started | status=${state.status}`);
})();
