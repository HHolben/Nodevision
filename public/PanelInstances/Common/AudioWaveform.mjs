// Shared audio waveform renderer for viewers and editors.

function drawWaveform(canvas, channelData) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const width = Math.max(1, canvas.width);
  const height = Math.max(1, canvas.height);
  const midY = Math.floor(height / 2);
  const step = Math.max(1, Math.floor(channelData.length / width));

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#0a0a0a";
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = "#2f2f2f";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, midY + 0.5);
  ctx.lineTo(width, midY + 0.5);
  ctx.stroke();

  ctx.strokeStyle = "#48d14f";
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 0; x < width; x += 1) {
    const start = x * step;
    const end = Math.min(channelData.length, start + step);
    let min = 1;
    let max = -1;
    for (let i = start; i < end; i += 1) {
      const v = channelData[i];
      if (v < min) min = v;
      if (v > max) max = v;
    }
    const y1 = Math.max(0, Math.min(height, (1 - max) * 0.5 * height));
    const y2 = Math.max(0, Math.min(height, (1 - min) * 0.5 * height));
    ctx.moveTo(x + 0.5, y1);
    ctx.lineTo(x + 0.5, y2);
  }
  ctx.stroke();
}

export async function renderAudioWaveformFromUrl(url, canvas) {
  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    const arrayBuffer = await res.arrayBuffer();
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
    const channelData = audioBuffer.getChannelData(0);
    drawWaveform(canvas, channelData);
  } finally {
    try {
      await audioCtx.close();
    } catch (_) {
      // ignore
    }
  }
}
