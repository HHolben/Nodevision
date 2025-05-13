// InfoMP4.js
(function(){
  function InfoMP4(fileUrl) {
    const container = document.createElement('div');

    // UI Elements
    const canvas = document.createElement('canvas');
    const video = document.createElement('video');
    canvas.width = 800;
    canvas.height = 200;
    canvas.style.border = '1px solid #ccc';
    video.src = fileUrl;
    video.controls = true;
    video.style.width = '800px';
    video.crossOrigin = 'anonymous';

    container.appendChild(canvas);
    container.appendChild(video);

    // Web Audio
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

    let recording = true;

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
      setTimeout(analyzeFrame, 100);
    }

    video.addEventListener('play', () => {
      if (audioCtx.state === 'suspended') audioCtx.resume();
      recording = true;
      analyzeFrame();
    });

    video.addEventListener('pause', () => recording = false);
    video.addEventListener('ended', () => {
      recording = false;
      drawWaveform();
    });

    function drawWaveform() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.beginPath();
      const samples = waveform.length;
      for (let i = 0; i < canvas.width; i++) {
        const index = Math.floor(i * samples / canvas.width);
        const y = (1 - waveform[index]) * canvas.height;
        ctx.lineTo(i, y);
      }
      ctx.strokeStyle = '#FF4136';
      ctx.stroke();
    }

    return container;
  }

  window.InfoMP4 = InfoMP4;
  window.nodevisionInfoExtensions = window.nodevisionInfoExtensions || {};
  window.nodevisionInfoExtensions['.mp4'] = InfoMP4;
})();
