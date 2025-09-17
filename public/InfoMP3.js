// Nodevision/public/InfoMP3.js
// Purpose: TODO: Add description of module purpose
// ---------------------------
// Registers a handler for .mp3 files in Nodevision. When you click an MP3 node,
// Nodevision should create a container div and call the exported `InfoMP3` function
// with (containerElement, fileUrl).

(function(){
  // register for .mp3 extension
  window.nodevisionInfoExtensions = window.nodevisionInfoExtensions || {};
  window.nodevisionInfoExtensions['.mp3'] = InfoMP3;

  function InfoMP3(container, fileUrl) {
    // create UI elements
    const canvas = document.createElement('canvas');
    const playBtn = document.createElement('button');
    const pauseBtn = document.createElement('button');
    const slider = document.createElement('input');

    canvas.width = 800;
    canvas.height = 200;
    canvas.style.border = '1px solid #ccc';
    playBtn.textContent = 'Play';
    pauseBtn.textContent = 'Pause';
    slider.type = 'range';
    slider.min = 0;
    slider.value = 0;
    slider.step = 0.01;
    slider.style.width = '800px';

    // append to container
    container.appendChild(canvas);
    container.appendChild(document.createElement('br'));
    container.appendChild(playBtn);
    container.appendChild(pauseBtn);
    container.appendChild(document.createElement('br'));
    container.appendChild(slider);

    // set up audio context and elements
    const audio = new Audio(fileUrl);
    const audioCtx = new (window.AudioContext||window.webkitAudioContext)();
    const sourceNode = audioCtx.createMediaElementSource(audio);
    sourceNode.connect(audioCtx.destination);

    // fetch & decode full buffer for offline analysis
    fetch(fileUrl)
      .then(r => r.arrayBuffer())
      .then(buf => audioCtx.decodeAudioData(buf))
      .then(decoded => {
        const raw = decoded.getChannelData(0);  // use first channel
        const blockSize = Math.floor(raw.length / canvas.width);
        const volumes = new Float32Array(canvas.width);

        // compute RMS for each block
        for (let i = 0; i < canvas.width; i++) {
          let sum = 0;
          const start = i * blockSize;
          for (let j = 0; j < blockSize; j++) {
            const v = raw[start + j];
            sum += v * v;
          }
          volumes[i] = Math.sqrt(sum / blockSize);
        }

        // draw waveform
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.beginPath();
        ctx.moveTo(0, canvas.height / 2);
        for (let x = 0; x < volumes.length; x++) {
          const y = (1 - volumes[x]) * canvas.height;
          ctx.lineTo(x, y);
        }
        ctx.strokeStyle = '#0074D9';
        ctx.stroke();

        // update slider max once we know duration
        slider.max = decoded.duration;
      });

    // play/pause handlers
    playBtn.addEventListener('click', () => {
      if (audioCtx.state === 'suspended') audioCtx.resume();
      audio.play();
    });
    pauseBtn.addEventListener('click', () => audio.pause());

    // slider seeking
    slider.addEventListener('input', () => {
      audio.currentTime = parseFloat(slider.value);
    });

    // update slider as audio plays
    audio.addEventListener('timeupdate', () => {
      slider.value = audio.currentTime;
    });
  }
})();
