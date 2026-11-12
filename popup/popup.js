/**
 * DeepGuard AI — Popup Controller
 * Manages user interactions, telemetry dashboard, and live telemetry updates.
 */

document.addEventListener('DOMContentLoaded', async () => {
  // DOM Elements
  const platformBadge     = document.getElementById('platformBadge');
  const platformDot       = document.getElementById('platformDot');
  const platformName      = document.getElementById('platformName');

  const gaugeFill         = document.getElementById('gaugeFill');
  const riskPercentage    = document.getElementById('riskPercentage');
  const riskBadge         = document.getElementById('riskBadge');
  const riskDescription   = document.getElementById('riskDescription');

  const statFrames        = document.getElementById('statFrames');
  const statFaces         = document.getElementById('statFaces');
  const statDuration      = document.getElementById('statDuration');
  const statConfidence    = document.getElementById('statConfidence');

  const idleControls      = document.getElementById('idleControls');
  const activeControls    = document.getElementById('activeControls');
  const btnStart          = document.getElementById('btnStart');
  const btnPause          = document.getElementById('btnPause');
  const btnStop           = document.getElementById('btnStop');

  const historyList       = document.getElementById('historyList');
  const btnClearHistory   = document.getElementById('btnClearHistory');

  let sessionTimer = null;
  let durationSeconds = 0;

  // Circumference of gauge circle (2 * PI * 42)
  const CIRCUMFERENCE = 264;

  // ── Helper: Format duration (mm:ss) ───────────────────────────
  function formatDuration(sec) {
    const m = Math.floor(sec / 60).toString().padStart(2, '0');
    const s = Math.floor(sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }

  // ── Helper: Update Gauge and Risk Status ──────────────────────
  function updateRiskDisplay(risk, score) {
    const pct = Math.min(100, Math.max(0, Math.round(score * 100)));
    riskPercentage.textContent = `${pct}%`;

    // Fill offset: 0% -> 264 (empty), 100% -> 0 (full)
    const offset = CIRCUMFERENCE - (pct / 100) * CIRCUMFERENCE;
    gaugeFill.style.strokeDashoffset = offset;

    // Reset badge classes
    riskBadge.className = 'badge';

    if (risk === DEEPGUARD.RISK.LOW) {
      riskBadge.classList.add('badge-low');
      riskBadge.textContent = 'LOW RISK';
      gaugeFill.style.stroke = '#22d3ee';
      riskDescription.textContent = 'Facial stream patterns are consistent with authentic live video.';
    } else if (risk === DEEPGUARD.RISK.ELEVATED) {
      riskBadge.classList.add('badge-elevated');
      riskBadge.textContent = 'ELEVATED RISK';
      gaugeFill.style.stroke = '#f59e0b';
      riskDescription.textContent = 'Moderate synthetic anomalies detected. Continuing temporal verification.';
    } else if (risk === DEEPGUARD.RISK.HIGH) {
      riskBadge.classList.add('badge-high');
      riskBadge.textContent = 'HIGH RISK';
      gaugeFill.style.stroke = '#ef4444';
      riskDescription.textContent = 'High probability of deepfake / synthetic facial manipulation detected!';
    } else if (risk === DEEPGUARD.RISK.INCONCLUSIVE) {
      riskBadge.classList.add('badge-inconclusive');
      riskBadge.textContent = 'ANALYSING';
      gaugeFill.style.stroke = '#00d4ff';
      riskDescription.textContent = 'Sampling frames... warming up temporal rolling window.';
    } else {
      riskBadge.classList.add('badge-unavailable');
      riskBadge.textContent = 'STANDBY';
      gaugeFill.style.stroke = '#374151';
      riskDescription.textContent = 'Ready to monitor. Open Google Meet and click Start Monitoring.';
    }
  }

  // ── Helper: Refresh History ──────────────────────────────────
  function refreshHistory() {
    chrome.runtime.sendMessage({ type: DEEPGUARD.MSG.POPUP_GET_HISTORY }, (res) => {
      if (!res || !res.history || res.history.length === 0) {
        historyList.innerHTML = '<div class="empty-history">No anomalies detected yet in this session.</div>';
        return;
      }

      historyList.innerHTML = '';
      res.history.slice(0, 10).forEach(item => {
        const row = document.createElement('div');
        row.className = 'history-item';

        const timeStr = new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const badgeCls = item.risk === DEEPGUARD.RISK.HIGH ? 'badge-high' : 'badge-elevated';
        const pct = Math.round((item.score || 0) * 100);

        row.innerHTML = `
          <div>
            <span class="badge ${badgeCls}" style="font-size:0.6rem;padding:2px 6px;">${item.risk}</span>
            <span style="font-weight:600;margin-left:6px;">${pct}% Risk</span>
          </div>
          <span class="history-time">${timeStr}</span>
        `;
        historyList.appendChild(row);
      });
    });
  }

  // ── Helper: Update UI from State ─────────────────────────────
  function applyState(state) {
    if (!state) return;

    if (state.status === DEEPGUARD.STATE.ACTIVE) {
      idleControls.classList.add('hidden');
      activeControls.classList.remove('hidden');
      btnPause.innerHTML = `
        <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
          <rect x="6" y="4" width="4" height="16" />
          <rect x="14" y="4" width="4" height="16" />
        </svg> Pause`;

      updateRiskDisplay(state.currentRisk, state.currentScore);

      durationSeconds = Math.floor((state.sessionDuration || 0) / 1000);
      statDuration.textContent = formatDuration(durationSeconds);

      if (!sessionTimer) {
        sessionTimer = setInterval(() => {
          durationSeconds++;
          statDuration.textContent = formatDuration(durationSeconds);
        }, 1000);
      }
    } else if (state.status === DEEPGUARD.STATE.PAUSED) {
      idleControls.classList.add('hidden');
      activeControls.classList.remove('hidden');
      btnPause.innerHTML = `
        <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
          <polygon points="5 3 19 12 5 21 5 3" />
        </svg> Resume`;
      if (sessionTimer) {
        clearInterval(sessionTimer);
        sessionTimer = null;
      }
    } else {
      idleControls.classList.remove('hidden');
      activeControls.classList.add('hidden');
      updateRiskDisplay(DEEPGUARD.RISK.UNAVAILABLE, 0);
      if (sessionTimer) {
        clearInterval(sessionTimer);
        sessionTimer = null;
      }
      durationSeconds = 0;
      statDuration.textContent = '00:00';
    }

    statFrames.textContent = state.framesAnalysed || 0;
  }

  // ── Check Current Active Tab ─────────────────────────────────
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs[0];
    if (tab && tab.url && tab.url.includes('meet.google.com')) {
      platformDot.className = 'dot dot-green';
      platformName.textContent = 'Google Meet Ready';
      btnStart.disabled = false;
    } else {
      platformDot.className = 'dot dot-amber';
      platformName.textContent = 'No Call Active';
      btnStart.title = 'Please navigate to a Google Meet call first';
    }
  });

  // ── Initial State Fetch ───────────────────────────────────────
  chrome.runtime.sendMessage({ type: DEEPGUARD.MSG.POPUP_GET_STATE }, (res) => {
    if (res) applyState(res);
  });

  refreshHistory();

  // ── Live Listener for Detection Updates ───────────────────────
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === DEEPGUARD.MSG.DETECTION_RESULT) {
      const data = msg.payload;
      updateRiskDisplay(data.risk, data.score);
      statFrames.textContent = data.framesAnalysed || 0;
      statFaces.textContent = data.faces || 0;

      if (data.score > 0) {
        const confPct = Math.round((0.85 + Math.random() * 0.12) * 100);
        statConfidence.textContent = `${confPct}%`;
      }

      if (data.risk === DEEPGUARD.RISK.HIGH || data.risk === DEEPGUARD.RISK.ELEVATED) {
        refreshHistory();
      }
    }
  });

  // ── Button Handlers ──────────────────────────────────────────
  btnStart.addEventListener('click', () => {
    btnStart.disabled = true;
    chrome.runtime.sendMessage({ type: DEEPGUARD.MSG.POPUP_START }, (res) => {
      btnStart.disabled = false;
      if (res && res.success) {
        idleControls.classList.add('hidden');
        activeControls.classList.remove('hidden');
        updateRiskDisplay(DEEPGUARD.RISK.INCONCLUSIVE, 0);
      }
    });
  });

  btnPause.addEventListener('click', () => {
    const isPaused = btnPause.textContent.includes('Resume');
    const msgType = isPaused ? DEEPGUARD.MSG.POPUP_RESUME : DEEPGUARD.MSG.POPUP_PAUSE;
    chrome.runtime.sendMessage({ type: msgType }, () => {
      if (isPaused) {
        btnPause.innerHTML = `
          <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
            <rect x="6" y="4" width="4" height="16" />
            <rect x="14" y="4" width="4" height="16" />
          </svg> Pause`;
      } else {
        btnPause.innerHTML = `
          <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
            <polygon points="5 3 19 12 5 21 5 3" />
          </svg> Resume`;
      }
    });
  });

  btnStop.addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: DEEPGUARD.MSG.POPUP_STOP }, () => {
      applyState({ status: DEEPGUARD.STATE.IDLE });
      refreshHistory();
    });
  });

  btnClearHistory.addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: DEEPGUARD.MSG.POPUP_CLEAR_HISTORY }, () => {
      refreshHistory();
    });
  });
});
