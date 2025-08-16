(async () => {
  function renderWAV(filename, infoPanel, serverBase = '') {
    infoPanel.innerHTML = '';

    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'width:100%; height:300px; border:1px solid #333; background-color: black;';
    infoPanel.appendChild(canvas);
    const ctx = canvas.getContext('2d');

    let buffer = [];
    let amplitudeScale = 1.0;
    let timeScale = 1.0;
    let verticalOffset = 0.0;     // NEW
    let horizontalOffset = 0.0;   // NEW
    let showConnectors = true;
    let isPlaying = true;
    let audioEnabled = false;

    const AudioContext = window.AudioContext || window.webkitAudioContext;
    const audioCtx = new AudioContext();
    let audioSource;

    // Controls
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
    infoPanel.appendChild(controls);

    document.getElementById('ampScale').oninput = e => { amplitudeScale = parseFloat(e.target.value); };
    document.getElementById('timeScale').oninput = e => { timeScale = parseFloat(e.target.value); };
    document.getElementById('vertOffset').oninput = e => { verticalOffset = parseFloat(e.target.value); };
    document.getElementById('horizOffset').oninput = e => { horizontalOffset = parseFloat(e.target.value); };
    document.getElementById('toggleLines').onclick = () => { showConnectors = !showConnectors; };
    document.getElementById('pausePlay').onclick = e => { 
      isPlaying = !isPlaying; 
      e.target.textContent = isPlaying ? 'Pause' : 'Play'; 
    };
    document.getElementById('toggleAudio').onchange = e => {
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

      // compute min/max from raw data
      const maxVal = Math.max(...visibleData.concat(1));
      const minVal = Math.min(...visibleData.concat(-1));

      // vertical scale (based on raw range)
      const scaleY = plotHeight / (maxVal - minVal);

      // Grid
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
      const zeroY = marginTop + plotHeight - ((0 - minVal) * scaleY) + verticalOffset * plotHeight/2;
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

      // Axis labels (raw amplitude values, not scaled)
      ctx.fillStyle = 'white';
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      const ySteps = 5;
      for (let i = 0; i <= ySteps; i++) {
        const val = minVal + (i / ySteps) * (maxVal - minVal);
        const y = marginTop + plotHeight - ((val - minVal) * scaleY) + verticalOffset * plotHeight/2;
        ctx.fillText(val.toFixed(2), marginLeft - 8, y);
      }

      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      for (let i = 0; i <= 10; i++) {
        const idx = Math.floor((i / 10) * visibleData.length);
        const x = marginLeft + (idx / visibleData.length) * plotWidth + horizontalOffset * plotWidth/2;
        ctx.fillText(idx, x, marginTop + plotHeight + 3);
      }

      // Draw waveform with amplitude + offsets applied
      ctx.strokeStyle = 'lime';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < visibleData.length; i++) {
        const x = marginLeft + (i / visibleData.length) * plotWidth + horizontalOffset * plotWidth/2;
        const scaledVal = visibleData[i] * amplitudeScale;
        const y = marginTop + plotHeight - ((scaledVal - minVal) * scaleY) + verticalOffset * plotHeight/2;
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

    // Try loading as WAV first
    fetch(`${serverBase}/${filename}`)
      .then(res => res.arrayBuffer())
      .then(arrayBuffer => audioCtx.decodeAudioData(arrayBuffer))
      .then(audioBuffer => {
        const channelData = audioBuffer.getChannelData(0);
        buffer = Array.from(channelData);

        function animate() {
          if (isPlaying) {
            const first = buffer.shift();
            buffer.push(first);
          }
          if (audioEnabled) {
            if (audioSource) audioSource.stop();
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
        console.warn('WAV load failed, falling back to CSV:', err);

        fetch(`${serverBase}/${filename}`)
          .then(res => res.text())
          .then(text => {
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
          })
          .catch(err2 => {
            console.error('Error loading CSV fallback:', err2);
            infoPanel.innerHTML = '<p style="color:red;">Failed to load waveform file.</p>';
          });
      });
  }

  window.renderWAV = renderWAV;
})();
