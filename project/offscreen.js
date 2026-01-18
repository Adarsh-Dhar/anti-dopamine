// project/offscreen.js

let videoElement = null;
let canvas = null;
let ctx = null;
let audioCtx = null;
let analyser = null;
let previousPixelData = null;
let analysisInterval = null;

// METRIC STATE
let cutTimestamps = [];
let beatTimestamps = [];
let lastCutTime = 0;
let lastBeatTime = 0;

// CONFIG
const CUT_THRESHOLD = 0.4;
const CUT_COOLDOWN = 500;
const BEAT_THRESHOLD = 140;
const BEAT_COOLDOWN = 250;

chrome.runtime.onMessage.addListener(async (msg) => {
  if (msg.type === 'START_STREAM_ANALYSIS') {
    const { streamId } = msg.data;
    console.log('[Offscreen] 1. Received Stream ID:', streamId);
    try {
      await startLiveStream(streamId);
    } catch (err) {
      console.error('[Offscreen] ❌ Error starting stream:', err);
    }
  }
});

async function startLiveStream(streamId) {
  // 1. Cleanup
  if (videoElement) {
    if (videoElement.srcObject) {
      videoElement.srcObject.getTracks().forEach(t => t.stop());
    }
    videoElement.remove();
  }
  if (analysisInterval) clearInterval(analysisInterval);

  console.log('[Offscreen] 2. Requesting getUserMedia...');

  try {
    // 2. Capture the Tab
    const stream = await navigator.mediaDevices.getUserMedia({
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

    console.log('[Offscreen] 3. Stream Acquired. Setting up Audio/Video...');

    // 3. Play Video (Muted to prevent echo)
    videoElement = document.createElement('video');
    videoElement.srcObject = stream;
    videoElement.muted = true; 
    await videoElement.play();

    console.log('[Offscreen] 4. Video Playing.');

    // 4. Setup Audio Analysis
    audioCtx = new AudioContext();
    const source = audioCtx.createMediaStreamSource(stream);
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);
    source.connect(audioCtx.destination); // Play audio to speakers

    // 5. Setup Canvas
    canvas = new OffscreenCanvas(100, 100);
    ctx = canvas.getContext('2d', { willReadFrequently: true });

    // 6. Start Loop
    console.log('[Offscreen] 5. Starting Analysis Loop...');
    analysisInterval = setInterval(analyzeCurrentFrame, 200);

  } catch (err) {
    console.error("[Offscreen] ❌ getUserMedia Failed:", err);
    throw err;
  }
}

function analyzeCurrentFrame() {
  if (!videoElement || videoElement.readyState < 2) return;

  const now = Date.now();

  // VISUAL
  ctx.drawImage(videoElement, 0, 0, 100, 100);
  const frameData = ctx.getImageData(0, 0, 100, 100).data;

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

  // MOTION
  let motionScore = 0;
  if (previousPixelData) {
    let diffSum = 0;
    for (let i = 0; i < frameData.length; i += 40) {
      diffSum += (Math.abs(frameData[i] - previousPixelData[i]) +
                  Math.abs(frameData[i+1] - previousPixelData[i+1]) +
                  Math.abs(frameData[i+2] - previousPixelData[i+2])) / 3;
    }
    motionScore = (diffSum / pixels) / 255;

    if (motionScore > CUT_THRESHOLD && (now - lastCutTime > CUT_COOLDOWN)) {
      cutTimestamps.push(now);
      lastCutTime = now;
    }
  }
  previousPixelData = Uint8ClampedArray.from(frameData);

  // AUDIO
  let volume = 0;
  let bpm = 0; // Simplified BPM
  if (analyser) {
    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(dataArray);
    volume = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
    
    // Simple beat detection
    let bassEnergy = 0;
    for(let i=0; i<10; i++) bassEnergy += dataArray[i];
    if ((bassEnergy / 10) > BEAT_THRESHOLD && (now - lastBeatTime > BEAT_COOLDOWN)) {
      beatTimestamps.push(now);
      lastBeatTime = now;
    }
  }

  // AGGREGATE
  cutTimestamps = cutTimestamps.filter(t => now - t < 60000);
  beatTimestamps = beatTimestamps.filter(t => now - t < 60000);

  // LOG: Prove we are alive
  // Only log every 5th frame (approx 1 sec) to not flood console too much
  if (Math.random() < 0.2) {
    console.log(`[Offscreen] 📡 Sending Metrics -> Motion: ${motionScore.toFixed(2)}, Vol: ${volume.toFixed(0)}`);
  }

  // SEND
  chrome.runtime.sendMessage({
    type: "METRICS_UPDATE",
    data: {
      saturation: avgSaturation,
      motion: motionScore,
      loudness: volume,
      cutsPerMinute: cutTimestamps.length,
      bpm: beatTimestamps.length,
      timestamp: now
    }
  });
}