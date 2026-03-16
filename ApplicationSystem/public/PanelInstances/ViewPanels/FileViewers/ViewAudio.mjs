// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/FileViewers/ViewAudio.mjs
// This file renders audio files with native playback controls for quick listening.
import { renderAudioWaveformFromUrl } from "/PanelInstances/Common/AudioWaveform.mjs";
import { buildWavControls, fileExt, renderWavAnimated } from "./ViewAudio/wavTools.mjs";

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
