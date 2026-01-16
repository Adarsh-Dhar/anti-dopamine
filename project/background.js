// Listen for wallet connection messages from the UI
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'WALLET_CONNECTED') {
    const { walletAddress, delegationSignature } = msg.payload;
    console.log('[Background] Received wallet:', walletAddress);
    chrome.storage.local.set({
      walletAddress: walletAddress,
      isDelegated: true,
      delegationSignature: delegationSignature || null
    }, () => {
      console.log('[Background] Wallet saved to storage.');
      sendResponse({ success: true });
    });
    return true; // Keep channel open for async response
  }
});


// Ensure offscreen document exists
async function ensureOffscreen() {
  if (await chrome.offscreen.hasDocument()) return;
  await chrome.offscreen.createDocument({
    url: 'offscreen.html',
    reasons: ['AUDIO_PLAYBACK', 'DISPLAY_MEDIA'],
    justification: 'Analyze video stream for metrics.'
  });
}

chrome.runtime.onMessage.addListener(async (msg, sender) => {
  if (msg.type === 'START_TRACKING') {
    const tabId = msg.tabId;
    console.log(`[Background] Received START_TRACKING for Tab ID: ${tabId}`);

    try {
      // 1. Get the Media Stream ID
      // This ID grants access to BOTH Audio and Video of the tab
      // FIX: Removed 'consumerTabId'. Now the offscreen document can access it!
      const streamId = await chrome.tabCapture.getMediaStreamId({ 
        targetTabId: tabId 
      });
      console.log("[Background] Got Stream ID:", streamId);

      // 2. Launch Offscreen
      await ensureOffscreen();

      // 3. Send Stream ID to Offscreen to start processing
      chrome.runtime.sendMessage({
        type: 'START_STREAM_ANALYSIS',
        data: { streamId }
      });
      
    } catch (err) {
      // Handle the "Stream already active" error gracefully
      if (err.message && err.message.includes("active stream")) {
        console.error("[Background] Stream active. User must reload page.");
        chrome.runtime.sendMessage({
          type: 'TRACKING_ERROR',
          message: 'Please reload the YouTube page to reset the tracker.'
        });
      } else {
        console.error("[Background] Error:", err);
      }
    }
  }
});

