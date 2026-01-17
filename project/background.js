// project/background.js

// 1. Setup Offscreen Document (For Audio/Video Analysis)
async function ensureOffscreen() {
  if (await chrome.offscreen.hasDocument()) return;
  await chrome.offscreen.createDocument({
    url: 'offscreen.html',
    reasons: ['AUDIO_PLAYBACK', 'DISPLAY_MEDIA'],
    justification: 'Analyze video stream for metrics.'
  });
}

// 2. LISTEN FOR EXTERNAL MESSAGES (From Localhost Web App)
chrome.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
  // Check if it's the wallet connection message
  if (message.type === 'WALLET_CONNECTED') {
    console.log("[Background] Received wallet from Web App:", message.publicKey);

    // Save to storage
    chrome.storage.local.set({ 
      walletPublicKey: message.publicKey,
      isConnected: true
    }, () => {
      console.log("[Background] Wallet saved to extension storage.");
      // Notify the Web App that we succeeded
      sendResponse({ success: true });
    });

    // CRITICAL: Return true to keep the channel open for the async response above
    return true; 
  }
  // Handle allowance confirmation
  if (message.type === 'ALLOWANCE_CONFIRMED') {
    console.log('[Background] Allowance confirmed for', message.amount, 'USDC');
    // Show a notification or set a flag in storage
    if (chrome.notifications) {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icon.png',
        title: 'Allowance Set',
        message: `Allowance of ${message.amount} USDC set successfully!`
      });
    } else {
      // Fallback: set a flag in storage
      chrome.storage.local.set({ allowanceConfirmed: true });
    }
    sendResponse({ success: true });
    return true;
  }
});

// 3. LISTEN FOR INTERNAL MESSAGES (From Popup or Offscreen)
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  // A. Handle Start Tracking
  if (msg.type === 'START_TRACKING') {
    handleStartTracking(msg.tabId);
  }
  
  // B. Handle Offscreen Logs (Optional debugging)
  if (msg.type === 'OFFSCREEN_LOG') {
    console.log(`[Offscreen] ${msg.message}`);
  }
  
  if (msg.type === 'OFFSCREEN_ERROR') {
    console.error(`[Offscreen Error] ${msg.message}`);
  }
});

// Helper: Logic to start tracking a tab
async function handleStartTracking(tabId) {
  console.log(`[Background] Starting loop for Tab ID: ${tabId}`);
  try {
    // Get Stream ID
    const streamId = await chrome.tabCapture.getMediaStreamId({ 
      targetTabId: tabId 
    });
    console.log("[Background] Got Stream ID:", streamId);

    // Reset and Create Offscreen
    // (Optional: Close old one first to ensure fresh state)
    if (await chrome.offscreen.hasDocument()) {
      await chrome.offscreen.closeDocument();
    }
    await ensureOffscreen();

    // Send Stream ID to Offscreen
    // Wait a tiny bit for the page to load listeners
    setTimeout(() => {
      chrome.runtime.sendMessage({
        type: 'START_STREAM_ANALYSIS',
        data: { streamId }
      });
      console.log("[Background] Sent START_STREAM_ANALYSIS");
    }, 500);
    
  } catch (err) {
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