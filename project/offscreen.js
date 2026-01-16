
// project/offscreen.js

let videoElement = null;
let canvas = null;
let ctx = null;
let audioCtx = null;
let analyser = null;
let previousPixelData = null;
let analysisInterval = null;

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
  // 1. Cleanup old streams
  if (videoElement) {
    if (videoElement.srcObject) {
      videoElement.srcObject.getTracks().forEach(t => t.stop());
    }
    videoElement.remove();
  }
  if (analysisInterval) clearInterval(analysisInterval);

  console.log('[Offscreen] Requesting getUserMedia...');

  // 2. Get the Live Tab Stream
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      mandatory: {
        chromeMediaSource: 'tab',
        chromeMediaSourceId: streamId
      }
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

  console.log('[Offscreen] Live stream connected successfully.');

  // 3. Play stream in hidden video element
  // We keep this muted to avoid "double audio" (we play it via AudioContext below)
  videoElement = document.createElement('video');
  videoElement.srcObject = stream;
  videoElement.muted = true; 
  videoElement.play();

  // 4. Setup Audio Analysis AND Playback
  audioCtx = new AudioContext();
  const source = audioCtx.createMediaStreamSource(stream);
  analyser = audioCtx.createAnalyser();
  analyser.fftSize = 256;
  
  // A. Connect to Analyser (for your metrics)
  source.connect(analyser);
  
  // B. CRITICAL FIX: Connect to Speakers (so you can hear it!)
  // This effectively "unmutes" the tab by playing the stream through the extension.
  source.connect(audioCtx.destination); 

  // 5. Setup Canvas for Pixel Reading
  canvas = new OffscreenCanvas(100, 100);
  ctx = canvas.getContext('2d', { willReadFrequently: true });

  // 6. Start Analysis Loop
  analysisInterval = setInterval(analyzeCurrentFrame, 500);
}

function analyzeCurrentFrame() {
  if (!videoElement || videoElement.readyState < 2) return;

  // A. Draw Video Frame to Canvas
  ctx.drawImage(videoElement, 0, 0, 100, 100);
  const frameData = ctx.getImageData(0, 0, 100, 100).data;

  // B. Calculate Saturation
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

  // C. Calculate Motion
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
  }
  previousPixelData = Uint8ClampedArray.from(frameData);

  // D. Calculate Loudness
  let volume = 0;
  if (analyser) {
    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(dataArray);
    const sum = dataArray.reduce((a, b) => a + b, 0);
    volume = sum / dataArray.length;
  }

  // E. Send Data
  chrome.runtime.sendMessage({
    type: "METRICS_UPDATE",
    data: {
      saturation: avgSaturation,
      motion: motionScore,
      loudness: volume,
      timestamp: Date.now()
    }
  });
}