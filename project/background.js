// project/background.js

// CONFIGURATION
const DECAY_RATE = 2.0;        // INCREASED: Drop score faster when calm (was 0.05)
const GROWTH_MULTIPLIER = 0.5; // How fast score rises
const MAX_SCORE = 10000;       

// STATE
let currentBrainrot = 0;
let lastUpdate = Date.now();

// Load initial state
chrome.storage.local.get(['brainrotScore'], (result) => {
  if (result.brainrotScore) {
    currentBrainrot = parseFloat(result.brainrotScore);
  }
});

async function ensureOffscreen() {
  if (await chrome.offscreen.hasDocument()) return;
  await chrome.offscreen.createDocument({
    url: 'offscreen.html',
    reasons: ['AUDIO_PLAYBACK', 'DISPLAY_MEDIA'],
    justification: 'Analyze video stream for metrics.'
  });
}

// MESSAGING
chrome.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
  if (message.type === 'WALLET_CONNECTED') {
    console.log("[Background] Wallet:", message.publicKey);
    chrome.storage.local.set({ walletPublicKey: message.publicKey, isConnected: true }, () => {
      sendResponse({ success: true });
    });
    return true; 
  }
  if (message.type === 'ALLOWANCE_CONFIRMED') {
    chrome.storage.local.set({ allowanceConfirmed: true });
    sendResponse({ success: true });
    return true;
  }
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'METRICS_UPDATE') processMetrics(msg.data);
  if (msg.type === 'START_TRACKING') handleStartTracking(msg.tabId);
  if (msg.type === 'ANALYZE_SEMANTIC') handleSemanticAnalysis(msg.data.image);
});

// --------------------------------------------------------------------------
// CORE LOGIC FIX: "The Guard Clause"
// --------------------------------------------------------------------------
function processMetrics(data) {
  const now = Date.now();
  const timeDelta = (now - lastUpdate) / 1000; 
  lastUpdate = now;

  // FIX: Detect if video is "Idle" (Paused, Static, or Muted)
  // Thresholds: Motion < 1% change, Loudness < 5/255
  const isIdle = data.motion < 0.01 && data.loudness < 5;

  let instantDopamine = 0;

  if (isIdle) {
    // If Idle, force Dopamine to 0 (Ignore historical Cuts/BPM)
    instantDopamine = 0;
  } else {
    // Only calculate score if content is ACTUALLY playing
    instantDopamine = 
      (data.motion * 20) +       
      (data.loudness * 0.1) +    
      (data.cutsPerMinute * 2) + // Only counts if playing!
      (data.bpm * 0.05);         
  }

  // 2. Determine Change
  let change = 0;

  if (instantDopamine > 5) {
    // Growth
    change = (instantDopamine * GROWTH_MULTIPLIER * timeDelta);
  } else {
    // Decay (Now happens immediately when paused!)
    change = -(DECAY_RATE * timeDelta);
  }

  // 3. Update State
  currentBrainrot += change;
  if (currentBrainrot < 0) currentBrainrot = 0;
  if (currentBrainrot > MAX_SCORE) currentBrainrot = MAX_SCORE;

  // 4. Save & Broadcast
  const formattedScore = parseFloat(currentBrainrot.toFixed(2));
  chrome.storage.local.set({ brainrotScore: formattedScore });
  
  chrome.runtime.sendMessage({
    type: 'SCORE_UPDATE',
    data: {
      score: formattedScore,
      instantParams: data 
    }
  }).catch(() => {});
}

async function handleStartTracking(tabId) {
  try {
    const streamId = await chrome.tabCapture.getMediaStreamId({ targetTabId: tabId });
    await ensureOffscreen();
    setTimeout(() => {
      chrome.runtime.sendMessage({ type: 'START_STREAM_ANALYSIS', data: { streamId } });
    }, 500);
  } catch (e) {
    if (e.message && e.message.includes("active stream")) {
      chrome.runtime.sendMessage({ type: 'TRACKING_ERROR', message: 'Reload YouTube page.' });
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
       const aiSpike = result.data.score * 0.5; 
       currentBrainrot += aiSpike;
    }
  } catch(e) { console.error(e); }
}