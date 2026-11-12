# DeepGuard — Chrome Browser Extension
### Real-Time Deepfake Detection System for Live Video Calls (Google Meet)

DeepGuard is a production-ready Chromium browser extension built with **Manifest V3**. It detects potential synthetic media and deepfake face manipulation in real time during live Google Meet calls and presents active security metrics, risk telemetry, and threat warning alerts.

---

## 🚀 Key Features

* **Real-Time Video Capture:** Seamlessly tracks active remote participant video streams in Google Meet via HTML5 Canvas sampling (5 FPS default).
* **Live In-Call HUD Overlay:** Floating draggable security badge injected directly into Google Meet, displaying current risk %, threat status, and an alert banner.
* **Dual-Mode AI Detection Engine:**
  - **Local Client Mode:** In-browser spatial-frequency edge and blending artifact analysis (runs in an isolated Chrome Offscreen document without blocking the UI thread).
  - **PyTorch Backend Mode:** Automatic WebSocket connection (`ws://localhost:8000/ws/detect`) to the deep neural network classifier (EfficientNet-B4) when the local backend server is active.
* **Temporal Smoothing:** Rolling window of 15 frames prevents single-frame false alarms and stabilizes threat probability.
* **Cybersecurity Dashboard Popup:** Circular risk gauge, analyzed frame count, session duration, and anomaly threat logs.
* **Desktop Notifications:** Instant native Chrome notifications when sustained high-threat manipulation is detected.

---

## 📦 How to Install and Test in Chrome (Load Unpacked)

1. Open **Google Chrome** (or any Chromium browser such as Brave, Edge, or Opera).
2. Navigate to `chrome://extensions/` in your URL bar.
3. Toggle on **Developer mode** in the top-right corner.
4. Click **Load unpacked** in the top-left toolbar.
5. Select the extension directory:
   ```
   c:\Users\bhati\OneDrive\Desktop\editing raw\mothherhood\raw\deepguard-extension
   ```
6. DeepGuard is now loaded and will appear in your Chrome toolbar!

---

## 🎥 How to Use in Real Time

1. Start or join any video call on [Google Meet](https://meet.google.com).
2. Click the **DeepGuard shield icon** in your Chrome extension toolbar.
3. The popup will automatically detect that Google Meet is active (showing a green status dot).
4. Click **Start Monitoring**:
   - The in-call HUD overlay will appear in the bottom-left of your Google Meet screen.
   - The circular risk meter and telemetry counters will begin tracking frames.
   - If an anomalous face swap or synthetic stream is detected, the HUD and popup will switch to **High Threat (Red)** and display a prominent warning banner.

---

## 📂 Project Architecture

```
deepguard-extension/
├── manifest.json              # Chrome Manifest V3 configuration
├── background/
│   ├── service-worker.js      # Background lifecycle, message router & notifications
│   └── utils-sw.js            # Service worker constants & configuration
├── content/
│   ├── meet-content.js        # Google Meet DOM hook, canvas grabber & HUD overlay
│   └── injected.js            # Page bridge script
├── offscreen/
│   ├── offscreen.html         # Chrome Offscreen document DOM container
│   └── offscreen.js           # Spatial-frequency analysis & WebSocket PyTorch bridge
├── popup/
│   ├── popup.html             # Extension action popup interface
│   ├── popup.css              # Dark cybersecurity design system
│   └── popup.js               # Live telemetry & control listeners
├── options/
│   ├── options.html           # Extension configuration page
│   ├── options.css            # Settings styling
│   └── options.js             # Local storage persistence
├── utils/
│   ├── constants.js           # Global constants & message protocol
│   └── logger.js              # Prefixed console logger
└── assets/
    └── icons/                 # Crisp 16px, 32px, 48px, 128px PNG icon set
```

---

## ⚖️ Disclaimer

DeepGuard provides automated risk indicators of potential synthetic facial manipulation. Results are probabilistic forensic indicators intended to assist human verification, not definitive legal proof of fraud or identity theft.
