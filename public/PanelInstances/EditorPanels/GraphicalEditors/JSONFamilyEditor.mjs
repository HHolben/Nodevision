import {
  resetEditorHooks,
  ensureNodevisionState,
  createBaseLayout,
  fetchText,
  saveText,
} from "./FamilyEditorCommon.mjs";

export async function renderEditor(filePath, container) {
  resetEditorHooks();
  ensureNodevisionState("JSONFamilyEditing");
  const { status, body } = createBaseLayout(container, `JSON Editor — ${filePath}`);

  const toolbar = document.createElement("div");
  toolbar.style.cssText = "display:flex;gap:8px;align-items:center;";

  const formatBtn = document.createElement("button");
  formatBtn.textContent = "Format JSON";
  formatBtn.style.cssText = "padding:6px 10px;cursor:pointer;";
  toolbar.appendChild(formatBtn);

  const validateLabel = document.createElement("span");
  validateLabel.style.cssText = "font:12px monospace;color:#555;";
  validateLabel.textContent = "Waiting for input...";
  toolbar.appendChild(validateLabel);

  body.appendChild(toolbar);

  const textarea = document.createElement("textarea");
  textarea.id = "markdown-editor";
  textarea.spellcheck = false;
  textarea.style.cssText = [
    "width:100%",
    "height:calc(100% - 40px)",
    "min-height:240px",
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

  const validate = () => {
    try {
      JSON.parse(textarea.value || "{}");
      validateLabel.textContent = "Valid JSON";
      validateLabel.style.color = "#166534";
      return true;
    } catch (err) {
      validateLabel.textContent = `Invalid JSON: ${err.message}`;
      validateLabel.style.color = "#b00020";
      return false;
    }
  };

  formatBtn.addEventListener("click", () => {
    try {
      const obj = JSON.parse(textarea.value || "{}");
      textarea.value = JSON.stringify(obj, null, 2);
      validate();
    } catch (err) {
      validateLabel.textContent = `Format failed: ${err.message}`;
      validateLabel.style.color = "#b00020";
    }
  });

  textarea.addEventListener("input", validate);

  try {
    const text = await fetchText(filePath);
    textarea.value = text;
    validate();

    window.getEditorMarkdown = () => textarea.value;
    window.saveMDFile = async (path = filePath) => {
      JSON.parse(textarea.value || "{}");
      await saveText(path, textarea.value);
    };

    status.textContent = "JSON loaded";
  } catch (err) {
    body.innerHTML = `<div style="color:#b00020;font:13px monospace;">Failed to load JSON: ${err.message}</div>`;
    status.textContent = "Load failed";
  }
}

