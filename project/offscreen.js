// project/offscreen.js

let videoElement = null;
let canvas = null;
let ctx = null;
let audioCtx = null;
let analyser = null;
let previousPixelData = null;
let analysisInterval = null;

// METRIC STATE (Sliding Windows)
let cutTimestamps = [];  // Stores timestamps of scene cuts
let beatTimestamps = []; // Stores timestamps of audio beats
let lastCutTime = 0;
let lastBeatTime = 0;
let lastAiCheck = 0;

// CONFIG
const CUT_THRESHOLD = 0.4; // 40% pixel change = New Scene
const CUT_COOLDOWN = 500;  // ms between cuts
const BEAT_THRESHOLD = 140; // Audio energy threshold (0-255)
const BEAT_COOLDOWN = 250; // Max 240 BPM

chrome.runtime.onMessage.addListener(async (msg) => {
  if (msg.type === 'START_STREAM_ANALYSIS') {
    const { streamId } = msg.data;
    console.log('[Offscreen] Received Stream ID:', streamId);
    try {
      await startLiveStream(streamId);
    } catch (err) {
      console.error('[Offscreen] Error starting stream:', err);
      chrome.runtime.sendMessage({
        type: 'TRACKING_ERROR',
        message: 'Stream Access Denied. Check offscreen console.'
      });
    }
  }
});

async function startLiveStream(streamId) {
  // Clean up any previous state
  if (videoElement) {
    try {
      if (videoElement.srcObject) {
        videoElement.srcObject.getTracks().forEach(t => t.stop());
      }
      videoElement.remove();
    } catch (e) {}
    videoElement = null;
  }
  if (analysisInterval) {
    clearInterval(analysisInterval);
    analysisInterval = null;
  }
  if (audioCtx) {
    try { audioCtx.close(); } catch (e) {}
    audioCtx = null;
  }
  analyser = null;
  previousPixelData = null;

  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        mandatory: { chromeMediaSource: 'tab', chromeMediaSourceId: streamId }
      },
      video: {
        mandatory: {
          chromeMediaSource: 'tab',
          chromeMediaSourceId: streamId,
          maxWidth: 640,
          maxHeight: 360,
          maxFrameRate: 30
        }
      }
    });
  } catch (err) {
    // Clean up and notify background
    chrome.runtime.sendMessage({
      type: 'TRACKING_ERROR',
      message: 'Stream Access Denied or Unavailable. ' + (err && err.message ? err.message : String(err))
    });
    return;
  }

  videoElement = document.createElement('video');
  videoElement.srcObject = stream;
  videoElement.muted = true; 
  videoElement.play();

  audioCtx = new AudioContext();
  const source = audioCtx.createMediaStreamSource(stream);
  analyser = audioCtx.createAnalyser();
  analyser.fftSize = 256;
  source.connect(analyser);
  source.connect(audioCtx.destination); // Play audio to speakers

  canvas = new OffscreenCanvas(100, 100);
  ctx = canvas.getContext('2d', { willReadFrequently: true });

  // Run analysis every 200ms (5 FPS) for better beat detection
  analysisInterval = setInterval(analyzeCurrentFrame, 200);
}

function analyzeCurrentFrame() {
  if (!videoElement || videoElement.readyState < 2) return;

  const now = Date.now();

  // -----------------------
  // 1. VISUAL ANALYSIS
  // -----------------------
  ctx.drawImage(videoElement, 0, 0, 100, 100);
  const frameData = ctx.getImageData(0, 0, 100, 100).data;

  // Saturation
  let totalSaturation = 0;
  let pixels = 0;
  for (let i = 0; i < frameData.length; i += 40) { 
    const r = frameData[i];
    const g = frameData[i + 1];
    const b = frameData[i + 2];
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    if (max > 0) totalSaturation += (max - min) / max;
    pixels++;
  }
  const avgSaturation = pixels > 0 ? totalSaturation / pixels : 0;

  // Motion & Scene Cuts
  let motionScore = 0;
  if (previousPixelData) {
    let diffSum = 0;
    for (let i = 0; i < frameData.length; i += 40) {
      const rDiff = Math.abs(frameData[i] - previousPixelData[i]);
      const gDiff = Math.abs(frameData[i+1] - previousPixelData[i+1]);
      const bDiff = Math.abs(frameData[i+2] - previousPixelData[i+2]);
      diffSum += (rDiff + gDiff + bDiff) / 3;
    }
    motionScore = (diffSum / pixels) / 255;

    // SCENE CUT DETECTOR
    if (motionScore > CUT_THRESHOLD && (now - lastCutTime > CUT_COOLDOWN)) {
      cutTimestamps.push(now);
      lastCutTime = now;
      console.log("✂️ SCENE CUT DETECTED");
    }
  }
  previousPixelData = Uint8ClampedArray.from(frameData);

  // -----------------------
  // 2. AUDIO ANALYSIS (BPM)
  // -----------------------
  let volume = 0;
  let bpm = 0;
  
  if (analyser) {
    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(dataArray);
    
    // Calculate Volume (RMS-ish)
    const sum = dataArray.reduce((a, b) => a + b, 0);
    volume = sum / dataArray.length;

    // BEAT DETECTOR (Bass Kick Strategy)
    // Sum the lowest 10 bins (Bass Frequencies)
    let bassEnergy = 0;
    for(let i=0; i<10; i++) bassEnergy += dataArray[i];
    bassEnergy = bassEnergy / 10;

    if (bassEnergy > BEAT_THRESHOLD && (now - lastBeatTime > BEAT_COOLDOWN)) {
      beatTimestamps.push(now);
      lastBeatTime = now;
    }
  }

  // -----------------------
  // 3. AGGREGATE STATS (Rolling Window)
  // -----------------------
  // Remove timestamps older than 60 seconds
  cutTimestamps = cutTimestamps.filter(t => now - t < 60000);
  beatTimestamps = beatTimestamps.filter(t => now - t < 60000);

  const cutsPerMinute = cutTimestamps.length;
  const detectedBPM = beatTimestamps.length;

  // Send Data
  chrome.runtime.sendMessage({
    type: "METRICS_UPDATE",
    data: {
      saturation: avgSaturation,
      motion: motionScore,
      loudness: volume,
      cutsPerMinute: cutsPerMinute,
      bpm: detectedBPM,
      timestamp: now
    }
  });

  // --- AI SNAPSHOT LOGIC ---
  // Run semantic analysis every 5 seconds or on scene cut
  let shouldAnalyze = false;
  if (now - lastAiCheck > 5000) {
    shouldAnalyze = true;
  }
  // If a scene cut just happened, force analysis
  if (motionScore > CUT_THRESHOLD && (now - lastCutTime < 300)) {
    shouldAnalyze = true;
  }
  if (shouldAnalyze) {
    lastAiCheck = now;
    canvas.convertToBlob({ type: "image/jpeg", quality: 0.5 }).then(blob => {
      const reader = new FileReader();
      reader.readAsDataURL(blob);
      reader.onloadend = () => {
        const base64data = reader.result;
        chrome.runtime.sendMessage({
          type: 'ANALYZE_SEMANTIC',
          data: { image: base64data }
        });
      };
    });
  }
}
