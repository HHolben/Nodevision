import {
  resetEditorHooks,
  ensureNodevisionState,
  createBaseLayout,
  fetchArrayBuffer,
  fileExt,
  saveText,
  saveBase64,
} from "./FamilyEditorCommon.mjs";

const NOTEBOOK_BASE = "/Notebook";

function isLikelyText(ext) {
  return new Set(["txt", "md", "pgn", "ly", "musicxml", "mei", "csv", "tsv", "xml"]).has(ext);
}

export async function renderEditor(filePath, container) {
  resetEditorHooks();
  ensureNodevisionState("DocumentFamilyEditing");
  const { status, body } = createBaseLayout(container, `Document Editor — ${filePath}`);

  const ext = fileExt(filePath);
  const url = `${NOTEBOOK_BASE}/${filePath}`;

  try {
    const buffer = await fetchArrayBuffer(filePath);
    const bytes = new Uint8Array(buffer);

    if (ext === "pdf") {
      const iframe = document.createElement("iframe");
      iframe.src = url;
      iframe.style.cssText = "width:100%;height:100%;border:1px solid #c9c9c9;border-radius:8px;background:#fff;";
      body.appendChild(iframe);
      status.textContent = `PDF preview (${bytes.length.toLocaleString()} bytes)`;
    } else if (isLikelyText(ext) && bytes.length < 4 * 1024 * 1024) {
      const text = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
      const textarea = document.createElement("textarea");
      textarea.id = "markdown-editor";
      textarea.value = text;
      textarea.spellcheck = false;
      textarea.style.cssText = [
        "width:100%",
        "height:100%",
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
      status.textContent = "Document text mode";
    } else {
      const note = document.createElement("div");
      note.style.cssText = "border:1px solid #c9c9c9;border-radius:8px;padding:12px;background:#fafafa;font:13px/1.45 monospace;";
      note.innerHTML = `
        <div>Preview available in file viewer. This editor supports replacement save.</div>
        <div>Size: ${bytes.length.toLocaleString()} bytes</div>
      `;
      body.appendChild(note);
      status.textContent = "Document binary mode";
    }

    let replacementBase64 = "";
    const input = document.createElement("input");
    input.type = "file";
    input.style.cssText = "margin-top:10px;max-width:420px;";
    body.appendChild(input);

    const msg = document.createElement("div");
    msg.style.cssText = "margin-top:8px;color:#666;font:12px monospace;";
    msg.textContent = "No replacement file loaded.";
    body.appendChild(msg);

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
  } catch (err) {
    body.innerHTML = `<div style="color:#b00020;font:13px monospace;">Failed to load document: ${err.message}</div>`;
    status.textContent = "Load failed";
  }
}

