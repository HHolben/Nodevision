// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/SoundRecordingHelpers.mjs
// This module provides browser audio recording MIME selection and Blob conversion helpers for the Sound Family Editor.

export function chooseRecordingMimeType(ext) {
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

export function toBase64FromBlob(blob) {
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
