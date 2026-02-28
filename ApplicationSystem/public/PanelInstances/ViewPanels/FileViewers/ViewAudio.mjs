// Nodevision/public/PanelInstances/ViewPanels/FileViewers/ViewAudio.mjs
// This file renders audio files with native playback controls for quick listening.
import { renderAudioWaveformFromUrl } from "/PanelInstances/Common/AudioWaveform.mjs";

function fileExt(path = "") {
  const parts = String(path).toLowerCase().split(".");
  return parts.length > 1 ? parts.pop() : "";
}

function buildWavControls(wrap, initial) {
  const controls = document.createElement("div");
  controls.style.cssText = "margin:6px 0 10px 0;display:flex;gap:8px;flex-wrap:wrap;align-items:center;font:12px monospace;";
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

function renderWavAnimated(canvas, state) {
  const ctx = canvas.getContext("2d");
  if (!ctx || !state.buffer?.length) return;

  const { buffer, amplitudeScale, timeScale, verticalOffset, horizontalOffset, showConnectors } = state;
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
  const scaleY = plotHeight / Math.max(0.0001, (maxVal - minVal));

  ctx.strokeStyle = "#222";
  ctx.lineWidth = 1;
  for (let i = 0; i <= 10; i += 1) {
    const y = marginTop + plotHeight - ((i / 10) * plotHeight);
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

  const zeroY = marginTop + plotHeight - ((0 - minVal) * scaleY) + verticalOffset * plotHeight / 2;
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
    const y = marginTop + plotHeight - ((val - minVal) * scaleY) + verticalOffset * plotHeight / 2;
    ctx.fillText(val.toFixed(2), marginLeft - 8, y);
  }

  ctx.strokeStyle = "lime";
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i < visibleData.length; i += 1) {
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

export async function renderFile(filename, viewPanel, iframe, serverBase) {
  viewPanel.innerHTML = "";
  const src = `${serverBase}/${filename}`;
  const ext = fileExt(filename);

  const audio = document.createElement("audio");
  audio.controls = true;
  audio.style.width = "100%";
  audio.src = src;

  const wrap = document.createElement("div");
  wrap.style.padding = "1rem";

  const title = document.createElement("p");
  title.style.marginTop = "0";
  title.innerHTML = `Audio file: <code>${filename}</code>`;

  const waveform = document.createElement("canvas");
  waveform.height = ext === "wav" ? 300 : 180;
  waveform.style.cssText = "width:100%;display:block;border:1px solid #333;background:#0a0a0a;margin-bottom:10px;";

  const waveStatus = document.createElement("div");
  waveStatus.style.cssText = "font:12px monospace;color:#666;margin-bottom:8px;";
  waveStatus.textContent = "Loading waveform...";

  const resizeWaveform = () => {
    const width = Math.max(300, Math.floor(wrap.clientWidth - 2));
    waveform.width = width;
  };
  resizeWaveform();

  wrap.appendChild(title);
  wrap.appendChild(waveStatus);
  wrap.appendChild(waveform);
  wrap.appendChild(audio);
  viewPanel.appendChild(wrap);

  if (ext === "wav") {
    const state = {
      buffer: [],
      amplitudeScale: 1.0,
      timeScale: 1.0,
      verticalOffset: 0.0,
      horizontalOffset: 0.0,
      showConnectors: true,
      isPlaying: true,
    };
    const { get } = buildWavControls(wrap, state);
    get("ampScale").oninput = (e) => { state.amplitudeScale = parseFloat(e.target.value); };
    get("timeScale").oninput = (e) => { state.timeScale = parseFloat(e.target.value); };
    get("vertOffset").oninput = (e) => { state.verticalOffset = parseFloat(e.target.value); };
    get("horizOffset").oninput = (e) => { state.horizontalOffset = parseFloat(e.target.value); };
    get("toggleLines").onclick = () => { state.showConnectors = !state.showConnectors; };
    get("pausePlay").onclick = (e) => {
      state.isPlaying = !state.isPlaying;
      e.target.textContent = state.isPlaying ? "Pause" : "Play";
    };

    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const res = await fetch(src);
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      const arrayBuffer = await res.arrayBuffer();
      const decoded = await audioCtx.decodeAudioData(arrayBuffer);
      state.buffer = Array.from(decoded.getChannelData(0));
      waveStatus.textContent = "Waveform ready";

      const animate = () => {
        if (state.isPlaying && state.buffer.length > 1) {
          const first = state.buffer.shift();
          state.buffer.push(first);
        }
        renderWavAnimated(waveform, state);
        requestAnimationFrame(animate);
      };
      animate();
      return;
    } catch (err) {
      console.warn("ViewAudio WAV waveform failed:", err);
      waveStatus.textContent = `Waveform unavailable: ${err?.message || err}`;
      return;
    }
  }

  try {
    await renderAudioWaveformFromUrl(src, waveform);
    waveStatus.textContent = "Waveform ready";
  } catch (err) {
    console.warn("ViewAudio waveform failed:", err);
    waveStatus.textContent = `Waveform unavailable: ${err?.message || err}`;
  }
}
