// Nodevision/public/PanelInstances/ViewPanels/ViewMP3.mjs
// Purpose: Displays and plays .mp3 files inside a ViewPanel, with waveform visualization.

export function setupPanel(panelEl, fileUrl) {
  console.log("ViewMP3: loading", fileUrl);

  const canvas = document.createElement('canvas');
  const playBtn = document.createElement('button');
  const pauseBtn = document.createElement('button');
  const slider = document.createElement('input');

  canvas.width = 800;
  canvas.height = 200;
  canvas.style.border = '1px solid #ccc';
  canvas.style.display = 'block';
  canvas.style.marginBottom = '10px';

  playBtn.textContent = 'Play';
  pauseBtn.textContent = 'Pause';
  slider.type = 'range';
  slider.min = 0;
  slider.value = 0;
  slider.step = 0.01;
  slider.style.width = '800px';
  slider.style.display = 'block';
  slider.style.marginTop = '10px';

  panelEl.innerHTML = '';
  panelEl.appendChild(canvas);
  panelEl.appendChild(playBtn);
  panelEl.appendChild(pauseBtn);
  panelEl.appendChild(slider);

  const audio = new Audio(fileUrl);
  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  const sourceNode = audioCtx.createMediaElementSource(audio);
  sourceNode.connect(audioCtx.destination);

  // Draw waveform preview
  fetch(fileUrl)
    .then(r => r.arrayBuffer())
    .then(buf => audioCtx.decodeAudioData(buf))
    .then(decoded => {
      const raw = decoded.getChannelData(0);
      const blockSize = Math.floor(raw.length / canvas.width);
      const volumes = new Float32Array(canvas.width);

      for (let i = 0; i < canvas.width; i++) {
        let sum = 0;
        const start = i * blockSize;
        for (let j = 0; j < blockSize; j++) {
          const v = raw[start + j];
          sum += v * v;
        }
        volumes[i] = Math.sqrt(sum / blockSize);
      }

      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.beginPath();
      ctx.moveTo(0, canvas.height / 2);

      for (let x = 0; x < volumes.length; x++) {
        const y = (1 - volumes[x]) * canvas.height;
        ctx.lineTo(x, y);
      }

      ctx.strokeStyle = '#0074D9';
      ctx.lineWidth = 1;
      ctx.stroke();

      slider.max = decoded.duration;
    })
    .catch(err => {
      console.error("Error decoding MP3:", err);
      panelEl.innerHTML = `<p style="color:red;">Error decoding MP3: ${err.message}</p>`;
    });

  playBtn.addEventListener('click', () => {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    audio.play();
  });

  pauseBtn.addEventListener('click', () => audio.pause());

  slider.addEventListener('input', () => {
    audio.currentTime = parseFloat(slider.value);
  });

  audio.addEventListener('timeupdate', () => {
    slider.value = audio.currentTime;
  });
}
