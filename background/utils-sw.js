/**
 * DeepGuard AI — Service Worker Constants & Utilities
 * Provides global configuration and helpers for the ES Module Service Worker.
 */

export const DEEPGUARD = {
  NAME: 'DeepGuard AI',
  VERSION: '1.0.0',

  RISK: {
    LOW: 'LOW',
    ELEVATED: 'ELEVATED',
    HIGH: 'HIGH',
    INCONCLUSIVE: 'INCONCLUSIVE',
    UNAVAILABLE: 'UNAVAILABLE',
  },

  THRESHOLD: {
    LOW_MAX: 0.35,   // ≤ 35% -> LOW RISK (Green/Cyan)
    HIGH_MIN: 0.60,  // ≥ 60% -> HIGH RISK (Red)
  },

  CAPTURE: {
    INTERVAL_MS: 200,   // 5 FPS sampling rate
    CANVAS_WIDTH: 640,
    CANVAS_HEIGHT: 480,
    JPEG_QUALITY: 0.85,
    MAX_FACES: 4,
  },

  TEMPORAL: {
    WINDOW_SIZE: 15,
    MIN_FRAMES_FOR_RISK: 5,
    CONSECUTIVE_HIGH_ALERT: 3,
  },

  ALERT: {
    COOLDOWN_MS: 8000,
    HIGH_RISK_SOUND: true,
  },

  SESSION: {
    MAX_HISTORY_ENTRIES: 50,
    STORAGE_KEY: 'deepguard_history',
    SETTINGS_KEY: 'deepguard_settings',
    SESSION_KEY: 'deepguard_session',
  },

  PLATFORMS: {
    MEET: { id: 'meet', name: 'Google Meet', match: 'meet.google.com' },
    ZOOM: { id: 'zoom', name: 'Zoom Web', match: 'app.zoom.us' },
    TEAMS: { id: 'teams', name: 'Microsoft Teams', match: 'teams.microsoft.com' },
    WA: { id: 'wa', name: 'WhatsApp Web', match: 'web.whatsapp.com' },
  },

  MSG: {
    FRAME_DATA: 'FRAME_DATA',
    SESSION_START: 'SESSION_START',
    SESSION_STOP: 'SESSION_STOP',
    SESSION_PAUSE: 'SESSION_PAUSE',
    SESSION_RESUME: 'SESSION_RESUME',
    STATUS_REQUEST: 'STATUS_REQUEST',
    PLATFORM_DETECTED: 'PLATFORM_DETECTED',

    DETECTION_RESULT: 'DETECTION_RESULT',
    RISK_ALERT: 'RISK_ALERT',
    SESSION_STATE: 'SESSION_STATE',
    STATUS_RESPONSE: 'STATUS_RESPONSE',
    MODEL_READY: 'MODEL_READY',
    MODEL_ERROR: 'MODEL_ERROR',

    POPUP_START: 'POPUP_START',
    POPUP_STOP: 'POPUP_STOP',
    POPUP_PAUSE: 'POPUP_PAUSE',
    POPUP_RESUME: 'POPUP_RESUME',
    POPUP_GET_STATE: 'POPUP_GET_STATE',
    POPUP_GET_HISTORY: 'POPUP_GET_HISTORY',
    POPUP_CLEAR_HISTORY: 'POPUP_CLEAR_HISTORY',

    OFFSCREEN_DETECT: 'OFFSCREEN_DETECT',
    OFFSCREEN_RESULT: 'OFFSCREEN_RESULT',
    OFFSCREEN_READY: 'OFFSCREEN_READY',
  },

  STATE: {
    IDLE: 'IDLE',
    STARTING: 'STARTING',
    ACTIVE: 'ACTIVE',
    PAUSED: 'PAUSED',
    STOPPING: 'STOPPING',
    ERROR: 'ERROR',
  },

  OFFSCREEN_URL: 'offscreen/offscreen.html',
  OFFSCREEN_REASON: 'BLOBS',

  MODEL: {
    ONNX_PATH: 'assets/models/deepfake_detector.onnx',
    INPUT_SIZE: 224,
    INPUT_NAME: 'input',
    OUTPUT_NAME: 'output',
  },
};

// Bind to globalThis so service-worker.js can access DEEPGUARD directly
globalThis.DEEPGUARD = DEEPGUARD;
