import {
  resetEditorHooks,
  ensureNodevisionState,
  createBaseLayout,
  fileExt,
  saveBase64,
  escapeHTML,
} from "./FamilyEditorCommon.mjs";
import { renderAudioWaveformFromUrl } from "/PanelInstances/Common/AudioWaveform.mjs";

const NOTEBOOK_BASE = "/Notebook";

function chooseRecordingMimeType(ext) {
  const preferred = [];
  if (ext === "ogg" || ext === "opus") preferred.push("audio/ogg;codecs=opus", "audio/ogg");
  if (ext === "webm") preferred.push("audio/webm;codecs=opus", "audio/webm");
  preferred.push("audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/ogg");

  if (typeof MediaRecorder === "undefined") return "";
  for (const mime of preferred) {
    try {
      if (MediaRecorder.isTypeSupported(mime)) return mime;
    } catch (_) {
      // ignore and continue
    }
  }
  return "";
}

function toBase64FromBlob(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataURL = String(reader.result || "");
      resolve(dataURL.split(",")[1] || "");
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export async function renderEditor(filePath, container) {
  resetEditorHooks();
  ensureNodevisionState("SoundFamilyEditing");
  const { status, body } = createBaseLayout(container, `Sound Editor — ${filePath}`);

  const ext = fileExt(filePath);
  const panel = document.createElement("div");
  panel.style.cssText = [
    "display:flex",
    "flex-direction:column",
    "gap:10px",
    "border:1px solid #c9c9c9",
    "border-radius:8px",
    "padding:12px",
    "font:13px/1.45 monospace",
    "background:#fafafa",
  ].join(";");
  body.appendChild(panel);

  const meta = document.createElement("div");
  meta.innerHTML = `<strong>Type:</strong> audio | <strong>Extension:</strong> ${escapeHTML(ext || "(none)")}`;
  panel.appendChild(meta);

  const audio = document.createElement("audio");
  audio.controls = true;
  audio.style.width = "100%";
  panel.appendChild(audio);

  const waveformStatus = document.createElement("div");
  waveformStatus.style.cssText = "font:12px monospace;color:#666;";
  waveformStatus.textContent = "Loading waveform...";
  panel.appendChild(waveformStatus);

  const waveform = document.createElement("canvas");
  waveform.height = 180;
  waveform.style.cssText = "width:100%;display:block;border:1px solid #333;background:#0a0a0a;";
  panel.appendChild(waveform);

  const resizeWaveform = () => {
    const width = Math.max(300, Math.floor(panel.clientWidth - 26));
    waveform.width = width;
  };
  resizeWaveform();

  const updateWaveform = async (url) => {
    if (!url) return;
    resizeWaveform();
    waveformStatus.textContent = "Loading waveform...";
    try {
      await renderAudioWaveformFromUrl(url, waveform);
      waveformStatus.textContent = "Waveform ready";
    } catch (err) {
      console.warn("Sound editor waveform failed:", err);
      waveformStatus.textContent = `Waveform unavailable: ${err?.message || err}`;
    }
  };

  const refreshAudioSrc = () => {
    const url = `${NOTEBOOK_BASE}/${filePath}?v=${Date.now()}`;
    audio.src = url;
    updateWaveform(url);
  };
  refreshAudioSrc();

  const controlsRow = document.createElement("div");
  controlsRow.style.cssText = "display:flex;gap:8px;align-items:center;flex-wrap:wrap;";
  panel.appendChild(controlsRow);

  const recordBtn = document.createElement("button");
  recordBtn.type = "button";
  recordBtn.textContent = "Record";
  controlsRow.appendChild(recordBtn);

  const recordHint = document.createElement("span");
  recordHint.style.cssText = "font:12px monospace;color:#666;";
  recordHint.textContent = "Records from your microphone and saves over the opened file.";
  controlsRow.appendChild(recordHint);

  let replacementBase64 = "";
  let replacementMime = "application/octet-stream";
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "audio/*";
  input.style.cssText = "max-width:420px;";
  panel.appendChild(input);

  const replaceState = document.createElement("div");
  replaceState.style.cssText = "font:12px monospace;color:#666;";
  replaceState.textContent = "No replacement file loaded.";
  panel.appendChild(replaceState);

  input.addEventListener("change", async () => {
    const file = input.files?.[0];
    if (!file) return;
    const dataURL = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    replacementBase64 = String(dataURL).split(",")[1] || "";
    replacementMime = file.type || "application/octet-stream";
    replaceState.textContent = `Ready to replace with ${file.name} (${file.size.toLocaleString()} bytes)`;
    status.textContent = "Replacement loaded. Press Save to apply.";
  });

  let recorder = null;
  let recorderStream = null;
  let recordingChunks = [];

  async function stopRecordingAndSave() {
    if (!recorder) return;
    const currentRecorder = recorder;
    await new Promise((resolve) => {
      currentRecorder.addEventListener("stop", resolve, { once: true });
      currentRecorder.stop();
    });
  }

  recordBtn.addEventListener("click", async () => {
    if (recorder && recorder.state === "recording") {
      recordBtn.disabled = true;
      status.textContent = "Stopping recording...";
      try {
        await stopRecordingAndSave();
      } finally {
        recordBtn.disabled = false;
      }
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      status.textContent = "Recording unavailable: browser does not support microphone capture.";
      return;
    }

    try {
      recorderStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recordingChunks = [];
      const mimeType = chooseRecordingMimeType(ext);
      recorder = mimeType
        ? new MediaRecorder(recorderStream, { mimeType })
        : new MediaRecorder(recorderStream);

      recorder.addEventListener("dataavailable", (event) => {
        if (event.data && event.data.size > 0) recordingChunks.push(event.data);
      });

      recorder.addEventListener("stop", async () => {
        try {
          const blob = new Blob(recordingChunks, { type: recorder.mimeType || "audio/webm" });
          const base64 = await toBase64FromBlob(blob);
          replacementBase64 = base64;
          replacementMime = blob.type || "audio/webm";
          await saveBase64(filePath, replacementBase64, replacementMime);
          replaceState.textContent = `Recorded ${Math.round(blob.size / 1024)} KB and saved over ${filePath}.`;
          status.textContent = "Recording saved successfully.";
          refreshAudioSrc();
        } catch (err) {
          console.warn("Sound record save failed:", err);
          status.textContent = `Recording failed: ${err?.message || err}`;
        } finally {
          if (recorderStream) {
            recorderStream.getTracks().forEach((track) => track.stop());
          }
          recorderStream = null;
          recorder = null;
          recordingChunks = [];
          recordBtn.textContent = "Record";
        }
      });

      recorder.start();
      recordBtn.textContent = "Stop";
      status.textContent = "Recording... click Stop to save over this file.";
    } catch (err) {
      console.warn("Microphone access failed:", err);
      status.textContent = `Microphone access failed: ${err?.message || err}`;
      if (recorderStream) recorderStream.getTracks().forEach((track) => track.stop());
      recorderStream = null;
      recorder = null;
      recordingChunks = [];
      recordBtn.textContent = "Record";
    }
  });

  window.saveWYSIWYGFile = async (path = filePath) => {
    if (!replacementBase64) throw new Error("No recorded or replacement audio loaded.");
    await saveBase64(path, replacementBase64, replacementMime);
    refreshAudioSrc();
  };

  status.textContent = "Sound editor ready";
}
