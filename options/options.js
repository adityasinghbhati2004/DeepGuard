document.addEventListener('DOMContentLoaded', () => {
  const sampleRate = document.getElementById('sampleRate');
  const highThreshold = document.getElementById('highThreshold');
  const highVal = document.getElementById('highVal');
  const showOverlay = document.getElementById('showOverlay');
  const notificationsOn = document.getElementById('notificationsOn');
  const autoStartOnMeet = document.getElementById('autoStartOnMeet');
  const backendUrl = document.getElementById('backendUrl');
  const btnSave = document.getElementById('btnSave');
  const savedMsg = document.getElementById('savedMsg');

  highThreshold.addEventListener('input', () => {
    highVal.textContent = `${highThreshold.value}%`;
  });

  // Load saved settings
  chrome.storage.local.get('deepguard_settings', (res) => {
    const s = res.deepguard_settings || {};
    if (s.sampleIntervalMs) sampleRate.value = s.sampleIntervalMs;
    if (s.highThreshold) {
      highThreshold.value = s.highThreshold;
      highVal.textContent = `${s.highThreshold}%`;
    }
    if (s.showOverlay !== undefined) showOverlay.checked = s.showOverlay;
    if (s.notificationsOn !== undefined) notificationsOn.checked = s.notificationsOn;
    if (s.autoStartOnMeet !== undefined) autoStartOnMeet.checked = s.autoStartOnMeet;
    if (s.backendUrl) backendUrl.value = s.backendUrl;
  });

  // Save settings
  btnSave.addEventListener('click', () => {
    const s = {
      sampleIntervalMs: parseInt(sampleRate.value, 10),
      highThreshold: parseInt(highThreshold.value, 10),
      showOverlay: showOverlay.checked,
      notificationsOn: notificationsOn.checked,
      autoStartOnMeet: autoStartOnMeet.checked,
      backendUrl: backendUrl.value.trim()
    };

    chrome.storage.local.set({ deepguard_settings: s }, () => {
      savedMsg.classList.add('visible');
      setTimeout(() => savedMsg.classList.remove('visible'), 2500);
    });
  });
});
