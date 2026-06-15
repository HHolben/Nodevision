// Nodevision/ApplicationSystem/public/PanelInstances/InfoPanels/TemplatePanel.mjs
// Overlay panel that displays available user templates as a grid.

import { listTemplates } from "/TemplateSystem/TemplateApi.mjs";

const STYLE_ID = "nv-template-panel-styles";

function ensureStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
.nv-template-panel {
  box-sizing: border-box;
  display: grid;
  gap: 12px;
  min-height: 340px;
  padding: 16px;
  color: #1f2937;
  background: #f8fafc;
}

.nv-template-panel-search {
  box-sizing: border-box;
  width: 100%;
  padding: 8px 10px;
  color: #111827;
  background: #fff;
  border: 1px solid #9ca3af;
  border-radius: 6px;
  font: inherit;
}

.nv-template-panel-search:focus {
  outline: 2px solid rgba(0, 120, 215, 0.45);
  border-color: #0078d7;
}

.nv-template-panel-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 10px;
  align-content: start;
  min-height: 220px;
  max-height: 430px;
  overflow: auto;
  padding: 2px;
}

.nv-template-panel-card {
  min-height: 122px;
  display: grid;
  grid-template-rows: auto 1fr auto;
  gap: 8px;
  text-align: left;
  color: #111827;
  background: #fff;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  padding: 10px;
  cursor: pointer;
}

.nv-template-panel-card:hover,
.nv-template-panel-card:focus {
  outline: 2px solid rgba(0, 120, 215, 0.45);
  border-color: #0078d7;
}

.nv-template-panel-name {
  font-size: 13px;
  font-weight: 700;
  overflow-wrap: anywhere;
}

.nv-template-panel-path {
  color: #64748b;
  font-size: 11px;
  overflow-wrap: anywhere;
}

.nv-template-panel-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.nv-template-panel-badge {
  padding: 3px 7px;
  color: #075985;
  background: #e0f2fe;
  border: 1px solid #7dd3fc;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 650;
}

.nv-template-panel-empty,
.nv-template-panel-error {
  padding: 14px;
  color: #475569;
  border: 1px dashed #94a3b8;
  border-radius: 6px;
}

.nv-template-panel-error {
  color: #b91c1c;
}

.nv-template-panel-actions {
  display: flex;
  justify-content: flex-end;
}

.nv-template-panel-actions button {
  border: 1px solid #6b7280;
  border-radius: 6px;
  padding: 8px 13px;
  background: #fff;
  color: #111827;
  font: inherit;
  cursor: pointer;
}

html[data-nv-theme="dark"] .nv-template-panel {
  color: #e5e7eb;
  background: #0f172a;
}

html[data-nv-theme="dark"] .nv-template-panel-search,
html[data-nv-theme="dark"] .nv-template-panel-card,
html[data-nv-theme="dark"] .nv-template-panel-actions button {
  color: #e5e7eb;
  background: #111827;
  border-color: #475569;
}

html[data-nv-theme="dark"] .nv-template-panel-path,
html[data-nv-theme="dark"] .nv-template-panel-empty {
  color: #cbd5e1;
}
`;
  document.head.appendChild(style);
}

function badgeFor(template) {
  if (template.kind === "form") return `form .${template.outputExtension || "html"}`;
  return `.${template.extension || "file"}`;
}

export function createPanel(contentElem, panelVars = {}, panelRoot = null) {
  ensureStyles();

  const titleEl = panelRoot?.querySelector(".panel-title");
  if (titleEl) titleEl.textContent = panelVars.displayName || "Template Panel";

  contentElem.innerHTML = "";

  const wrapper = document.createElement("div");
  wrapper.className = "nv-template-panel";

  const search = document.createElement("input");
  search.className = "nv-template-panel-search";
  search.type = "search";
  search.placeholder = "Filter templates";

  const grid = document.createElement("div");
  grid.className = "nv-template-panel-grid";

  const actions = document.createElement("div");
  actions.className = "nv-template-panel-actions";
  const cancelButton = document.createElement("button");
  cancelButton.type = "button";
  cancelButton.textContent = "Cancel";
  actions.appendChild(cancelButton);

  wrapper.append(search, grid, actions);
  contentElem.appendChild(wrapper);

  let templates = [];

  function render() {
    const query = search.value.trim().toLowerCase();
    const visible = templates.filter((template) => {
      const haystack = `${template.displayName || ""} ${template.relativePath || ""} ${template.kind || ""}`.toLowerCase();
      return !query || haystack.includes(query);
    });

    grid.innerHTML = "";

    if (!visible.length) {
      const empty = document.createElement("div");
      empty.className = "nv-template-panel-empty";
      empty.textContent = templates.length ? "No templates match the filter." : "No templates found.";
      grid.appendChild(empty);
      return;
    }

    for (const template of visible) {
      const card = document.createElement("button");
      card.type = "button";
      card.className = "nv-template-panel-card";

      const name = document.createElement("div");
      name.className = "nv-template-panel-name";
      name.textContent = template.displayName || template.relativePath;

      const path = document.createElement("div");
      path.className = "nv-template-panel-path";
      path.textContent = template.relativePath;

      const meta = document.createElement("div");
      meta.className = "nv-template-panel-meta";
      const badge = document.createElement("span");
      badge.className = "nv-template-panel-badge";
      badge.textContent = badgeFor(template);
      meta.appendChild(badge);

      card.append(name, path, meta);
      card.addEventListener("click", () => panelVars.onDone?.(template));
      grid.appendChild(card);
    }
  }

  async function load() {
    grid.innerHTML = "";
    const loading = document.createElement("div");
    loading.className = "nv-template-panel-empty";
    loading.textContent = "Loading templates...";
    grid.appendChild(loading);

    try {
      templates = await listTemplates();
      render();
    } catch (err) {
      grid.innerHTML = "";
      const error = document.createElement("div");
      error.className = "nv-template-panel-error";
      error.textContent = err?.message || "Unable to load templates.";
      grid.appendChild(error);
    }
  }

  cancelButton.addEventListener("click", () => panelVars.onCancel?.());
  search.addEventListener("input", render);
  load();
  requestAnimationFrame(() => search.focus());
}
