(async () => {
  function renderWAV(filename, infoPanel, serverBase = '') {
    infoPanel.innerHTML = '';

    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'width:100%; height:300px; border:1px solid #333; background-color: black;';
    infoPanel.appendChild(canvas);
    const ctx = canvas.getContext('2d');

    let waveformData = [];
    let buffer = [];
    let amplitudeScale = 1.0;
    let timeScale = 1.0;
    let showConnectors = true;
    let isPlaying = true;
    let audioEnabled = false;

    // Audio context setup
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    const audioCtx = new AudioContext();
    let audioSource;

    // Controls
    const controls = document.createElement('div');
    controls.style.margin = '5px';
    controls.innerHTML = `
      <label>Amplitude: <input type="range" min="0.1" max="5" value="${amplitudeScale}" step="0.1" id="ampScale"></label>
      <label>Time Scale: <input type="range" min="0.1" max="2" value="${timeScale}" step="0.1" id="timeScale"></label>
      <button id="toggleLines">Toggle Lines</button>
      <button id="pausePlay">Pause</button>
      <label>Audio: <input type="checkbox" id="toggleAudio"></label>
    `;
    infoPanel.appendChild(controls);

    // Event handlers
    document.getElementById('ampScale').oninput = e => { amplitudeScale = parseFloat(e.target.value); };
    document.getElementById('timeScale').oninput = e => { timeScale = parseFloat(e.target.value); };
    document.getElementById('toggleLines').onclick = () => { showConnectors = !showConnectors; };
    document.getElementById('pausePlay').onclick = e => { 
      isPlaying = !isPlaying; 
      e.target.textContent = isPlaying ? 'Pause' : 'Play'; 
    };
    document.getElementById('toggleAudio').onchange = e => {
      audioEnabled = e.target.checked;
      if (audioEnabled && audioCtx.state === 'suspended') audioCtx.resume();
    };

    // Draw waveform
    function drawWaveform() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (!buffer.length) return;

      const marginLeft = 50, marginRight = 20, marginTop = 20, marginBottom = 40;
      const plotWidth = canvas.width - marginLeft - marginRight;
      const plotHeight = canvas.height - marginTop - marginBottom;

      const visibleSamples = Math.floor(buffer.length * timeScale);
      const visibleData = buffer.slice(-visibleSamples).map(v => v * amplitudeScale);
      const maxVal = Math.max(...visibleData.concat(1023));
      const minVal = Math.min(...visibleData.concat(0));
      const scaleY = plotHeight / (maxVal - minVal);

      // Grid lines
      ctx.strokeStyle = '#222';
      ctx.lineWidth = 1;
      const yGridSteps = 10, xGridSteps = 10;
      for (let i = 0; i <= yGridSteps; i++) {
        const y = marginTop + plotHeight - ((i / yGridSteps) * plotHeight);
        ctx.beginPath();
        ctx.moveTo(marginLeft, y);
        ctx.lineTo(canvas.width - marginRight, y);
        ctx.stroke();
      }
      for (let i = 0; i <= xGridSteps; i++) {
        const x = marginLeft + (i / xGridSteps) * plotWidth;
        ctx.beginPath();
        ctx.moveTo(x, marginTop);
        ctx.lineTo(x, marginTop + plotHeight);
        ctx.stroke();
      }

      // Zero line
      const zeroY = marginTop + plotHeight - ((0 - minVal) * scaleY);
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
      const ySteps = 5;
      for (let i = 0; i <= ySteps; i++) {
        const val = minVal + (i / ySteps) * (maxVal - minVal);
        const y = marginTop + plotHeight - ((val - minVal) * scaleY);
        ctx.fillText(val.toFixed(0), marginLeft - 8, y);
        ctx.strokeStyle = '#888';
        ctx.beginPath();
        ctx.moveTo(marginLeft - 5, y);
        ctx.lineTo(marginLeft, y);
        ctx.stroke();
      }

      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      const xStepsLabel = 10;
      for (let i = 0; i <= xStepsLabel; i++) {
        const idx = Math.floor((i / xStepsLabel) * visibleData.length);
        const x = marginLeft + (idx / visibleData.length) * plotWidth;
        ctx.fillText(idx, x, marginTop + plotHeight + 3);
        ctx.strokeStyle = '#888';
        ctx.beginPath();
        ctx.moveTo(x, marginTop + plotHeight);
        ctx.lineTo(x, marginTop + plotHeight + 5);
        ctx.stroke();
      }

      // Draw waveform
      ctx.strokeStyle = 'lime';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < visibleData.length; i++) {
        const x = marginLeft + (i / visibleData.length) * plotWidth;
        const y = marginTop + plotHeight - ((visibleData[i] - minVal) * scaleY);
        if (showConnectors) {
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        } else {
          ctx.fillStyle = 'lime';
          ctx.fillRect(x - 1, y - 1, 2, 2);
        }
      }
      if (showConnectors) ctx.stroke();
    }

    function resizeCanvas() {
      canvas.width = infoPanel.clientWidth;
      canvas.height = 300;
      drawWaveform();
    }
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    // Load waveform
    fetch(`${serverBase}/${filename}`)
      .then(res => res.text())
      .then(text => {
        waveformData = text
          .split(/\r?\n/)
          .map(l => parseFloat(l.trim()))
          .filter(n => !isNaN(n));
        buffer = waveformData.slice();

        // Animate waveform
        function animate() {
          if (isPlaying) {
            const first = buffer.shift();
            buffer.push(first);
          }

          // Audio playback
          if (audioEnabled && waveformData.length > 0) {
            const audioBuffer = audioCtx.createBuffer(1, buffer.length, 44100);
            const channel = audioBuffer.getChannelData(0);
            for (let i = 0; i < buffer.length; i++) channel[i] = buffer[i] / 1023 * 2 - 1; // normalize
            if (audioSource) audioSource.disconnect();
            audioSource = audioCtx.createBufferSource();
            audioSource.buffer = audioBuffer;
            audioSource.connect(audioCtx.destination);
            audioSource.start();
          }

          drawWaveform();
          requestAnimationFrame(animate);
        }
        animate();
      })
      .catch(err => {
        console.error('Error loading waveform file:', err);
        infoPanel.innerHTML = '<p style="color:red;">Failed to load waveform file.</p>';
      });
  }

  window.renderWAV = renderWAV;
})();
