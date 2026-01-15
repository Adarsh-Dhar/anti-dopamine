

// Ensure offscreen document exists
async function ensureOffscreen() {
  if (await chrome.offscreen.hasDocument()) return;
  await chrome.offscreen.createDocument({
    url: 'offscreen.html',
    reasons: ['AUDIO_PLAYBACK', 'DISPLAY_MEDIA'],
    justification: 'Analyze video stream for metrics.'
  });
}

// Global state to track tracking intervals per tab
// Key: tabId, Value: { intervalId, streamId (optional) }
const activeTrackers = {};

chrome.runtime.onMessage.addListener(async (msg, sender) => {
  if (msg.type === 'START_TRACKING') {
    const tabId = msg.tabId;
    console.log(`[Background] Received START_TRACKING for Tab ID: ${tabId}`);

    try {
      // -----------------------------------------------------------
      // FIX 1: STOP PREVIOUS TRACKING
      // If we are already tracking this tab, stop the old interval
      // and let the user restart. We can't easily "stop" the tabCapture
      // stream remotely without reloading, but we can stop our processing.
      // -----------------------------------------------------------
      if (activeTrackers[tabId]) {
        console.log(`[Background] Stopping existing tracker for tab ${tabId}`);
        clearInterval(activeTrackers[tabId].intervalId);
        delete activeTrackers[tabId];
        // Note: The actual media stream typically persists until the page is closed/reloaded
        // or the user clicks the "Stop sharing" banner. Handling stream cleanup programmatically
        // is very difficult in Extensions without reloading the page.
      }

      // -----------------------------------------------------------
      // FIX 2: GET WINDOW ID
      // Service workers fail with 'null' windowId. We must be explicit.
      // -----------------------------------------------------------
      const tab = await chrome.tabs.get(tabId);
      const windowId = tab.windowId;

      // 1. Get Stream ID for Audio
      // If this throws "Cannot capture a tab with an active stream", it means
      // the previous stream is still alive. The user effectively has to reload the tab.
      let streamId;
      try {
        streamId = await chrome.tabCapture.getMediaStreamId({ targetTabId: tabId });
      } catch (streamErr) {
        if (streamErr.message && streamErr.message.includes("active stream")) {
           console.error("[Background] Stream already active. Please reload the YouTube page to reset capture permissions.");
           // Optional: You could reload the tab programmatically here:
           // await chrome.tabs.reload(tabId);
           return;
        }
        throw streamErr;
      }
      
      // 2. Launch Offscreen
      await ensureOffscreen();

      // 3. Initialize Audio in Offscreen
      chrome.runtime.sendMessage({
        type: 'INIT_AUDIO',
        data: { streamId }
      });
      console.log("[Background] Audio initialized.");

      // 4. START THE VISUAL LOOP (1 FPS)
      console.log("[Background] Starting visual capture loop...");
      
      const intervalId = setInterval(async () => {
        try {
          // Capture the specific window belonging to the tab
          const dataUrl = await chrome.tabs.captureVisibleTab(windowId, { 
            format: 'jpeg', 
            quality: 50 
          });
          
          // Send to Offscreen for processing
          chrome.runtime.sendMessage({
            type: 'PROCESS_FRAME',
            data: { 
              image: dataUrl,
              timestamp: Date.now()
            }
          });
          
        } catch (e) {
          console.log("Capture failed (User minimized window or permission issue):", e);
          // We generally don't stop the loop just for one failed frame (e.g. while minimized)
        }
      }, 1000); 

      // Save the interval so we can stop it later
      activeTrackers[tabId] = { intervalId };

    } catch (err) {
      console.error("[Background] Error starting tracker:", err);
    }
  }
});
