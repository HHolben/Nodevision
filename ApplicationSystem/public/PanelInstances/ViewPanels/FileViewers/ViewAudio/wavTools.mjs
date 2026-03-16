// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/FileViewers/ViewAudio/wavTools.mjs
// This file defines WAV waveform utilities for the ViewAudio file viewer. It builds playback controls and renders animated waveform plots on a canvas.

export function fileExt(path = "") {
  const parts = String(path).toLowerCase().split(".");
  return parts.length > 1 ? parts.pop() : "";
}

export function buildWavControls(wrap, initial) {
  const controls = document.createElement("div");
  controls.style.cssText =
    "margin:6px 0 10px 0;display:flex;gap:8px;flex-wrap:wrap;align-items:center;font:12px monospace;";
  controls.innerHTML = `
    <label>Amplitude <input type="range" min="0.1" max="5" step="0.1" value="${initial.amplitudeScale}" id="ampScale"></label>
    <label>Time <input type="range" min="0.1" max="2" step="0.1" value="${initial.timeScale}" id="timeScale"></label>
    <label>V Offset <input type="range" min="-1" max="1" step="0.05" value="${initial.verticalOffset}" id="vertOffset"></label>
    <label>H Offset <input type="range" min="-1" max="1" step="0.01" value="${initial.horizontalOffset}" id="horizOffset"></label>
    <button id="toggleLines" type="button">Toggle Lines</button>
    <button id="pausePlay" type="button">Pause</button>
  `;
  wrap.appendChild(controls);
  const get = (id) => controls.querySelector(`#${id}`);
  return { controls, get };
}

export function renderWavAnimated(canvas, state) {
  const ctx = canvas.getContext("2d");
  if (!ctx || !state.buffer?.length) return;

  const {
    buffer,
    amplitudeScale,
    timeScale,
    verticalOffset,
    horizontalOffset,
    showConnectors,
  } = state;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const marginLeft = 50;
  const marginRight = 20;
  const marginTop = 20;
  const marginBottom = 40;
  const plotWidth = canvas.width - marginLeft - marginRight;
  const plotHeight = canvas.height - marginTop - marginBottom;

  const visibleSamples = Math.max(1, Math.floor(buffer.length * timeScale));
  const visibleData = buffer.slice(-visibleSamples);
  let maxVal = -1;
  let minVal = 1;
  for (let i = 0; i < visibleData.length; i += 1) {
    const v = visibleData[i];
    if (v > maxVal) maxVal = v;
    if (v < minVal) minVal = v;
  }
  if (!Number.isFinite(maxVal)) maxVal = 1;
  if (!Number.isFinite(minVal)) minVal = -1;
  const scaleY = plotHeight / Math.max(0.0001, maxVal - minVal);

  ctx.strokeStyle = "#222";
  ctx.lineWidth = 1;
  for (let i = 0; i <= 10; i += 1) {
    const y = marginTop + plotHeight - (i / 10) * plotHeight;
    ctx.beginPath();
    ctx.moveTo(marginLeft, y);
    ctx.lineTo(canvas.width - marginRight, y);
    ctx.stroke();
  }
  for (let i = 0; i <= 10; i += 1) {
    const x = marginLeft + (i / 10) * plotWidth;
    ctx.beginPath();
    ctx.moveTo(x, marginTop);
    ctx.lineTo(x, marginTop + plotHeight);
    ctx.stroke();
  }

  const zeroY =
    marginTop +
    plotHeight -
    (0 - minVal) * scaleY +
    (verticalOffset * plotHeight) / 2;
  ctx.strokeStyle = "#444";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(marginLeft, zeroY);
  ctx.lineTo(canvas.width - marginRight, zeroY);
  ctx.stroke();

  ctx.strokeStyle = "white";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(marginLeft, marginTop);
  ctx.lineTo(marginLeft, marginTop + plotHeight);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(marginLeft, marginTop + plotHeight);
  ctx.lineTo(canvas.width - marginRight, marginTop + plotHeight);
  ctx.stroke();

  ctx.fillStyle = "white";
  ctx.font = "12px monospace";
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  for (let i = 0; i <= 5; i += 1) {
    const val = minVal + (i / 5) * (maxVal - minVal);
    const y =
      marginTop +
      plotHeight -
      (val - minVal) * scaleY +
      (verticalOffset * plotHeight) / 2;
    ctx.fillText(val.toFixed(2), marginLeft - 8, y);
  }

  ctx.strokeStyle = "lime";
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i < visibleData.length; i += 1) {
    const x =
      marginLeft +
      (i / visibleData.length) * plotWidth +
      (horizontalOffset * plotWidth) / 2;
    const scaledVal = visibleData[i] * amplitudeScale;
    const y =
      marginTop +
      plotHeight -
      (scaledVal - minVal) * scaleY +
      (verticalOffset * plotHeight) / 2;
    if (showConnectors) {
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    } else {
      ctx.fillRect(x - 1, y - 1, 2, 2);
    }
  }
  if (showConnectors) ctx.stroke();
}

