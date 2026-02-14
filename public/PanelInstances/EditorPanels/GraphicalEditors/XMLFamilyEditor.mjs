import {
  resetEditorHooks,
  ensureNodevisionState,
  createBaseLayout,
  fetchText,
  saveText,
} from "./FamilyEditorCommon.mjs";

function validateXML(text) {
  const doc = new DOMParser().parseFromString(text, "application/xml");
  const parseError = doc.querySelector("parsererror");
  if (parseError) throw new Error(parseError.textContent || "XML parse error");
  return doc;
}

export async function renderEditor(filePath, container) {
  resetEditorHooks();
  ensureNodevisionState("XMLFamilyEditing");
  const { status, body } = createBaseLayout(container, `XML Editor — ${filePath}`);

  const toolbar = document.createElement("div");
  toolbar.style.cssText = "display:flex;gap:8px;align-items:center;";
  body.appendChild(toolbar);

  const validateBtn = document.createElement("button");
  validateBtn.textContent = "Validate XML";
  validateBtn.style.cssText = "padding:6px 10px;cursor:pointer;";
  toolbar.appendChild(validateBtn);

  const stateLabel = document.createElement("span");
  stateLabel.style.cssText = "font:12px monospace;color:#555;";
  stateLabel.textContent = "Waiting for input...";
  toolbar.appendChild(stateLabel);

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

  const runValidation = () => {
    try {
      validateXML(textarea.value || "<root/>");
      stateLabel.textContent = "Valid XML";
      stateLabel.style.color = "#166534";
      return true;
    } catch (err) {
      stateLabel.textContent = `Invalid XML: ${err.message}`;
      stateLabel.style.color = "#b00020";
      return false;
    }
  };

  validateBtn.addEventListener("click", runValidation);
  textarea.addEventListener("input", runValidation);

  try {
    const text = await fetchText(filePath);
    textarea.value = text;
    runValidation();

    window.getEditorMarkdown = () => textarea.value;
    window.saveMDFile = async (path = filePath) => {
      validateXML(textarea.value || "<root/>");
      await saveText(path, textarea.value);
    };

    status.textContent = "XML loaded";
  } catch (err) {
    body.innerHTML = `<div style="color:#b00020;font:13px monospace;">Failed to load XML: ${err.message}</div>`;
    status.textContent = "Load failed";
  }
}

