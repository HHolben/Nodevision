// Nodevision/ApplicationSystem/public/PanelInstances/InfoPanels/TemplatePanel.mjs
// Overlay panel that displays available user templates as a grid.

import { listTemplates } from "/TemplateSystem/TemplateApi.mjs";
import { ensureTemplatePanelStyles } from "./TemplatePanelStyles.mjs";

function badgeFor(template) {
  if (template.kind === "form") return `form .${template.outputExtension || "html"}`;
  return `.${template.extension || "file"}`;
}

export function createPanel(contentElem, panelVars = {}, panelRoot = null) {
  ensureTemplatePanelStyles();

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
