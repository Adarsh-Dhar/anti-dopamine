// offscreen.js
let canvas, ctx, videoElement;

chrome.runtime.onMessage.addListener(async (msg) => {
  if (msg.type === 'START_ANALYSIS') {
    const { streamId, coords } = msg.data;
    try {
      await startStream(streamId, coords);
    } catch (err) {
      console.error('[Offscreen] Error starting stream:', err);
    }
  } else {
    console.warn('[Offscreen] Unknown message type:', msg.type, msg);
  }
});

let audioCtx, analyser;

chrome.runtime.onMessage.addListener(async (msg) => {
  if (msg.type === 'INIT_AUDIO') {
    const { streamId } = msg.data;
    try {
      await startAudioStream(streamId);
    } catch (err) {
      console.error('[Offscreen] Error starting audio stream:', err);
    }
  } else if (msg.type === 'PROCESS_FRAME') {
    const { image, timestamp } = msg.data;
    try {
      await processFrame(image, timestamp);
    } catch (err) {
      console.error('[Offscreen] Error processing frame:', err);
    }
  } else {
    console.warn('[Offscreen] Unknown message type:', msg.type, msg);
  }
});

async function startAudioStream(streamId) {
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
