import {
  resetEditorHooks,
  ensureNodevisionState,
  createBaseLayout,
  fileExt,
  saveBase64,
  escapeHTML,
} from "./FamilyEditorCommon.mjs";

const NOTEBOOK_BASE = "/Notebook";

export async function renderEditor(filePath, container) {
  resetEditorHooks();
  ensureNodevisionState("VideoFamilyEditing");
  const { status, body } = createBaseLayout(container, `Video Editor — ${filePath}`);

  const ext = fileExt(filePath);
  const mediaUrl = `${NOTEBOOK_BASE}/${filePath}`;

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
  meta.innerHTML = `<strong>Type:</strong> video | <strong>Extension:</strong> ${escapeHTML(ext || "(none)")}`;
  panel.appendChild(meta);

  const video = document.createElement("video");
  video.controls = true;
  video.src = mediaUrl;
  video.style.cssText = "max-width:100%;max-height:50vh;background:#000;";
  panel.appendChild(video);

  let replacementBase64 = "";
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "video/*";
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
    replaceState.textContent = `Ready to replace with ${file.name} (${file.size.toLocaleString()} bytes)`;
    status.textContent = "Replacement loaded. Press Save to apply.";
  });

  window.saveWYSIWYGFile = async (path = filePath) => {
    if (!replacementBase64) throw new Error("No replacement file selected.");
    await saveBase64(path, replacementBase64);
  };

  status.textContent = "Video preview ready";
}
