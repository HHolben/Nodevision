// === ViewWAV.mjs ===
// Purpose: Display a live waveform visualization of a .wav or CSV-based waveform file

export default async function ViewWAV(filePath, container, serverBase = '') {
  console.log(`[ViewWAV] Rendering WAV file: ${filePath}`);

  // Clear existing content
  container.innerHTML = '';

  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'width:100%; height:300px; border:1px solid #333; background-color: black;';
  container.appendChild(canvas);
  const ctx = canvas.getContext('2d');

  let buffer = [];
  let amplitudeScale = 1.0;
  let timeScale = 1.0;
  let verticalOffset = 0.0;
  let horizontalOffset = 0.0;
  let showConnectors = true;
  let isPlaying = true;
  let audioEnabled = false;

  const AudioContext = window.AudioContext || window.webkitAudioContext;
  const audioCtx = new AudioContext();
  let audioSource;

  // Control panel
  const controls = document.createElement('div');
  controls.style.margin = '5px';
  controls.innerHTML = `
    <label>Amplitude: <input type="range" min="0.1" max="5" value="${amplitudeScale}" step="0.1" id="ampScale"></label>
    <label>Time Scale: <input type="range" min="0.1" max="2" value="${timeScale}" step="0.1" id="timeScale"></label>
    <label>Vertical Offset: <input type="range" min="-1" max="1" value="${verticalOffset}" step="0.05" id="vertOffset"></label>
    <label>Horizontal Offset: <input type="range" min="-1" max="1" value="${horizontalOffset}" step="0.01" id="horizOffset"></label>
    <button id="toggleLines">Toggle Lines</button>
    <button id="pausePlay">Pause</button>
    <label>Audio: <input type="checkbox" id="toggleAudio"></label>
  `;
  container.appendChild(controls);

  const get = id => controls.querySelector(`#${id}`);
  get('ampScale').oninput = e => { amplitudeScale = parseFloat(e.target.value); };
  get('timeScale').oninput = e => { timeScale = parseFloat(e.target.value); };
  get('vertOffset').oninput = e => { verticalOffset = parseFloat(e.target.value); };
  get('horizOffset').oninput = e => { horizontalOffset = parseFloat(e.target.value); };
  get('toggleLines').onclick = () => { showConnectors = !showConnectors; };
  get('pausePlay').onclick = e => {
    isPlaying = !isPlaying;
    e.target.textContent = isPlaying ? 'Pause' : 'Play';
  };
  get('toggleAudio').onchange = e => {
    audioEnabled = e.target.checked;
    if (audioEnabled && audioCtx.state === 'suspended') audioCtx.resume();
  };

  function drawWaveform() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!buffer.length) return;

    const marginLeft = 50, marginRight = 20, marginTop = 20, marginBottom = 40;
    const plotWidth = canvas.width - marginLeft - marginRight;
    const plotHeight = canvas.height - marginTop - marginBottom;

    const visibleSamples = Math.floor(buffer.length * timeScale);
    const visibleData = buffer.slice(-visibleSamples);
    const maxVal = Math.max(...visibleData.concat(1));
    const minVal = Math.min(...visibleData.concat(-1));
    const scaleY = plotHeight / (maxVal - minVal);

    // Grid
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 10; i++) {
      const y = marginTop + plotHeight - ((i / 10) * plotHeight);
      ctx.beginPath();
      ctx.moveTo(marginLeft, y);
      ctx.lineTo(canvas.width - marginRight, y);
      ctx.stroke();
    }
    for (let i = 0; i <= 10; i++) {
      const x = marginLeft + (i / 10) * plotWidth;
      ctx.beginPath();
      ctx.moveTo(x, marginTop);
      ctx.lineTo(x, marginTop + plotHeight);
      ctx.stroke();
    }

    const zeroY = marginTop + plotHeight - ((0 - minVal) * scaleY) + verticalOffset * plotHeight / 2;
    ctx.strokeStyle = '#444';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(marginLeft, zeroY);
    ctx.lineTo(canvas.width - marginRight, zeroY);
    ctx.stroke();

    // Axes
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(marginLeft, marginTop);
    ctx.lineTo(marginLeft, marginTop + plotHeight);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(marginLeft, marginTop + plotHeight);
    ctx.lineTo(canvas.width - marginRight, marginTop + plotHeight);
    ctx.stroke();

    // Axis labels
    ctx.fillStyle = 'white';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (let i = 0; i <= 5; i++) {
      const val = minVal + (i / 5) * (maxVal - minVal);
      const y = marginTop + plotHeight - ((val - minVal) * scaleY) + verticalOffset * plotHeight / 2;
      ctx.fillText(val.toFixed(2), marginLeft - 8, y);
    }

    // Data
    ctx.strokeStyle = 'lime';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < visibleData.length; i++) {
      const x = marginLeft + (i / visibleData.length) * plotWidth + horizontalOffset * plotWidth / 2;
      const scaledVal = visibleData[i] * amplitudeScale;
      const y = marginTop + plotHeight - ((scaledVal - minVal) * scaleY) + verticalOffset * plotHeight / 2;
      if (showConnectors) {
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      } else {
        ctx.fillRect(x - 1, y - 1, 2, 2);
      }
    }
    if (showConnectors) ctx.stroke();
  }

  function resizeCanvas() {
    canvas.width = container.clientWidth;
    canvas.height = 300;
    drawWaveform();
  }
  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();

  // Load WAV or fallback to CSV
  try {
    const res = await fetch(`${serverBase}/${filePath}`);
    const arrayBuffer = await res.arrayBuffer();
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
    const channelData = audioBuffer.getChannelData(0);
    buffer = Array.from(channelData);

    function animate() {
      if (isPlaying) {
        const first = buffer.shift();
        buffer.push(first);
      }
      drawWaveform();
      requestAnimationFrame(animate);
    }
    animate();
  } catch (err) {
    console.warn('[ViewWAV] WAV load failed, trying CSV fallback:', err);

    try {
      const res = await fetch(`${serverBase}/${filePath}`);
      const text = await res.text();
      buffer = text
        .split(/\r?\n/)
        .map(l => parseFloat(l.trim()))
        .filter(n => !isNaN(n));

      function animate() {
        if (isPlaying) {
          const first = buffer.shift();
          buffer.push(first);
        }
        drawWaveform();
        requestAnimationFrame(animate);
      }
      animate();
    } catch (err2) {
      console.error('[ViewWAV] Error loading file:', err2);
      container.innerHTML = '<p style="color:red;">Failed to load waveform file.</p>';
    }
  }
}
