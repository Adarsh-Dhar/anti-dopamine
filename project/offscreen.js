// offscreen.js
let canvas, ctx, videoElement;

chrome.runtime.onMessage.addListener(async (msg) => {
  if (msg.type === 'START_ANALYSIS') {
    const { streamId, coords } = msg.data;
    startStream(streamId, coords);
  }
});

async function startStream(streamId, coords) {
  // 1. Get the media stream from the ID
  const stream = await navigator.mediaDevices.getUserMedia({
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
