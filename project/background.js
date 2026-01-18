// project/background.js

// --- CONFIGURATION ---
const DECAY_RATE = 2.0;       
const GROWTH_MULTIPLIER = 0.5; 
const MAX_SCORE = 10000;       
const POINTS_PER_STEP = 100;   // Granularity: Move money every 100 points
const SYNC_THRESHOLD = 0.000001; // Tiny threshold to handle floating point math

// --- STATE ---
let currentBrainrot = 0;
let lastUpdate = Date.now();
let totalAllowance = 0;
let cumulativeSlashed = 0;
let walletPublicKey = null;

// Load initial state
chrome.storage.local.get(['brainrotScore', 'allowanceAmount', 'cumulativeSlashed', 'walletPublicKey'], (res) => {
  if (res.brainrotScore) currentBrainrot = parseFloat(res.brainrotScore);
  if (res.allowanceAmount) totalAllowance = parseFloat(res.allowanceAmount);
  if (res.cumulativeSlashed) cumulativeSlashed = parseFloat(res.cumulativeSlashed);
  if (res.walletPublicKey) walletPublicKey = res.walletPublicKey;
});

// --- SETUP ---
let offscreenCreating = false;
async function ensureOffscreen() {
  if (await chrome.offscreen.hasDocument()) return;
  if (offscreenCreating) return;
  offscreenCreating = true;
  try {
    await chrome.offscreen.createDocument({
      url: 'offscreen.html',
      reasons: ['AUDIO_PLAYBACK', 'DISPLAY_MEDIA'],
      justification: 'Analyze video stream for metrics.'
    });
  } finally {
    offscreenCreating = false;
  }
}

// --- MESSAGING ---
chrome.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
  if (message.type === 'WALLET_CONNECTED') {
    walletPublicKey = message.publicKey;
    chrome.storage.local.set({ walletPublicKey, isConnected: true });
    // Send back sync state instantly
    sendResponse({ 
      success: true, 
      syncState: { totalAllowance, cumulativeSlashed, currentBrainrot } 
    });
    return true; 
  }
  if (message.type === 'ALLOWANCE_CONFIRMED') {
    totalAllowance = message.amount;
    cumulativeSlashed = 0;
    chrome.storage.local.set({ allowanceAmount: totalAllowance, cumulativeSlashed: 0 });
    sendResponse({ success: true });
    return true;
  }
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  let handled = false;
  if (msg.type === 'METRICS_UPDATE') { processMetrics(msg.data); handled = true; }
  if (msg.type === 'START_TRACKING') { handleStartTracking(msg.tabId); handled = true; }
  if (msg.type === 'ANALYZE_SEMANTIC') { handleSemanticAnalysis(msg.data.image); handled = true; }
  // Always send a response to avoid port closed error
  if (handled) sendResponse({ success: true });
  else sendResponse();
  return false; // not async
});

// --- CORE LOGIC ---
function processMetrics(data) {
  const now = Date.now();
  const timeDelta = (now - lastUpdate) / 1000; 
  lastUpdate = now;

  const isIdle = data.motion < 0.01 && data.loudness < 5;
  let instantDopamine = isIdle ? 0 : (data.motion * 20) + (data.loudness * 0.1) + (data.cutsPerMinute * 2) + (data.bpm * 0.05);

  let change = 0;
  if (instantDopamine > 5) {
    change = (instantDopamine * GROWTH_MULTIPLIER * timeDelta);
  } else {
    change = -(DECAY_RATE * timeDelta);
  }

  currentBrainrot += change;
  if (currentBrainrot < 0) currentBrainrot = 0;
  if (currentBrainrot > MAX_SCORE) currentBrainrot = MAX_SCORE;

  const formattedScore = parseFloat(currentBrainrot.toFixed(2));
  chrome.storage.local.set({ brainrotScore: formattedScore });
  
  // 1. Update Popup
  chrome.runtime.sendMessage({
    type: 'SCORE_UPDATE',
    data: { score: formattedScore, instantParams: data }
  }).catch(() => {});

  // 2. Sync to Web App
  const fullSyncState = {
    score: formattedScore,
    metrics: data,
    finance: {
      allowance: totalAllowance,
      slashed: cumulativeSlashed,
      remaining: Math.max(0, totalAllowance - cumulativeSlashed)
    },
    wallet: walletPublicKey
  };

  chrome.tabs.query({ url: ["http://localhost:5173/*", "http://127.0.0.1:5173/*"] }, (tabs) => {
    tabs.forEach(tab => {
      chrome.tabs.sendMessage(tab.id, {
        type: 'EXTENSION_SYNC',
        payload: fullSyncState
      }).catch(() => {}); 
    });
  });

  reconcileFinances(formattedScore);
}

// --- NEW "STEP" FINANCE LOGIC ---
let isTransacting = false; 

async function reconcileFinances(score) {
  if (!walletPublicKey || totalAllowance <= 0 || isTransacting) return;

  // 1. Determine which "Step" we are on (0 to 100)
  const currentStep = Math.floor(score / POINTS_PER_STEP);
  const totalSteps = MAX_SCORE / POINTS_PER_STEP; // 100 steps

  // 2. Calculate Target Locked Amount based on Step
  // Formula: (CurrentStep / 100) * TotalAllowance
  const targetLocked = (currentStep / totalSteps) * totalAllowance;

  // 3. Calculate Delta (Difference from what we already took)
  const delta = targetLocked - cumulativeSlashed;

  // 4. Filter out tiny floating point noises
  // We ONLY act if the delta is significant (meaning we changed a full step)
  // For 0.1 USDC allowance, one step is 0.001. We check if delta is close to that.
  if (Math.abs(delta) < SYNC_THRESHOLD) return;

  isTransacting = true; // Lock

  try {
    if (delta > 0) {
      // SLASH (Score increased to next 100-point bracket)
      console.log(`[Finance] Step Up! Slashing ${delta.toFixed(6)} USDC`);
      await fetch('http://localhost:3001/api/slash', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userPublicKey: walletPublicKey, amount: delta })
      });
      cumulativeSlashed += delta;

    } else {
      // REFUND (Score dropped to lower 100-point bracket)
      const refundAmount = Math.abs(delta);
      console.log(`[Finance] Step Down! Refunding ${refundAmount.toFixed(6)} USDC`);
      await fetch('http://localhost:3001/api/refund', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userPublicKey: walletPublicKey, amount: refundAmount })
      });
      cumulativeSlashed -= refundAmount;
    }

    // Save accurate state
    chrome.storage.local.set({ cumulativeSlashed });

  } catch (e) {
    console.error("[Finance] Transaction Failed:", e);
  } finally {
    isTransacting = false; // Unlock
  }
}

async function handleStartTracking(tabId) {
    try {
        await ensureOffscreen();
        const streamId = await chrome.tabCapture.getMediaStreamId({ targetTabId: tabId });
        setTimeout(() => {
          chrome.runtime.sendMessage({ type: 'START_STREAM_ANALYSIS', data: { streamId } });
        }, 500);
    } catch (e) { console.error(e); }
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
           currentBrainrot += (result.data.score * 0.5); 
        }
      } catch(e) { console.error(e); }
}