/**
 * DeepGuard — Google Meet Content Script
 * 
 * Injected into https://meet.google.com/*
 * Responsibilities:
 *  - Discover and track active remote participant video streams
 *  - Sample video frames via HTML5 Canvas at 5 FPS
 *  - Send frames to background Service Worker for deepfake analysis
 *  - Inject a discreet floating cybersecurity HUD badge directly on Google Meet
 *  - Show real-time risk indicators (Green/Yellow/Red) & alert banners
 */

(() => {
  'use strict';

  Logger.info('Google Meet content script initialized');

  let captureInterval = null;
  let isMonitoring = false;
  let activeVideoElement = null;
  let canvas = null;
  let ctx = null;

  // Notify background that Google Meet is active
  chrome.runtime.sendMessage({
    type: DEEPGUARD.MSG.PLATFORM_DETECTED,
    payload: { platform: 'Google Meet' }
  }).catch(() => {});

  // ── Create and Inject Floating HUD ─────────────────────────────
  function injectHUD() {
    if (document.getElementById('deepguard-hud-root')) return;

    const hudContainer = document.createElement('div');
    hudContainer.id = 'deepguard-hud-root';
    hudContainer.innerHTML = `
      <div id="deepguard-hud" class="dg-hud dg-idle">
        <div class="dg-header" id="dg-drag-handle">
          <div class="dg-brand">
            <div class="dg-shield-icon">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              </svg>
            </div>
            <span class="dg-title">DeepGuard</span>
          </div>
          <span class="dg-status-pill" id="dg-pill">STANDBY</span>
          <button class="dg-toggle-btn" id="dg-toggle" title="Minimize/Expand">_</button>
        </div>
        <div class="dg-body" id="dg-body">
          <div class="dg-risk-row">
            <span class="dg-label">DEEPFAKE RISK</span>
            <span class="dg-score" id="dg-score">0%</span>
          </div>
          <div class="dg-progress-bar">
            <div class="dg-progress-fill" id="dg-fill"></div>
          </div>
          <div class="dg-info-row">
            <span class="dg-source" id="dg-source">No video target</span>
            <span class="dg-fps" id="dg-fps">5 FPS</span>
          </div>
        </div>
      </div>
      <div id="deepguard-alert-banner" class="dg-alert-banner dg-hidden">
        <div class="dg-alert-icon">⚠️</div>
        <div class="dg-alert-text">
          <strong id="dg-alert-title">POTENTIAL DEEPFAKE DETECTED!</strong>
          <span id="dg-alert-desc">Facial synthesis anomalies identified in participant stream.</span>
        </div>
      </div>
    `;

    // Append HUD styling
    const style = document.createElement('style');
    style.textContent = `
      #deepguard-hud-root {
        position: fixed;
        bottom: 84px;
        left: 24px;
        z-index: 999999;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        user-select: none;
      }
      .dg-hud {
        width: 250px;
        background: rgba(10, 22, 40, 0.94);
        border: 1px solid #1a2d4a;
        border-radius: 10px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6);
        backdrop-filter: blur(12px);
        color: #f0f9ff;
        overflow: hidden;
        transition: border-color 0.3s ease, box-shadow 0.3s ease;
      }
      .dg-hud.dg-low {
        border-color: rgba(34, 211, 238, 0.5);
        box-shadow: 0 0 20px rgba(34, 211, 238, 0.2);
      }
      .dg-hud.dg-elevated {
        border-color: rgba(245, 158, 11, 0.6);
        box-shadow: 0 0 20px rgba(245, 158, 11, 0.25);
      }
      .dg-hud.dg-high {
        border-color: rgba(239, 68, 68, 0.8);
        box-shadow: 0 0 25px rgba(239, 68, 68, 0.4);
        animation: dg-pulse-red 1.5s infinite;
      }
      @keyframes dg-pulse-red {
        0%, 100% { border-color: rgba(239, 68, 68, 0.8); }
        50% { border-color: rgba(239, 68, 68, 0.3); }
      }
      .dg-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 8px 12px;
        background: #0d1a2e;
        border-bottom: 1px solid #1a2d4a;
        cursor: grab;
      }
      .dg-brand {
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .dg-shield-icon {
        width: 20px;
        height: 20px;
        background: linear-gradient(135deg, #3b82f6, #00d4ff);
        border-radius: 4px;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #fff;
      }
      .dg-title {
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.05em;
        color: #00d4ff;
      }
      .dg-status-pill {
        font-size: 9px;
        font-weight: 700;
        padding: 2px 6px;
        border-radius: 999px;
        background: #1a2d4a;
        color: #94a3b8;
      }
      .dg-pill-low { background: rgba(34, 211, 238, 0.15); color: #22d3ee; }
      .dg-pill-elevated { background: rgba(245, 158, 11, 0.15); color: #f59e0b; }
      .dg-pill-high { background: rgba(239, 68, 68, 0.2); color: #ef4444; }
      .dg-toggle-btn {
        background: transparent;
        border: none;
        color: #94a3b8;
        font-size: 12px;
        cursor: pointer;
        padding: 0 4px;
      }
      .dg-body {
        padding: 10px 12px;
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .dg-body.collapsed {
        display: none;
      }
      .dg-risk-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
      }
      .dg-label {
        font-size: 9px;
        color: #94a3b8;
        font-weight: 600;
        letter-spacing: 0.06em;
      }
      .dg-score {
        font-family: monospace;
        font-size: 14px;
        font-weight: 800;
        color: #00d4ff;
      }
      .dg-progress-bar {
        height: 4px;
        background: #1a2d4a;
        border-radius: 2px;
        overflow: hidden;
      }
      .dg-progress-fill {
        height: 100%;
        width: 0%;
        background: #00d4ff;
        transition: width 0.3s ease, background-color 0.3s ease;
      }
      .dg-info-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        font-size: 9px;
        color: #64748b;
      }
      .dg-alert-banner {
        margin-top: 8px;
        background: rgba(239, 68, 68, 0.95);
        color: #fff;
        padding: 8px 12px;
        border-radius: 8px;
        display: flex;
        align-items: center;
        gap: 8px;
        box-shadow: 0 4px 16px rgba(239, 68, 68, 0.4);
        animation: dg-bounce 0.4s ease;
      }
      .dg-alert-banner.dg-hidden {
        display: none;
      }
      @keyframes dg-bounce {
        0% { transform: translateY(10px); opacity: 0; }
        100% { transform: translateY(0); opacity: 1; }
      }
      .dg-alert-icon { font-size: 16px; }
      .dg-alert-text strong { display: block; font-size: 11px; }
      .dg-alert-text span { font-size: 9px; opacity: 0.9; }
    `;

    document.head.appendChild(style);
    document.body.appendChild(hudContainer);

    // Draggable HUD functionality
    const handle = document.getElementById('dg-drag-handle');
    let isDragging = false;
    let offsetX = 0, offsetY = 0;

    handle.addEventListener('mousedown', (e) => {
      isDragging = true;
      offsetX = e.clientX - hudContainer.getBoundingClientRect().left;
      offsetY = e.clientY - hudContainer.getBoundingClientRect().top;
      handle.style.cursor = 'grabbing';
    });

    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      hudContainer.style.bottom = 'auto';
      hudContainer.style.left = `${e.clientX - offsetX}px`;
      hudContainer.style.top = `${e.clientY - offsetY}px`;
    });

    document.addEventListener('mouseup', () => {
      isDragging = false;
      if (handle) handle.style.cursor = 'grab';
    });

    // Minimize toggle
    const toggleBtn = document.getElementById('dg-toggle');
    const body = document.getElementById('dg-body');
    toggleBtn.addEventListener('click', () => {
      body.classList.toggle('collapsed');
      toggleBtn.textContent = body.classList.contains('collapsed') ? '+' : '_';
    });
  }

  // ── Find Best Remote Video Element in Google Meet ─────────────
  function findParticipantVideo() {
    const videos = Array.from(document.querySelectorAll('video'));
    if (!videos.length) return null;

    // Filter playing videos with positive resolution
    const activeVideos = videos.filter(v => 
      !v.paused && !v.ended && v.readyState >= 2 && v.videoWidth > 100
    );

    if (!activeVideos.length) return null;

    // Exclude self-view video if identifiable, or choose largest video by area (main speaker)
    activeVideos.sort((a, b) => (b.videoWidth * b.videoHeight) - (a.videoWidth * a.videoHeight));
    return activeVideos[0];
  }

  // ── Frame Extraction Pipeline ──────────────────────────────────
  function captureAndSendFrame() {
    if (!isMonitoring) return;

    if (!activeVideoElement || activeVideoElement.paused || !activeVideoElement.isConnected) {
      activeVideoElement = findParticipantVideo();
    }

    const sourceLabel = document.getElementById('dg-source');

    if (!activeVideoElement) {
      if (sourceLabel) sourceLabel.textContent = 'Seeking video stream...';
      return;
    }

    if (sourceLabel) {
      sourceLabel.textContent = `Target: ${activeVideoElement.videoWidth}x${activeVideoElement.videoHeight}`;
    }

    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.width = DEEPGUARD.CAPTURE.CANVAS_WIDTH;
      canvas.height = DEEPGUARD.CAPTURE.CANVAS_HEIGHT;
      ctx = canvas.getContext('2d', { willReadFrequently: true });
    }

    try {
      ctx.drawImage(activeVideoElement, 0, 0, canvas.width, canvas.height);
      const frameB64 = canvas.toDataURL('image/jpeg', DEEPGUARD.CAPTURE.JPEG_QUALITY);

      chrome.runtime.sendMessage({
        type: DEEPGUARD.MSG.FRAME_DATA,
        payload: {
          frameB64: frameB64,
          timestamp: Date.now()
        }
      }).catch(() => {});
    } catch (err) {
      Logger.warn('Frame capture error:', err.message);
    }
  }

  // ── Start / Stop Capture Controller ───────────────────────────
  function startMonitoring() {
    if (captureInterval) clearInterval(captureInterval);
    isMonitoring = true;
    injectHUD();

    const pill = document.getElementById('dg-pill');
    if (pill) {
      pill.className = 'dg-status-pill';
      pill.textContent = 'ACTIVE';
    }

    captureInterval = setInterval(captureAndSendFrame, DEEPGUARD.CAPTURE.INTERVAL_MS);
    Logger.info('Live capture started @ 5 FPS');
  }

  function stopMonitoring() {
    if (captureInterval) {
      clearInterval(captureInterval);
      captureInterval = null;
    }
    isMonitoring = false;
    activeVideoElement = null;

    const hud = document.getElementById('deepguard-hud');
    const pill = document.getElementById('dg-pill');
    const alertBanner = document.getElementById('deepguard-alert-banner');

    if (hud) hud.className = 'dg-hud dg-idle';
    if (pill) {
      pill.className = 'dg-status-pill';
      pill.textContent = 'STANDBY';
    }
    if (alertBanner) alertBanner.classList.add('dg-hidden');

    Logger.info('Live capture stopped');
  }

  // ── Update HUD with Detection Telemetry ───────────────────────
  function updateHUD(result) {
    const hud = document.getElementById('deepguard-hud');
    const pill = document.getElementById('dg-pill');
    const scoreEl = document.getElementById('dg-score');
    const fillEl = document.getElementById('dg-fill');
    const alertBanner = document.getElementById('deepguard-alert-banner');

    if (!hud || !pill || !scoreEl || !fillEl) return;

    const pct = Math.min(100, Math.max(0, Math.round((result.score || 0) * 100)));
    scoreEl.textContent = `${pct}%`;
    fillEl.style.width = `${pct}%`;

    hud.className = 'dg-hud';
    pill.className = 'dg-status-pill';

    if (result.risk === DEEPGUARD.RISK.LOW) {
      hud.classList.add('dg-low');
      pill.classList.add('dg-pill-low');
      pill.textContent = 'LOW RISK';
      fillEl.style.backgroundColor = '#22d3ee';
      if (alertBanner) alertBanner.classList.add('dg-hidden');
    } else if (result.risk === DEEPGUARD.RISK.ELEVATED) {
      hud.classList.add('dg-elevated');
      pill.classList.add('dg-pill-elevated');
      pill.textContent = 'ELEVATED';
      fillEl.style.backgroundColor = '#f59e0b';
      if (alertBanner) alertBanner.classList.add('dg-hidden');
    } else if (result.risk === DEEPGUARD.RISK.HIGH) {
      hud.classList.add('dg-high');
      pill.classList.add('dg-pill-high');
      pill.textContent = 'HIGH THREAT';
      fillEl.style.backgroundColor = '#ef4444';

      // Flash threat alert banner on Google Meet
      if (alertBanner) {
        alertBanner.classList.remove('dg-hidden');
        document.getElementById('dg-alert-title').textContent = `THREAT DETECTED: ${pct}% RISK`;
      }
    }
  }

  // ── Listen for Messages from Service Worker ───────────────────
  chrome.runtime.onMessage.addListener((msg) => {
    if (!msg) return;

    if (msg.type === DEEPGUARD.MSG.SESSION_STATE) {
      if (msg.payload.status === DEEPGUARD.STATE.ACTIVE || msg.payload.status === DEEPGUARD.STATE.STARTING) {
        startMonitoring();
      } else if (msg.payload.status === DEEPGUARD.STATE.IDLE) {
        stopMonitoring();
      } else if (msg.payload.status === DEEPGUARD.STATE.PAUSED) {
        isMonitoring = false;
        const pill = document.getElementById('dg-pill');
        if (pill) pill.textContent = 'PAUSED';
      }
    } else if (msg.type === DEEPGUARD.MSG.DETECTION_RESULT) {
      updateHUD(msg.payload);
    } else if (msg.type === DEEPGUARD.MSG.RISK_ALERT) {
      const banner = document.getElementById('deepguard-alert-banner');
      if (banner) banner.classList.remove('dg-hidden');
    }
  });

  // Inject initial HUD
  injectHUD();
})();
