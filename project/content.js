// src/content.js
// Listens for requests from the background script to locate the video element
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "GET_VIDEO_COORDS") {
    const video = document.querySelector("video");
    if (!video) {
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
  }
});
