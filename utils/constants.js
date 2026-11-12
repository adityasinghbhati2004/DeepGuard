/**
 * DeepGuard AI — Constants
 * Shared configuration used across all extension modules.
 */

const DEEPGUARD = {

  // ── Extension identity ──────────────────────────────────
  NAME:    'DeepGuard AI',
  VERSION: '1.0.0',

  // ── Risk levels ─────────────────────────────────────────
  RISK: {
    LOW:         'LOW',
    ELEVATED:    'ELEVATED',
    HIGH:        'HIGH',
    INCONCLUSIVE:'INCONCLUSIVE',
    UNAVAILABLE: 'UNAVAILABLE',
  },

  // ── Risk thresholds (0–1 score) ─────────────────────────
  THRESHOLD: {
    LOW_MAX:   0.35,   // ≤ 35% → LOW RISK  (green)
    HIGH_MIN:  0.60,   // ≥ 60% → HIGH RISK (red)
    // 35–60% → ELEVATED (yellow)
  },

  // ── Frame capture settings ──────────────────────────────
  CAPTURE: {
    INTERVAL_MS:      200,   // Sample one frame every 200ms (5 FPS)
    CANVAS_WIDTH:     640,
    CANVAS_HEIGHT:    480,
    JPEG_QUALITY:     0.85,
    MAX_FACES:        4,
  },

  // ── Temporal aggregation ─────────────────────────────────
  TEMPORAL: {
    WINDOW_SIZE:          15,  // Rolling window (frames)
    MIN_FRAMES_FOR_RISK:   5,  // Minimum frames before reporting risk
    CONSECUTIVE_HIGH_ALERT:3,  // 3 consecutive high frames → alert
  },

  // ── Alert settings ────────────────────────────────────────
  ALERT: {
    COOLDOWN_MS:     8000,   // Min time between repeated alerts
    HIGH_RISK_SOUND: true,
  },

  // ── Session / history ─────────────────────────────────────
  SESSION: {
    MAX_HISTORY_ENTRIES: 50,
    STORAGE_KEY:         'deepguard_history',
    SETTINGS_KEY:        'deepguard_settings',
    SESSION_KEY:         'deepguard_session',
  },

  // ── Supported platforms ───────────────────────────────────
  PLATFORMS: {
    MEET:   { id: 'meet',   name: 'Google Meet',       match: 'meet.google.com' },
    ZOOM:   { id: 'zoom',   name: 'Zoom Web',          match: 'app.zoom.us'     },
    TEAMS:  { id: 'teams',  name: 'Microsoft Teams',   match: 'teams.microsoft.com' },
    WA:     { id: 'wa',     name: 'WhatsApp Web',      match: 'web.whatsapp.com' },
  },

  // ── Messages (extension ↔ service worker ↔ content) ──────
  MSG: {
    // Content → Background
    FRAME_DATA:         'FRAME_DATA',
    SESSION_START:      'SESSION_START',
    SESSION_STOP:       'SESSION_STOP',
    SESSION_PAUSE:      'SESSION_PAUSE',
    SESSION_RESUME:     'SESSION_RESUME',
    STATUS_REQUEST:     'STATUS_REQUEST',
    PLATFORM_DETECTED:  'PLATFORM_DETECTED',

    // Background → Content / Popup
    DETECTION_RESULT:   'DETECTION_RESULT',
    RISK_ALERT:         'RISK_ALERT',
    SESSION_STATE:      'SESSION_STATE',
    STATUS_RESPONSE:    'STATUS_RESPONSE',
    MODEL_READY:        'MODEL_READY',
    MODEL_ERROR:        'MODEL_ERROR',

    // Popup → Background
    POPUP_START:        'POPUP_START',
    POPUP_STOP:         'POPUP_STOP',
    POPUP_PAUSE:        'POPUP_PAUSE',
    POPUP_RESUME:       'POPUP_RESUME',
    POPUP_GET_STATE:    'POPUP_GET_STATE',
    POPUP_GET_HISTORY:  'POPUP_GET_HISTORY',
    POPUP_CLEAR_HISTORY:'POPUP_CLEAR_HISTORY',

    // Offscreen
    OFFSCREEN_DETECT:   'OFFSCREEN_DETECT',
    OFFSCREEN_RESULT:   'OFFSCREEN_RESULT',
    OFFSCREEN_READY:    'OFFSCREEN_READY',
  },

  // ── State machine values ──────────────────────────────────
  STATE: {
    IDLE:       'IDLE',
    STARTING:   'STARTING',
    ACTIVE:     'ACTIVE',
    PAUSED:     'PAUSED',
    STOPPING:   'STOPPING',
    ERROR:      'ERROR',
  },

  // ── Offscreen document ────────────────────────────────────
  OFFSCREEN_URL: 'offscreen/offscreen.html',
  OFFSCREEN_REASON: 'BLOBS',

  // ── Model settings ────────────────────────────────────────
  MODEL: {
    ONNX_PATH:    'assets/models/deepfake_detector.onnx',
    INPUT_SIZE:   224,
    INPUT_NAME:   'input',
    OUTPUT_NAME:  'output',
  },
};

// Make available as module export AND as window global
// (content scripts load this as a plain script, not a module)
if (typeof module !== 'undefined') {
  module.exports = DEEPGUARD;
}
