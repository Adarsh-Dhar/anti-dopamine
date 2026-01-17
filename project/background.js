// CONFIGURATION
const DECAY_RATE = 0.05;       // How much score drops per second when calm
const GROWTH_MULTIPLIER = 0.5; // How fast score rises (Tweak this!)
const MAX_SCORE = 10000;       // Cap the score if needed

// STATE (Cached in memory for speed, synced to storage)
let currentBrainrot = 0;
let lastUpdate = Date.now();

// Load initial state from storage
chrome.storage.local.get(['brainrotScore'], (result) => {
  if (result.brainrotScore) {
    currentBrainrot = parseFloat(result.brainrotScore);
  }
});

// 1. Setup Offscreen
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
  // A. HANDLE METRICS FROM OFFSCREEN (The Core Logic)
  if (msg.type === 'METRICS_UPDATE') {
    processMetrics(msg.data);
  }

  // B. HANDLE START TRACKING
  if (msg.type === 'START_TRACKING') {
    handleStartTracking(msg.tabId);
  }

  // C. HANDLE AI ANALYSIS (From Offscreen -> Server)
  if (msg.type === 'ANALYZE_SEMANTIC') {
    handleSemanticAnalysis(msg.data.image);
  }

  // D. Handle Offscreen Logs (Optional debugging)
  if (msg.type === 'OFFSCREEN_LOG') {
    console.log(`[Offscreen] ${msg.message}`);
  }
  
  if (msg.type === 'OFFSCREEN_ERROR') {
    console.error(`[Offscreen Error] ${msg.message}`);
  }
});

// CORE LOGIC: Calculate Accumulation
function processMetrics(data) {
  const now = Date.now();
  const timeDelta = (now - lastUpdate) / 1000; // Seconds since last update
  lastUpdate = now;

  // 1. Calculate "Instant Dopamine" (Intensity of this exact second)
  // Formula: High Motion + Loud Audio + Rapid Cuts + High BPM = BIG NUMBER
  const instantDopamine = 
    (data.motion * 20) +       // Motion is strongest signal (0-1 -> 0-20)
    (data.loudness * 0.1) +    // Loudness (0-255 -> 0-25)
    (data.cutsPerMinute * 2) + // Each cut adds pressure
    (data.bpm * 0.05);         // Fast tempo adds pressure

  // 2. Determine Change (Growth or Decay)
  let change = 0;

  if (instantDopamine > 5) {
    // HIGH STIMULATION -> Increase Score
    // The higher the dopamine, the faster it grows (Exponential-ish)
    change = (instantDopamine * GROWTH_MULTIPLIER * timeDelta);
  } else {
    // LOW STIMULATION -> Decrease Score (Recovery)
    change = -(DECAY_RATE * timeDelta);
  }

  // 3. Update State
  currentBrainrot += change;
  
  // Boundaries (Can't go below 0)
  if (currentBrainrot < 0) currentBrainrot = 0;
  if (currentBrainrot > MAX_SCORE) currentBrainrot = MAX_SCORE;

  // 4. Save & Broadcast (Debounce storage to save writes if needed, but 1s is fine)
  const formattedScore = parseFloat(currentBrainrot.toFixed(2));
  
  chrome.storage.local.set({ brainrotScore: formattedScore });
  
  // Send "Live" update to UI
  chrome.runtime.sendMessage({
    type: 'SCORE_UPDATE',
    data: {
      score: formattedScore,
      instantParams: data // Send raw stats for debug/graphs
    }
  }).catch(() => {}); // Ignore error if popup is closed
}

// Helper: Logic to start tracking a tab
async function handleStartTracking(tabId) {
  try {
    const streamId = await chrome.tabCapture.getMediaStreamId({ targetTabId: tabId });
    await ensureOffscreen();
    setTimeout(() => {
      chrome.runtime.sendMessage({ type: 'START_STREAM_ANALYSIS', data: { streamId } });
    }, 500);
  } catch (e) {
    if (e.message && e.message.includes("active stream")) {
      chrome.runtime.sendMessage({
        type: 'TRACKING_ERROR',
        message: 'Please reload the YouTube page to reset the tracker.'
      });
    } else {
      console.error(e);
    }
  }
}

async function handleSemanticAnalysis(imageBase64) {
  try {
    const response = await fetch('http://localhost:3001/api/analyze-frame', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64 })
    });
    const result = await response.json();
    
    if (result.success && result.data.score) {
       // AI detected Brainrot! Add a massive spike.
       const aiSpike = result.data.score * 0.5; 
       currentBrainrot += aiSpike;
       console.log(`🤖 AI Spike Applied: +${aiSpike}`);
    }
  } catch(e) { console.error(e); }
}