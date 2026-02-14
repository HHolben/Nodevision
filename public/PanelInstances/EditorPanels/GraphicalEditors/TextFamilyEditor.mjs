import {
  resetEditorHooks,
  ensureNodevisionState,
  createBaseLayout,
  fetchText,
  saveText,
} from "./FamilyEditorCommon.mjs";

export async function renderEditor(filePath, container) {
  resetEditorHooks();
  ensureNodevisionState("TextFamilyEditing");
  const { status, body } = createBaseLayout(container, `Text Editor — ${filePath}`);

  try {
    const text = await fetchText(filePath);

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

    status.textContent = `Text loaded (${text.length.toLocaleString()} chars)`;
  } catch (err) {
    body.innerHTML = `<div style="color:#b00020;font:13px monospace;">Failed to load text: ${err.message}</div>`;
    status.textContent = "Load failed";
  }
}

