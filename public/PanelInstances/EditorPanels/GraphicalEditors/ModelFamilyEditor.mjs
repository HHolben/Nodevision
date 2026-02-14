import {
  resetEditorHooks,
  ensureNodevisionState,
  createBaseLayout,
  fetchArrayBuffer,
  fileExt,
  saveText,
  saveBase64,
} from "./FamilyEditorCommon.mjs";

function detectText(bytes) {
  if (!bytes || bytes.length === 0) return true;
  let suspicious = 0;
  const sampleLen = Math.min(bytes.length, 4096);
  for (let i = 0; i < sampleLen; i += 1) {
    const b = bytes[i];
    if (b === 0) return false;
    if (b < 7 || (b > 14 && b < 32)) suspicious += 1;
  }
  return suspicious / sampleLen < 0.15;
}

export async function renderEditor(filePath, container) {
  resetEditorHooks();
  ensureNodevisionState("ModelFamilyEditing");
  const { status, body } = createBaseLayout(container, `Model/CAD Editor — ${filePath}`);

  try {
    const buffer = await fetchArrayBuffer(filePath);
    const bytes = new Uint8Array(buffer);
    const ext = fileExt(filePath);
    const likelyTextExt = new Set(["obj", "ply", "step", "stp", "scad", "gcode", "dxf", "vtk", "sdf", "ifc", "usd", "usda"]);
    const isText = detectText(bytes) || likelyTextExt.has(ext);

    const info = document.createElement("div");
    info.style.cssText = "font:12px monospace;color:#555;";
    info.textContent = `Extension: ${ext || "(none)"} | Size: ${bytes.length.toLocaleString()} bytes`;
    body.appendChild(info);

    if (isText && bytes.length < 4 * 1024 * 1024) {
      const text = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
      const textarea = document.createElement("textarea");
      textarea.id = "markdown-editor";
      textarea.value = text;
      textarea.spellcheck = false;
      textarea.style.cssText = [
        "margin-top:8px",
        "width:100%",
        "height:calc(100% - 28px)",
        "min-height:260px",
        "resize:none",
        "padding:12px",
        "box-sizing:border-box",
        "font:13px/1.5 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
        "border:1px solid #c9c9c9",
        "border-radius:8px",
        "background:#fff",
        "color:#111",
      ].join(";");
      body.appendChild(textarea);

      window.getEditorMarkdown = () => textarea.value;
      window.saveMDFile = async (path = filePath) => {
        await saveText(path, textarea.value);
      };
      status.textContent = "Model text mode";
      return;
    }

    let replacementBase64 = "";
    const panel = document.createElement("div");
    panel.style.cssText = "margin-top:8px;border:1px solid #c9c9c9;border-radius:8px;padding:12px;background:#fafafa;font:13px/1.45 monospace;";
    panel.innerHTML = "<div>Binary model mode: use replacement upload and Save.</div>";
    body.appendChild(panel);

    const input = document.createElement("input");
    input.type = "file";
    input.style.cssText = "margin-top:10px;max-width:420px;";
    panel.appendChild(input);

    const msg = document.createElement("div");
    msg.style.cssText = "margin-top:8px;color:#666;font:12px monospace;";
    msg.textContent = "No replacement file loaded.";
    panel.appendChild(msg);

    input.addEventListener("change", async () => {
      const f = input.files?.[0];
      if (!f) return;
      const dataURL = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(f);
      });
      replacementBase64 = String(dataURL).split(",")[1] || "";
      msg.textContent = `Ready: ${f.name} (${f.size.toLocaleString()} bytes)`;
      status.textContent = "Replacement loaded. Press Save.";
    });

    window.saveWYSIWYGFile = async (path = filePath) => {
      if (!replacementBase64) throw new Error("No replacement file selected.");
      await saveBase64(path, replacementBase64);
    };
    status.textContent = "Model binary mode";
  } catch (err) {
    body.innerHTML = `<div style="color:#b00020;font:13px monospace;">Failed to load model file: ${err.message}</div>`;
    status.textContent = "Load failed";
  }
}

