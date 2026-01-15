// background.js

// Ensure offscreen document exists
async function ensureOffscreen() {
  if (chrome.offscreen) {
    const existing = await chrome.offscreen.hasDocument();
    if (existing) return;
    await chrome.offscreen.createDocument({
      url: 'offscreen.html',
      reasons: ['AUDIO_PLAYBACK', 'DISPLAY_MEDIA'],
      justification: 'Analyze video stream for metrics.'
    });
  }
}

// Listen for message from React Popup
chrome.runtime.onMessage.addListener(async (msg, sender) => {
  if (msg.type === 'START_TRACKING') {
    const tabId = msg.tabId;
    // 1. Get Video Coordinates from Content Script
    const [coords] = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        const video = document.querySelector('video');
        if (!video) return null;
        const rect = video.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        return {
          x: rect.x * dpr,
          y: rect.y * dpr,
          width: rect.width * dpr,
          height: rect.height * dpr
        };
      }
    });
    // 2. Get Secure Stream ID
    const streamId = await chrome.tabCapture.getMediaStreamId({
      targetTabId: tabId
    });
    // 3. Launch Offscreen and pass data
    await ensureOffscreen();
    chrome.runtime.sendMessage({
      type: 'START_ANALYSIS',
      data: { streamId, coords: coords.result }
    });
  }
});
