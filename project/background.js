// project/background.js

// --- CONFIGURATION ---
const DECAY_RATE = 2.0;       
const GROWTH_MULTIPLIER = 0.5; 
const MAX_SCORE = 10000;       
const POINTS_PER_STEP = 100;   
const SYNC_THRESHOLD = 0.000001; 

// --- STATE ---
let currentBrainrot = 0;
let lastUpdate = Date.now();

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
    chrome.storage.local.set({ walletPublicKey: message.publicKey, isConnected: true });
    sendResponse({ success: true });
    return true; 
  }
  if (message.type === 'ALLOWANCE_CONFIRMED') {
    console.log("[Background] ✅ Allowance Confirmed:", message.amount);
    chrome.storage.local.set({ allowanceAmount: message.amount, cumulativeSlashed: 0 });
    sendResponse({ success: true });
    return true;
  }
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  let handled = false;
  if (msg.type === 'METRICS_UPDATE') { processMetrics(msg.data); handled = true; }
  if (msg.type === 'START_TRACKING') { handleStartTracking(msg.tabId); handled = true; }
  if (msg.type === 'ANALYZE_SEMANTIC') { handleSemanticAnalysis(msg.data.image); handled = true; }
  if (handled) sendResponse({ success: true });
  else sendResponse();
  return false; 
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
  
  chrome.runtime.sendMessage({
    type: 'SCORE_UPDATE',
    data: { score: formattedScore, instantParams: data }
  }).catch(() => {});

  reconcileFinances(formattedScore);
}

// --- FINANCIAL LOGIC (LOUD DEBUG MODE) ---
let isTransacting = false; 
let lastLogTime = 0;

async function reconcileFinances(score) {
  if (isTransacting) return;

  // 1. FRESH DATA FETCH
  const state = await chrome.storage.local.get(['walletPublicKey', 'allowanceAmount', 'cumulativeSlashed']);
  const walletPublicKey = state.walletPublicKey;
  const totalAllowance = parseFloat(state.allowanceAmount || 0);
  let cumulativeSlashed = parseFloat(state.cumulativeSlashed ?? 0);

  // 🛑 DEBUG CHECK 1: Do we have a wallet?
  if (!walletPublicKey || totalAllowance <= 0) {
    // Only log this error once every 5 seconds to avoid spamming
    if (Date.now() - lastLogTime > 5000) {
      console.error(`[Finance Error] 🛑 STOPPED! Wallet: ${!!walletPublicKey}, Allowance: ${totalAllowance}. GO TO SETUP PAGE & APPROVE 10 USDC!`);
      lastLogTime = Date.now();
    }
    return;
  }

  // 2. STEP CALCULATIONS
  const currentStep = Math.floor(score / POINTS_PER_STEP);
  const totalSteps = MAX_SCORE / POINTS_PER_STEP; 
  const targetLocked = (currentStep / totalSteps) * totalAllowance;
  const delta = targetLocked - cumulativeSlashed;

  // 🛑 DEBUG CHECK 2: Is the change big enough?
  if (Math.abs(delta) < SYNC_THRESHOLD) {
    // console.log(`[Finance Skip] Score ${score} (Step ${currentStep}) -> No change needed.`);
    return;
  }

  // 3. EXECUTE TRANSACTION
  isTransacting = true; 

  try {
    console.log(`[Finance] 🔔 TRIGGER: Score ${score} passed Step ${currentStep}. Moving ${delta.toFixed(6)} USDC...`);

    let response;
    let type = "";

    if (delta > 0) {
      type = "SLASH";
      response = await fetch('http://localhost:3001/api/slash', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userPublicKey: walletPublicKey, amount: delta })
      });
      cumulativeSlashed += delta;
    } else {
      type = "REFUND";
      const refundAmount = Math.abs(delta);
      response = await fetch('http://localhost:3001/api/refund', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userPublicKey: walletPublicKey, amount: refundAmount })
      });
      cumulativeSlashed -= refundAmount;
    }

    const result = await response.json();

    if (result.success) {
      const txHash = result.tx ? result.tx.signature : "No Hash";
      console.log(`[Finance] ✅ SUCCESS [${type}] | Amount: ${Math.abs(delta).toFixed(6)} | TX: ${txHash}`);
      await chrome.storage.local.set({ cumulativeSlashed: cumulativeSlashed });
    } else {
      console.error(`[Finance] ❌ SERVER ERROR:`, result.error);
    }

  } catch (e) {
    console.error("[Finance] ❌ NETWORK ERROR:", e);
  } finally {
    isTransacting = false; 
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