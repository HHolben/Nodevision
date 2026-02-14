import {
  resetEditorHooks,
  ensureNodevisionState,
  createBaseLayout,
  fetchArrayBuffer,
  fileExt,
  saveBase64,
  escapeHTML,
} from "./FamilyEditorCommon.mjs";

function bytesToHexLines(bytes, bytesPerLine = 16, maxBytes = 1024) {
  const out = [];
  const limit = Math.min(bytes.length, maxBytes);
  for (let i = 0; i < limit; i += bytesPerLine) {
    const chunk = bytes.slice(i, i + bytesPerLine);
    const hex = Array.from(chunk).map((b) => b.toString(16).padStart(2, "0")).join(" ");
    out.push(`${i.toString(16).padStart(8, "0")}  ${hex}`);
  }
  return out.join("\n");
}

export async function renderEditor(filePath, container) {
  resetEditorHooks();
  ensureNodevisionState("BinaryFamilyEditing");
  const { status, body } = createBaseLayout(container, `Binary Editor — ${filePath}`);

  try {
    const buffer = await fetchArrayBuffer(filePath);
    const bytes = new Uint8Array(buffer);
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

    const summary = document.createElement("div");
    summary.innerHTML = `
      <div><strong>Extension:</strong> ${escapeHTML(ext || "(none)")}</div>
      <div><strong>Size:</strong> ${bytes.length.toLocaleString()} bytes</div>
      <div>Inline hex preview is read-only. Use replacement upload to edit.</div>
    `;
    panel.appendChild(summary);

    const pre = document.createElement("pre");
    pre.style.cssText = [
      "margin:0",
      "padding:10px",
      "max-height:45vh",
      "overflow:auto",
      "background:#111",
      "color:#ddd",
      "border-radius:6px",
      "font:12px/1.45 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
    ].join(";");
    pre.textContent = bytesToHexLines(bytes);
    panel.appendChild(pre);

    let replacementBase64 = "";
    const input = document.createElement("input");
    input.type = "file";
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

    status.textContent = "Binary preview ready";
  } catch (err) {
    body.innerHTML = `<div style="color:#b00020;font:13px monospace;">Failed to load binary file: ${err.message}</div>`;
    status.textContent = "Load failed";
  }
}

