// background.js

// Ensure offscreen document exists
async function ensureOffscreen() {
  try {
    if (chrome.offscreen) {
      const existing = await chrome.offscreen.hasDocument();
      if (existing) return;
      await chrome.offscreen.createDocument({
        url: 'offscreen.html',
        reasons: ['AUDIO_PLAYBACK', 'DISPLAY_MEDIA'],
        justification: 'Analyze video stream for metrics.'
      });
    }
  } catch (err) {
    console.error('[Background] Error ensuring offscreen document:', err);
  }
}

// Track active streams per tab
const activeTabStreams = {};

// Listen for message from React Popup
chrome.runtime.onMessage.addListener(async (msg, sender) => {
  if (msg.type === 'START_TRACKING') {
    const tabId = msg.tabId;
    console.log(`[Background] Received START_TRACKING for Tab ID: ${tabId}`);

    if (activeTabStreams[tabId]) {
      console.warn(`[Background] Tab ${tabId} is already being tracked. Cannot start another capture.`);
      return;
    }

    // 1. Get Video Coordinates
    let coordsArr;
    try {
      console.log("[Background] Injecting script to find video...");
      coordsArr = await chrome.scripting.executeScript({
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
    } catch (err) {
      console.error('[Background] Error executing script for video coordinates:', err);
      return;
    }
    if (!coordsArr || !coordsArr[0] || !coordsArr[0].result) {
      console.error("[Background] No video element found on page!", coordsArr);
      return;
    }
    console.log("[Background] Video coordinates found:", coordsArr[0].result);

    // 2. Get Secure Stream ID
    let streamId;
    try {
      console.log("[Background] Requesting MediaStreamId...");
      streamId = await chrome.tabCapture.getMediaStreamId({
        targetTabId: tabId
      });
      // Mark this tab as being tracked
      activeTabStreams[tabId] = true;
    } catch (err) {
      if (err && err.message && err.message.includes('Cannot capture a tab with an active stream')) {
        console.error(`[Background] Tab ${tabId} is already being captured. Please stop the previous capture before starting a new one.`);
      } else {
        console.error('[Background] Error getting MediaStreamId:', err);
      }
      // Clean up tracking state if needed
      delete activeTabStreams[tabId];
      return;
    }
    console.log("[Background] Got Stream ID:", streamId);

    // 3. Launch Offscreen
    try {
      console.log("[Background] Ensuring offscreen document...");
      await ensureOffscreen();
    } catch (err) {
      console.error('[Background] Error ensuring offscreen document:', err);
      // Clean up tracking state if offscreen fails
      delete activeTabStreams[tabId];
      return;
    }

    // 4. Send START_ANALYSIS to offscreen
    try {
      console.log("[Background] Sending START_ANALYSIS to offscreen...");
      chrome.runtime.sendMessage({
        type: 'START_ANALYSIS',
        data: { streamId, coords: coordsArr[0].result }
      });
    } catch (err) {
      console.error('[Background] Error sending START_ANALYSIS to offscreen:', err);
      delete activeTabStreams[tabId];
    }
  }
});
