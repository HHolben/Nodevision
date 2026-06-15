// Nodevision/ApplicationSystem/public/PanelInstances/InfoPanels/NewDocumentOverlay.mjs
// Overlay panel for creating a new Notebook file.

const STYLE_ID = "nv-new-document-overlay-styles";

function ensureStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
.nv-new-document-panel {
  box-sizing: border-box;
  display: grid;
  gap: 14px;
  padding: 18px;
  color: #1f2937;
  background: #f8fafc;
}

.nv-new-document-panel form {
  display: grid;
  gap: 12px;
}

.nv-new-document-field {
  display: grid;
  gap: 6px;
}

.nv-new-document-field label,
.nv-new-document-template-option {
  font-size: 13px;
  font-weight: 650;
}

.nv-new-document-field input[type="text"] {
  box-sizing: border-box;
  width: 100%;
  padding: 9px 10px;
  color: #111827;
  background: #fff;
  border: 1px solid #9ca3af;
  border-radius: 6px;
  font: inherit;
}

.nv-new-document-field input[type="text"]:focus {
  outline: 2px solid rgba(0, 120, 215, 0.45);
  border-color: #0078d7;
}

.nv-new-document-template-option {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #111827;
}

.nv-new-document-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 2px;
}

.nv-new-document-actions button {
  border: 1px solid #6b7280;
  border-radius: 6px;
  padding: 8px 13px;
  background: #fff;
  color: #111827;
  font: inherit;
  cursor: pointer;
}

.nv-new-document-actions button.primary {
  border-color: #006fbe;
  background: #0078d7;
  color: #fff;
}

.nv-new-document-error {
  min-height: 18px;
  color: #b91c1c;
  font-size: 12px;
}

html[data-nv-theme="dark"] .nv-new-document-panel {
  color: #e5e7eb;
  background: #0f172a;
}

html[data-nv-theme="dark"] .nv-new-document-field input[type="text"],
html[data-nv-theme="dark"] .nv-new-document-actions button {
  color: #e5e7eb;
  background: #111827;
  border-color: #475569;
}

html[data-nv-theme="dark"] .nv-new-document-template-option {
  color: #e5e7eb;
}
`;
  document.head.appendChild(style);
}

export function createPanel(contentElem, panelVars = {}, panelRoot = null) {
  ensureStyles();

  const titleEl = panelRoot?.querySelector(".panel-title");
  if (titleEl) titleEl.textContent = panelVars.displayName || "New File";

  contentElem.innerHTML = "";

  const wrapper = document.createElement("div");
  wrapper.className = "nv-new-document-panel";

  const form = document.createElement("form");

  const filenameField = document.createElement("div");
  filenameField.className = "nv-new-document-field";

  const filenameLabel = document.createElement("label");
  filenameLabel.htmlFor = "nv-new-document-filename";
  filenameLabel.textContent = "File name";

  const filenameInput = document.createElement("input");
  filenameInput.id = "nv-new-document-filename";
  filenameInput.type = "text";
  filenameInput.placeholder = "example.html";
  filenameInput.required = true;
  filenameInput.value = panelVars.defaultFilename || "";

  filenameField.append(filenameLabel, filenameInput);

  const templateLabel = document.createElement("label");
  templateLabel.className = "nv-new-document-template-option";

  const templateCheckbox = document.createElement("input");
  templateCheckbox.type = "checkbox";
  templateCheckbox.checked = Boolean(panelVars.startFromTemplate);
  templateLabel.append(templateCheckbox, document.createTextNode("Start from a template"));

  const error = document.createElement("div");
  error.className = "nv-new-document-error";

  const actions = document.createElement("div");
  actions.className = "nv-new-document-actions";

  const cancelButton = document.createElement("button");
  cancelButton.type = "button";
  cancelButton.textContent = "Cancel";

  const submitButton = document.createElement("button");
  submitButton.type = "submit";
  submitButton.className = "primary";
  submitButton.textContent = "Create File";

  actions.append(cancelButton, submitButton);
  form.append(filenameField, templateLabel, error, actions);
  wrapper.appendChild(form);
  contentElem.appendChild(wrapper);

  cancelButton.addEventListener("click", () => {
    panelVars.onCancel?.();
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    error.textContent = "";

    if (!form.reportValidity()) return;
    const filename = filenameInput.value.trim();
    if (!filename) {
      error.textContent = "File name is required.";
      filenameInput.focus();
      return;
    }

    panelVars.onDone?.({
      filename,
      useTemplate: templateCheckbox.checked,
    });
  });

  requestAnimationFrame(() => filenameInput.focus());
}
