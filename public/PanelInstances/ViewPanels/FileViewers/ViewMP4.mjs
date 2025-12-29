// Nodevision/public/PanelInstances/ViewPanels/ViewMP4.mjs
// This module displays and plays MP4 video files with a simple real-time audio waveform analyzer.

export function renderFile(filePath, viewPanel) {
  console.log('[ViewMP4] Loading:', filePath);

  // Clear panel
  viewPanel.innerHTML = '';

  // === Container ===
  const container = document.createElement('div');
  container.style.width = '100%';
  container.style.boxSizing = 'border-box';

  // === Canvas (Waveform) ===
  const canvas = document.createElement('canvas');
  canvas.height = 200;
  canvas.style.width = '100%';
  canvas.style.border = '1px solid #ccc';
  canvas.style.display = 'block';
  canvas.style.marginBottom = '10px';

  // === Video ===
  const video = document.createElement('video');
  video.src = 'Notebook/'+filePath;
  video.controls = true;
  video.style.width = '100%';
  video.crossOrigin = 'anonymous';
  video.preload = 'metadata';

  container.appendChild(canvas);
  container.appendChild(video);
  viewPanel.appendChild(container);

  // Resize canvas to match container
  function resizeCanvas() {
    canvas.width = canvas.clientWidth;
  }
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  // === Web Audio API ===
  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  const source = audioCtx.createMediaElementSource(video);
  const analyser = audioCtx.createAnalyser();

  analyser.fftSize = 512;

  source.connect(analyser);
  analyser.connect(audioCtx.destination);

  const bufferLength = analyser.frequencyBinCount;
  const dataArray = new Uint8Array(bufferLength);
  const ctx = canvas.getContext('2d');

  const waveform = [];
  let running = false;

  function drawWaveform() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.beginPath();

    for (let i = 0; i < waveform.length; i++) {
      const x = i;
      const y = (1 - waveform[i]) * canvas.height;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }

    ctx.strokeStyle = '#FF4136';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  function analyze() {
    if (!running) return;

    analyser.getByteTimeDomainData(dataArray);

    let sum = 0;
    for (let i = 0; i < bufferLength; i++) {
      const v = (dataArray[i] - 128) / 128;
      sum += v * v;
    }

    const rms = Math.sqrt(sum / bufferLength);
    waveform.push(rms);

    if (waveform.length > canvas.width) waveform.shift();

    drawWaveform();
    requestAnimationFrame(analyze);
  }

  // === Events ===
  video.addEventListener('play', () => {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    running = true;
    analyze();
  });

  video.addEventListener('pause', () => { running = false; });
  video.addEventListener('ended', () => { running = false; });

  // Browser autoplay unlock
  viewPanel.addEventListener('click', () => {
    if (audioCtx.state === 'suspended') audioCtx.resume();
  });
}
