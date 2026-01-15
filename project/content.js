// src/content.js
// Listens for requests from the background script to locate the video element
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "GET_VIDEO_COORDS") {
    try {
      const video = document.querySelector("video");
      if (!video) {
        console.warn('[Content] No video element found on page!');
        sendResponse(null);
        return;
      }
      const rect = video.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      sendResponse({
        x: rect.x * dpr,
        y: rect.y * dpr,
        width: rect.width * dpr,
        height: rect.height * dpr
      });
    } catch (err) {
      console.error('[Content] Error handling GET_VIDEO_COORDS:', err);
      sendResponse(null);
    }
  } else {
    console.warn('[Content] Unknown message type:', request.type, request);
  }
});
