// project/background.js

// --- CONSTANTS ---
const DECAY_RATE = 2.0;       
const GROWTH_MULTIPLIER = 0.5; 
const MAX_SCORE = 10000;       
const SYNC_THRESHOLD = 0.0001; 

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
    // Send back current state immediately for instant sync
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
  if (msg.type === 'METRICS_UPDATE') processMetrics(msg.data);
  if (msg.type === 'START_TRACKING') {
    handleStartTracking(msg.tabId)
      .then(() => sendResponse({ success: true }))
      .catch((e) => sendResponse({ success: false, error: e?.message || String(e) }));
    return true; // Indicate async response
  }
  if (msg.type === 'ANALYZE_SEMANTIC') handleSemanticAnalysis(msg.data.image);
});

// --- CORE LOGIC (With Sync) ---
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
  
  // 1. Update Extension Popup
  chrome.runtime.sendMessage({
    type: 'SCORE_UPDATE',
    data: { score: formattedScore, instantParams: data }
  }).catch(() => {});

  // 2. BROADCAST TO WEB APP (Localhost)
  // This pushes the state to your dashboard every second
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

// --- FINANCE LOGIC ---
let isTransacting = false; 
async function reconcileFinances(score) {
  if (!walletPublicKey || totalAllowance <= 0 || isTransacting) return;

  const targetLocked = totalAllowance * (score / MAX_SCORE);
  const delta = targetLocked - cumulativeSlashed;

  if (Math.abs(delta) < SYNC_THRESHOLD) return;

  isTransacting = true; 
  try {
    if (delta > 0) {
      console.log(`[Finance] Slashing ${delta.toFixed(4)} USDC`);
      await fetch('http://localhost:3001/api/slash', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userPublicKey: walletPublicKey, amount: delta })
      });
      cumulativeSlashed += delta;
    } else {
      const refundAmount = Math.abs(delta);
      console.log(`[Finance] Refunding ${refundAmount.toFixed(4)} USDC`);
      await fetch('http://localhost:3001/api/refund', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userPublicKey: walletPublicKey, amount: refundAmount })
      });
      cumulativeSlashed -= refundAmount;
    }
    chrome.storage.local.set({ cumulativeSlashed });
  } catch (e) {
    console.error("[Finance] Transaction Failed:", e);
  } finally {
    isTransacting = false; 
  }
}

// --- HELPERS ---
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