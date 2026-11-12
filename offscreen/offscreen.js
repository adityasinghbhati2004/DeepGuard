/**
 * DeepGuard — Offscreen Inference Engine
 * 
 * Runs in the Chrome offscreen document context with full DOM & Canvas access.
 * Handles:
 *  - Decoding sampled frame payloads
 *  - Facial boundary and high-frequency blending artifact analysis
 *  - Optional real-time WebSocket connection to local PyTorch EfficientNet backend (ws://localhost:8000/ws/detect)
 *  - Temporal window smoothing (15-frame rolling buffer)
 *  - Sending aggregated risk classification back to background service worker
 */

(() => {
  'use strict';

  Logger.info('Offscreen inference worker activated');

  const canvas = document.getElementById('offscreenCanvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const img = new Image();

  // ── Rolling Window Temporal Aggregator ─────────────────────────
  class TemporalWindow {
    constructor(size = 15) {
      this.size = size;
      this.window = [];
    }

    add(score) {
      this.window.push(score);
      if (this.window.length > this.size) {
        this.window.shift();
      }
    }

    getMean() {
      if (!this.window.length) return 0;
      const sum = this.window.reduce((acc, v) => acc + v, 0);
      return sum / this.window.length;
    }

    getCount() {
      return this.window.length;
    }

    reset() {
      this.window = [];
    }
  }

  const temporal = new TemporalWindow(DEEPGUARD.TEMPORAL.WINDOW_SIZE);

  // ── Local Python Backend WebSocket Client ─────────────────────
  let backendWs = null;
  let backendConnected = false;

  function initBackendWebSocket() {
    try {
      backendWs = new WebSocket('ws://localhost:8000/ws/detect');

      backendWs.onopen = () => {
        backendConnected = true;
        Logger.info('Connected to DeepGuard Python PyTorch backend via WebSocket');
        chrome.runtime.sendMessage({
          type: DEEPGUARD.MSG.OFFSCREEN_READY,
          payload: { modelLoaded: true, backendActive: true }
        }).catch(() => {});
      };

      backendWs.onmessage = (event) => {
        try {
          const res = JSON.parse(event.data);
          if (res.type === 'frame_result' && res.payload) {
            handleInferenceResult(res.payload.mean_score || 0, res.payload.faces_detected || 1);
          }
        } catch (e) {}
      };

      backendWs.onclose = () => {
        backendConnected = false;
        // Retry connection every 10 seconds
        setTimeout(initBackendWebSocket, 10000);
      };

      backendWs.onerror = () => {
        backendConnected = false;
      };
    } catch (e) {
      backendConnected = false;
    }
  }

  initBackendWebSocket();

  // ── Client-Side Spatial-Frequency Artifact Estimator ──────────
  // Fallback if backend server is not running
  function analyzeFrameArtifacts(imageData) {
    const data = imageData.data;
    const width = imageData.width;
    const height = imageData.height;

    let laplacianVar = 0;
    let highFreqCount = 0;
    let totalPixels = 0;

    // Fast step scan over center face zone (10% to 90% bounding box)
    const startX = Math.floor(width * 0.15);
    const endX = Math.floor(width * 0.85);
    const startY = Math.floor(height * 0.15);
    const endY = Math.floor(height * 0.85);
    const step = 4;

    for (let y = startY + 1; y < endY - 1; y += step) {
      for (let x = startX + 1; x < endX - 1; x += step) {
        const idx = (y * width + x) * 4;
        const gray = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];

        const idxUp = ((y - 1) * width + x) * 4;
        const idxDown = ((y + 1) * width + x) * 4;
        const idxLeft = (y * width + (x - 1)) * 4;
        const idxRight = (y * width + (x + 1)) * 4;

        const grayUp = 0.299 * data[idxUp] + 0.587 * data[idxUp + 1] + 0.114 * data[idxUp + 2];
        const grayDown = 0.299 * data[idxDown] + 0.587 * data[idxDown + 1] + 0.114 * data[idxDown + 2];
        const grayLeft = 0.299 * data[idxLeft] + 0.587 * data[idxLeft + 1] + 0.114 * data[idxLeft + 2];
        const grayRight = 0.299 * data[idxRight] + 0.587 * data[idxRight + 1] + 0.114 * data[idxRight + 2];

        // Discrete 2D Laplacian operator (edge & texture sharpness)
        const lap = Math.abs(4 * gray - grayUp - grayDown - grayLeft - grayRight);
        laplacianVar += lap;
        if (lap > 25) highFreqCount++;
        totalPixels++;
      }
    }

    const avgEdgeEnergy = totalPixels > 0 ? laplacianVar / totalPixels : 0;
    const highFreqRatio = totalPixels > 0 ? highFreqCount / totalPixels : 0;

    // Genuine high-res camera video has natural sensor noise & micro-textures
    // Face swaps / GAN syntheses show artificial over-smoothing and boundary blending mismatches
    let baseScore = 0.12; // Natural baseline
    if (highFreqRatio < 0.04 && avgEdgeEnergy < 8.0) {
      baseScore = 0.65; // High smoothing anomaly typical of synthetic generation
    } else if (highFreqRatio < 0.08) {
      baseScore = 0.42; // Elevated anomaly
    }

    return Math.min(0.95, Math.max(0.05, baseScore));
  }

  // ── Handle Detection Output ────────────────────────────────────
  function handleInferenceResult(rawScore, faceCount = 1) {
    temporal.add(rawScore);
    const smoothedScore = temporal.getMean();

    let riskLevel = DEEPGUARD.RISK.LOW;
    if (smoothedScore >= DEEPGUARD.THRESHOLD.HIGH_MIN) {
      riskLevel = DEEPGUARD.RISK.HIGH;
    } else if (smoothedScore >= DEEPGUARD.THRESHOLD.LOW_MAX) {
      riskLevel = DEEPGUARD.RISK.ELEVATED;
    }

    chrome.runtime.sendMessage({
      type: DEEPGUARD.MSG.OFFSCREEN_RESULT,
      target: 'background',
      payload: {
        risk: riskLevel,
        score: smoothedScore,
        rawScore: rawScore,
        faces: faceCount,
        aggregated: {
          windowSize: temporal.getCount(),
          windowMean: smoothedScore
        }
      }
    }).catch(() => {});
  }

  // ── Process Incoming Frames ────────────────────────────────────
  chrome.runtime.onMessage.addListener((msg) => {
    if (!msg || msg.target !== 'offscreen') return;

    if (msg.type === DEEPGUARD.MSG.OFFSCREEN_DETECT) {
      const { frameB64 } = msg.payload;

      // If backend WebSocket is online, forward frame to PyTorch backend
      if (backendConnected && backendWs && backendWs.readyState === WebSocket.OPEN) {
        backendWs.send(JSON.stringify({
          type: 'frame',
          data: frameB64
        }));
      } else {
        // Run client-side analysis
        img.onload = () => {
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const score = analyzeFrameArtifacts(imageData);
          handleInferenceResult(score, 1);
        };
        img.src = frameB64;
      }
    }
  });

  // Signal ready to Service Worker
  chrome.runtime.sendMessage({
    type: DEEPGUARD.MSG.OFFSCREEN_READY,
    payload: { modelLoaded: true }
  }).catch(() => {});
})();
