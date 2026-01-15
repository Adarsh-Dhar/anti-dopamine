// Clean, single implementation for live tab streaming and metrics
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
    try {
      await startLiveStream(streamId);
    } catch (err) {
      console.error('[Offscreen] Error starting stream:', err);
    }
  }
});

async function startLiveStream(streamId) {
  // Cleanup old streams/intervals
  if (videoElement) {
    videoElement.srcObject?.getTracks().forEach(t => t.stop());
    videoElement.remove();
  }
  if (analysisInterval) clearInterval(analysisInterval);

  // Get the Live Tab Stream (Video + Audio)
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

  console.log('[Offscreen] Live stream connected. Stream tracks:', stream.getTracks().map(t => t.kind));

  // Play stream in hidden video element
  videoElement = document.createElement('video');
  videoElement.srcObject = stream;
  videoElement.muted = true;
  videoElement.autoplay = true;
  videoElement.playsInline = true;
  videoElement.addEventListener('loadedmetadata', () => {
    console.log('[Offscreen] Video loadedmetadata:', videoElement.videoWidth, videoElement.videoHeight);
  });
  videoElement.addEventListener('play', () => {
    console.log('[Offscreen] Video play event. ReadyState:', videoElement.readyState);
  });
  videoElement.addEventListener('error', (e) => {
    console.error('[Offscreen] Video error:', e);
  });
  videoElement.play().then(() => {
    console.log('[Offscreen] videoElement.play() promise resolved.');
  }).catch(e => {
    console.error('[Offscreen] videoElement.play() error:', e);
  });

  // Setup Audio Analysis
  audioCtx = new AudioContext();
  const source = audioCtx.createMediaStreamSource(stream);
  analyser = audioCtx.createAnalyser();
  analyser.fftSize = 256;
  source.connect(analyser);
  // Do NOT connect to destination (no audio output)

  // Setup OffscreenCanvas for Pixel Reading
  canvas = new OffscreenCanvas(100, 100);
  ctx = canvas.getContext('2d', { willReadFrequently: true });

  // Start Analysis Loop
  analysisInterval = setInterval(analyzeCurrentFrame, 500);
  console.log('[Offscreen] Analysis loop started.');
}

function analyzeCurrentFrame() {

  if (!videoElement) {
    console.warn('[Offscreen] No videoElement in analyzeCurrentFrame');
    return;
  }
  if (videoElement.readyState < 2) {
    console.warn('[Offscreen] Video not ready. readyState:', videoElement.readyState);
    return;
  }
  // Draw Video Frame to Canvas
  try {
    ctx.drawImage(videoElement, 0, 0, 100, 100);
  } catch (e) {
    console.error('[Offscreen] drawImage error:', e);
    return;
  }
  const frameData = ctx.getImageData(0, 0, 100, 100).data;
  // Log some pixel data for debugging
  if (frameData.length > 0) {
    console.log('[Offscreen] Frame data sample:', frameData[0], frameData[1], frameData[2]);
  }

  // Calculate Saturation
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

  // Calculate Motion
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

  // Calculate Loudness
  let volume = 0;
  if (analyser) {
    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(dataArray);
    const sum = dataArray.reduce((a, b) => a + b, 0);
    volume = sum / dataArray.length;
  }

  // Send Data
  const timestamp = Date.now();
  chrome.runtime.sendMessage({
    type: 'METRICS_UPDATE',
    data: {
      saturation: avgSaturation,
      motion: motionScore,
      loudness: volume,
      timestamp
    }
  });
}
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        mandatory: {
          chromeMediaSource: "tab",
          chromeMediaSourceId: streamId
        }
      },
      video: false
    });
  } catch (err) {
    console.error('[Offscreen] Error getting user media:', err);
    throw err;
  }
  if (!stream) {
    console.error('[Offscreen] No stream obtained!');
    return;
  }
  audioCtx = new AudioContext();
  const source = audioCtx.createMediaStreamSource(stream);
  analyser = audioCtx.createAnalyser();
  analyser.fftSize = 256;
  source.connect(analyser);
  analyser.connect(audioCtx.destination);
}

async function processFrame(image, timestamp) {
  // Create or get canvas
  if (!canvas) {
    canvas = document.getElementById('analysis-canvas');
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.id = 'analysis-canvas';
      canvas.width = 100;
      canvas.height = 100;
      document.body.appendChild(canvas);
    }
    ctx = canvas.getContext('2d', { willReadFrequently: true });
  }
  // Create or get image element
  let img = document.getElementById('frame-image');
  if (!img) {
    img = document.createElement('img');
    img.id = 'frame-image';
    img.style.display = 'none';
    document.body.appendChild(img);
  }
  img.src = image;
  await new Promise((resolve) => { img.onload = resolve; });
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  const frameData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
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

  // Motion detection (Pixel Diff)
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

  // --- AUDIO METRICS ---
  let volume = 0;
  if (analyser) {
    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(dataArray);
    volume = dataArray.reduce((a, b) => a + b) / dataArray.length;
  }
  chrome.runtime.sendMessage({
    type: "METRICS_UPDATE",
    data: {
      saturation: avgSaturation,
      motion: motionScore,
      loudness: volume,
      timestamp
    }
  });
}

// ...existing code...

async function startStream(streamId, coords) {
  // 1. Get the media stream from the ID
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        mandatory: {
          chromeMediaSource: "tab",
          chromeMediaSourceId: streamId
        }
      },
      video: {
        mandatory: {
          chromeMediaSource: "tab",
          chromeMediaSourceId: streamId
        }
      }
    });
  } catch (err) {
    console.error('[Offscreen] Error getting user media:', err);
    throw err;
  }
  	if (!stream) {
  		console.error('[Offscreen] No stream obtained!');
  		return;
  	}

  // 2. Fix the "Mute" bug: Route audio back to speakers
  const audioCtx = new AudioContext();
  const source = audioCtx.createMediaStreamSource(stream);
  const analyser = audioCtx.createAnalyser();
  analyser.fftSize = 256;
  source.connect(analyser);
  analyser.connect(audioCtx.destination); // Plays audio to user

  // 3. Setup Video for Visual Analysis
  videoElement = document.getElementById('stream-video');
  videoElement.srcObject = stream;
  
  // 4. Setup Canvas for Pixel Reading
  canvas = document.getElementById('analysis-canvas');
  ctx = canvas.getContext('2d', { willReadFrequently: true });
  canvas.width = 100; 
  canvas.height = 100;

  // 5. Start the Loop
  setInterval(() => {
    analyzeFrame(coords, analyser);
  }, 100); // Run 10 times a second (10 FPS)
}

function analyzeFrame(coords, analyser) {
  if (!videoElement || videoElement.readyState < 2) return;

  // --- VISUAL METRICS ---
  ctx.drawImage(
    videoElement, 
    coords.x, coords.y, coords.width, coords.height, // Source crop
    0, 0, canvas.width, canvas.height // Destination resize
  );

  const frameData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  let totalSaturation = 0;

  // Strided sampling (skip pixels to save CPU)
  for (let i = 0; i < frameData.length; i += 40) { 
    const r = frameData[i];
    const g = frameData[i + 1];
    const b = frameData[i + 2];
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    if (max > 0) totalSaturation += (max - min) / max;
  }
  const avgSaturation = totalSaturation / (frameData.length / 40);

  // --- AUDIO METRICS ---
  const dataArray = new Uint8Array(analyser.frequencyBinCount);
  analyser.getByteFrequencyData(dataArray);
  const volume = dataArray.reduce((a, b) => a + b) / dataArray.length;

  // --- SEND TO REACT ---
  chrome.runtime.sendMessage({
    type: "METRICS_UPDATE",
    data: {
      saturation: avgSaturation,
      loudness: volume,
      timestamp: Date.now()
    }
  });
}
