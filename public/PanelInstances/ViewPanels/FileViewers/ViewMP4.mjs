// Nodevision/public/PanelInstances/ViewPanels/ViewMP4.mjs
// Purpose: Displays and plays .mp4 video files inside a ViewPanel with a simple waveform analyzer.

export function setupPanel(panelEl, fileUrl) {
  console.log("ViewMP4: loading", fileUrl);
  panelEl.innerHTML = '';

  // Create elements
  const container = document.createElement('div');
  const canvas = document.createElement('canvas');
  const video = document.createElement('video');

  canvas.width = 800;
  canvas.height = 200;
  canvas.style.border = '1px solid #ccc';
  canvas.style.display = 'block';
  canvas.style.marginBottom = '10px';

  video.src = fileUrl;
  video.controls = true;
  video.style.width = '800px';
  video.crossOrigin = 'anonymous';
  video.style.display = 'block';

  container.appendChild(canvas);
  container.appendChild(video);
  panelEl.appendChild(container);

  // Set up Web Audio API
  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  const source = audioCtx.createMediaElementSource(video);
  const analyser = audioCtx.createAnalyser();
  source.connect(analyser);
  analyser.connect(audioCtx.destination);

  analyser.fftSize = 512;
  const bufferLength = analyser.frequencyBinCount;
  const dataArray = new Uint8Array(bufferLength);

  const ctx = canvas.getContext('2d');
  const waveform = [];
  let recording = false;

  function analyzeFrame() {
    if (!recording) return;
    analyser.getByteTimeDomainData(dataArray);
    let sum = 0;
    for (let i = 0; i < bufferLength; i++) {
      const v = (dataArray[i] - 128) / 128;
      sum += v * v;
    }
    const rms = Math.sqrt(sum / bufferLength);
    waveform.push(rms);

    if (waveform.length > canvas.width) waveform.shift(); // keep waveform in view
    drawWaveform();

    requestAnimationFrame(analyzeFrame);
  }

  function drawWaveform() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.beginPath();
    for (let i = 0; i < waveform.length; i++) {
      const y = (1 - waveform[i]) * canvas.height;
      ctx.lineTo(i, y);
    }
    ctx.strokeStyle = '#FF4136';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // Event handlers
  video.addEventListener('play', () => {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    recording = true;
    analyzeFrame();
  });

  video.addEventListener('pause', () => { recording = false; });
  video.addEventListener('ended', () => { recording = false; });

  // Optional: resume context if user clicks anywhere (for browsers that block autoplay)
  panelEl.addEventListener('click', () => {
    if (audioCtx.state === 'suspended') audioCtx.resume();
  });
}
