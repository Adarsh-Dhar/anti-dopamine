// project/background.js

// project/background.js

// CONFIGURATION


// Load initial state
chrome.storage.local.get(['brainrotScore', 'allowanceAmount', 'cumulativeSlashed', 'walletPublicKey'], (res) => {
  if (res.brainrotScore) currentBrainrot = parseFloat(res.brainrotScore);
  if (res.allowanceAmount) totalAllowance = parseFloat(res.allowanceAmount);
  if (res.cumulativeSlashed) cumulativeSlashed = parseFloat(res.cumulativeSlashed);
  if (res.walletPublicKey) walletPublicKey = res.walletPublicKey;
});

// ... (Keep ensureOffscreen and message listeners same as before) ...
async function ensureOffscreen() {
  if (await chrome.offscreen.hasDocument()) return;
  await chrome.offscreen.createDocument({
    url: 'offscreen.html',
    reasons: ['AUDIO_PLAYBACK', 'DISPLAY_MEDIA'],
    justification: 'Analyze video stream for metrics.'
  });
}

chrome.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
  if (message.type === 'WALLET_CONNECTED') {
    walletPublicKey = message.publicKey;
    chrome.storage.local.set({ walletPublicKey, isConnected: true });
    sendResponse({ success: true });
    return true; 
  }
  // NEW: Capture Allowance Amount when set
  if (message.type === 'ALLOWANCE_CONFIRMED') {
    totalAllowance = message.amount; // e.g., 5 USDC
    cumulativeSlashed = 0; // Reset history on new session
    chrome.storage.local.set({ allowanceAmount: totalAllowance, cumulativeSlashed: 0 });
    sendResponse({ success: true });
    return true;
  }
});

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'METRICS_UPDATE') processMetrics(msg.data);
  if (msg.type === 'START_TRACKING') handleStartTracking(msg.tabId);
  if (msg.type === 'ANALYZE_SEMANTIC') handleSemanticAnalysis(msg.data.image);
});

// CORE LOGIC + FINANCIAL RECONCILIATION
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

  // Save Score
  const formattedScore = parseFloat(currentBrainrot.toFixed(2));
  chrome.storage.local.set({ brainrotScore: formattedScore });
  
  // Update UI
  chrome.runtime.sendMessage({
    type: 'SCORE_UPDATE',
    data: { score: formattedScore, instantParams: data }
  }).catch(() => {});

  // ---------------------------------------------
  // FINANCIAL LOGIC (The Peg)
  // ---------------------------------------------
  reconcileFinances(formattedScore);
}

// Debounce flag to prevent API spam
let isTransacting = false; 

async function reconcileFinances(score) {
  if (!walletPublicKey || totalAllowance <= 0 || isTransacting) return;

  // 1. Calculate Target Locked Amount
  // Formula: Locked = Total * (Score / Max)
  const targetLocked = totalAllowance * (score / MAX_SCORE);

  // 2. Calculate Delta (Difference from actual)
  const delta = targetLocked - cumulativeSlashed;

  // 3. Check Threshold (Don't spam for 0.0001 USDC)
  if (Math.abs(delta) < SYNC_THRESHOLD) return;

  isTransacting = true; // Lock

  try {
    if (delta > 0) {
      // SLASH (Score went UP, we need to take more)
      console.log(`[Finance] Slashing ${delta.toFixed(4)} USDC`);
      await fetch('http://localhost:3001/api/slash', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userPublicKey: walletPublicKey, amount: delta })
      });
      cumulativeSlashed += delta;

    } else {
      // REFUND (Score went DOWN, give back money)
      const refundAmount = Math.abs(delta);
      console.log(`[Finance] Refunding ${refundAmount.toFixed(4)} USDC`);
      await fetch('http://localhost:3001/api/refund', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userPublicKey: walletPublicKey, amount: refundAmount })
      });
      cumulativeSlashed -= refundAmount;
    }

    // Update Storage
    chrome.storage.local.set({ cumulativeSlashed });

  } catch (e) {
    console.error("[Finance] Transaction Failed:", e);
  } finally {
    isTransacting = false; // Unlock
  }
}

async function handleStartTracking(tabId) {
    // ... (Your existing logic) ...
    try {
        const streamId = await chrome.tabCapture.getMediaStreamId({ targetTabId: tabId });
        await ensureOffscreen();
        setTimeout(() => {
          chrome.runtime.sendMessage({ type: 'START_STREAM_ANALYSIS', data: { streamId } });
        }, 500);
      } catch (e) { console.error(e); }
}

async function handleSemanticAnalysis(imageBase64) {
    // ... (Your existing logic) ...
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


// Load initial state
chrome.storage.local.get(['brainrotScore', 'allowanceAmount', 'cumulativeSlashed', 'walletPublicKey'], (res) => {
  if (res.brainrotScore) currentBrainrot = parseFloat(res.brainrotScore);
  if (res.allowanceAmount) totalAllowance = parseFloat(res.allowanceAmount);
  if (res.cumulativeSlashed) cumulativeSlashed = parseFloat(res.cumulativeSlashed);
  if (res.walletPublicKey) walletPublicKey = res.walletPublicKey;
});

// ... (Keep ensureOffscreen and message listeners same as before) ...
async function ensureOffscreen() {
  if (await chrome.offscreen.hasDocument()) return;
  await chrome.offscreen.createDocument({
    url: 'offscreen.html',
    reasons: ['AUDIO_PLAYBACK', 'DISPLAY_MEDIA'],
    justification: 'Analyze video stream for metrics.'
  });
}

chrome.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
  if (message.type === 'WALLET_CONNECTED') {
    walletPublicKey = message.publicKey;
    chrome.storage.local.set({ walletPublicKey, isConnected: true });
    sendResponse({ success: true });
    return true; 
  }
  // NEW: Capture Allowance Amount when set
  if (message.type === 'ALLOWANCE_CONFIRMED') {
    totalAllowance = message.amount; // e.g., 5 USDC
    cumulativeSlashed = 0; // Reset history on new session
    chrome.storage.local.set({ allowanceAmount: totalAllowance, cumulativeSlashed: 0 });
    sendResponse({ success: true });
    return true;
  }
});

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'METRICS_UPDATE') processMetrics(msg.data);
  if (msg.type === 'START_TRACKING') handleStartTracking(msg.tabId);
  if (msg.type === 'ANALYZE_SEMANTIC') handleSemanticAnalysis(msg.data.image);
});

// CORE LOGIC + FINANCIAL RECONCILIATION
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

  // Save Score
  const formattedScore = parseFloat(currentBrainrot.toFixed(2));
  chrome.storage.local.set({ brainrotScore: formattedScore });
  
  // Update UI
  chrome.runtime.sendMessage({
    type: 'SCORE_UPDATE',
    data: { score: formattedScore, instantParams: data }
  }).catch(() => {});

  // ---------------------------------------------
  // FINANCIAL LOGIC (The Peg)
  // ---------------------------------------------
  reconcileFinances(formattedScore);
}

// Debounce flag to prevent API spam


async function reconcileFinances(score) {
  if (!walletPublicKey || totalAllowance <= 0 || isTransacting) return;

  // 1. Calculate Target Locked Amount
  // Formula: Locked = Total * (Score / Max)
  const targetLocked = totalAllowance * (score / MAX_SCORE);

  // 2. Calculate Delta (Difference from actual)
  const delta = targetLocked - cumulativeSlashed;

  // 3. Check Threshold (Don't spam for 0.0001 USDC)
  if (Math.abs(delta) < SYNC_THRESHOLD) return;

  isTransacting = true; // Lock

  try {
    if (delta > 0) {
      // SLASH (Score went UP, we need to take more)
      console.log(`[Finance] Slashing ${delta.toFixed(4)} USDC`);
      await fetch('http://localhost:3001/api/slash', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userPublicKey: walletPublicKey, amount: delta })
      });
      cumulativeSlashed += delta;

    } else {
      // REFUND (Score went DOWN, give back money)
      const refundAmount = Math.abs(delta);
      console.log(`[Finance] Refunding ${refundAmount.toFixed(4)} USDC`);
      await fetch('http://localhost:3001/api/refund', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userPublicKey: walletPublicKey, amount: refundAmount })
      });
      cumulativeSlashed -= refundAmount;
    }

    // Update Storage
    chrome.storage.local.set({ cumulativeSlashed });

  } catch (e) {
    console.error("[Finance] Transaction Failed:", e);
  } finally {
    isTransacting = false; // Unlock
  }
}

async function handleStartTracking(tabId) {
    // ... (Your existing logic) ...
    try {
        const streamId = await chrome.tabCapture.getMediaStreamId({ targetTabId: tabId });
        await ensureOffscreen();
        setTimeout(() => {
          chrome.runtime.sendMessage({ type: 'START_STREAM_ANALYSIS', data: { streamId } });
        }, 500);
      } catch (e) { console.error(e); }
}

async function handleSemanticAnalysis(imageBase64) {
    // ... (Your existing logic) ...
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