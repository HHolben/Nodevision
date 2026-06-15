// Nodevision/ApplicationSystem/public/TemplateSystem/TemplatePicker.mjs
// Shared modal picker for Nodevision user templates.

import { listTemplates } from "./TemplateApi.mjs";

const STYLE_ID = "nodevision-template-system-styles";

export function ensureTemplateSystemStyles() {
  if (document.getElementById(STYLE_ID)) return;

  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
.nodevision-template-overlay {
  position: fixed;
  inset: 0;
  z-index: 32000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  background: rgba(0, 0, 0, 0.48);
  font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

.nodevision-template-dialog {
  width: min(720px, calc(100vw - 32px));
  max-height: min(680px, calc(100vh - 32px));
  display: flex;
  flex-direction: column;
  gap: 12px;
  color: #f7f7f7;
  background: #101317;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 8px;
  box-shadow: 0 22px 72px rgba(0, 0, 0, 0.45);
  padding: 18px;
}

.nodevision-template-title {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 650;
}

.nodevision-template-description {
  margin: -6px 0 0;
  color: #c7cbd1;
  font-size: 0.9rem;
}

.nodevision-template-search,
.nodevision-template-field input,
.nodevision-template-field textarea,
.nodevision-template-field select {
  box-sizing: border-box;
  width: 100%;
  padding: 9px 10px;
  color: #f7f7f7;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 6px;
  font: inherit;
}

.nodevision-template-search:focus,
.nodevision-template-field input:focus,
.nodevision-template-field textarea:focus,
.nodevision-template-field select:focus {
  outline: 2px solid rgba(10, 132, 255, 0.65);
  border-color: rgba(10, 132, 255, 0.85);
}

.nodevision-template-list {
  min-height: 220px;
  max-height: 380px;
  overflow: auto;
  display: grid;
  gap: 6px;
  padding: 2px;
}

.nodevision-template-option {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 8px;
  align-items: center;
  text-align: left;
  color: #f7f7f7;
  background: rgba(255, 255, 255, 0.055);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  padding: 9px 10px;
  cursor: pointer;
}

.nodevision-template-option:hover,
.nodevision-template-option.is-selected {
  border-color: rgba(10, 132, 255, 0.8);
  background: rgba(10, 132, 255, 0.18);
}

.nodevision-template-option-name {
  overflow-wrap: anywhere;
  font-weight: 600;
}

.nodevision-template-option-path {
  margin-top: 2px;
  color: #aeb6c2;
  font-size: 0.78rem;
  overflow-wrap: anywhere;
}

.nodevision-template-badge {
  padding: 3px 7px;
  color: #dce8ff;
  background: rgba(10, 132, 255, 0.22);
  border: 1px solid rgba(10, 132, 255, 0.34);
  border-radius: 999px;
  font-size: 0.75rem;
}

.nodevision-template-empty {
  padding: 18px;
  color: #c7cbd1;
  border: 1px dashed rgba(255, 255, 255, 0.18);
  border-radius: 6px;
}

.nodevision-template-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.nodevision-template-actions button {
  border: 0;
  border-radius: 6px;
  padding: 8px 14px;
  color: #f7f7f7;
  background: rgba(255, 255, 255, 0.12);
  font: inherit;
  cursor: pointer;
}

.nodevision-template-actions button.primary {
  background: #0a84ff;
}

.nodevision-template-actions button:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.nodevision-template-form {
  display: grid;
  gap: 12px;
  overflow: auto;
  padding-right: 2px;
}

.nodevision-template-field {
  display: grid;
  gap: 5px;
}

.nodevision-template-field label,
.nodevision-template-field legend {
  color: #dce2eb;
  font-size: 0.88rem;
  font-weight: 600;
}

.nodevision-template-field textarea {
  min-height: 96px;
  resize: vertical;
}

.nodevision-template-radio-group {
  display: grid;
  gap: 6px;
  padding: 0;
  border: 0;
}

.nodevision-template-choice {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #f7f7f7;
}

.nodevision-template-choice input {
  width: auto;
}

.nodevision-template-error {
  min-height: 18px;
  color: #ffbaba;
  font-size: 0.84rem;
}
`;
  document.head.appendChild(style);
}

export async function showTemplatePicker(options = {}) {
  ensureTemplateSystemStyles();
  const templates = await listTemplates();

  return new Promise((resolve) => {
    let selected = templates[0] || null;

    const overlay = document.createElement("div");
    overlay.className = "nodevision-template-overlay";
    overlay.tabIndex = -1;

    const dialog = document.createElement("div");
    dialog.className = "nodevision-template-dialog";
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");

    const title = document.createElement("h2");
    title.className = "nodevision-template-title";
    title.textContent = options.title || "Choose Template";

    const description = document.createElement("p");
    description.className = "nodevision-template-description";
    description.textContent = options.description || "Select a user template from UserData/UserTemplates/RawTemplates or FormTemplates.";

    const search = document.createElement("input");
    search.className = "nodevision-template-search";
    search.type = "search";
    search.placeholder = "Filter templates";

    const list = document.createElement("div");
    list.className = "nodevision-template-list";

    const actions = document.createElement("div");
    actions.className = "nodevision-template-actions";

    const cancelButton = document.createElement("button");
    cancelButton.type = "button";
    cancelButton.textContent = "Cancel";

    const selectButton = document.createElement("button");
    selectButton.type = "button";
    selectButton.className = "primary";
    selectButton.textContent = options.confirmText || "Choose";
    selectButton.disabled = !selected;

    actions.append(cancelButton, selectButton);
    dialog.append(title, description, search, list, actions);
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    const cleanup = () => {
      document.removeEventListener("keydown", handleKeydown, true);
      overlay.remove();
    };

    const finish = (value) => {
      cleanup();
      resolve(value || null);
    };

    function render() {
      const query = search.value.trim().toLowerCase();
      const visible = templates.filter((template) => {
        const haystack = `${template.displayName} ${template.relativePath} ${template.kind}`.toLowerCase();
        return !query || haystack.includes(query);
      });
      list.innerHTML = "";

      if (!visible.length) {
        const empty = document.createElement("div");
        empty.className = "nodevision-template-empty";
        empty.textContent = templates.length ? "No templates match the filter." : "No templates found.";
        list.appendChild(empty);
        selected = null;
        selectButton.disabled = true;
        return;
      }

      if (!selected || !visible.some((template) => template.relativePath === selected.relativePath)) {
        selected = visible[0];
      }

      for (const template of visible) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "nodevision-template-option";
        if (selected?.relativePath === template.relativePath) button.classList.add("is-selected");

        const textWrap = document.createElement("span");
        const name = document.createElement("span");
        name.className = "nodevision-template-option-name";
        name.textContent = template.displayName || template.relativePath;
        const rel = document.createElement("span");
        rel.className = "nodevision-template-option-path";
        rel.textContent = template.relativePath;
        textWrap.append(name, rel);

        const badge = document.createElement("span");
        badge.className = "nodevision-template-badge";
        badge.textContent = template.kind === "form"
          ? `form -> .${template.outputExtension || "html"}`
          : `.${template.extension || "file"}`;

        button.append(textWrap, badge);
        button.addEventListener("click", () => {
          selected = template;
          render();
        });
        button.addEventListener("dblclick", () => finish(template));
        list.appendChild(button);
      }

      selectButton.disabled = !selected;
    }

    function handleKeydown(event) {
      if (event.key === "Escape") finish(null);
      if (event.key === "Enter" && selected && document.activeElement !== search) {
        event.preventDefault();
        finish(selected);
      }
    }

    search.addEventListener("input", render);
    cancelButton.addEventListener("click", () => finish(null));
    selectButton.addEventListener("click", () => finish(selected));
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) finish(null);
    });
    document.addEventListener("keydown", handleKeydown, true);

    render();
    requestAnimationFrame(() => search.focus());
  });
}

