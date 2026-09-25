// Nodevision/ApplicationSystem/public/ToolbarJSONfiles/contextualCursorFamilyWidget.mjs
// Blender-like contextual cursor-family toolbar widget.

import { snapshotCursorFamily } from "/CursorFamilies/ContextualCursorFamilyRegistry.mjs";

const STYLE_ID = "nv-contextual-cursor-family-style";

function ensureStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    .nv-cursor-family-widget {
      position: relative;
      display: inline-flex;
      align-items: stretch;
      height: 30px;
      margin: 0 2px;
      border: 1px solid rgba(70, 92, 75, 0.55);
      border-radius: 6px;
      background: #f8faf8;
      overflow: visible;
    }
    .nv-cursor-family-main,
    .nv-cursor-family-menu-button {
      border: 0;
      background: transparent;
      color: #1f2a24;
      cursor: pointer;
      min-width: 28px;
      height: 28px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 5px;
      font: inherit;
      padding: 0 7px;
    }
    .nv-cursor-family-main:hover,
    .nv-cursor-family-menu-button:hover { background: rgba(98, 138, 109, 0.16); }
    .nv-cursor-family-menu-button { width: 20px; min-width: 20px; padding: 0; border-left: 1px solid rgba(70, 92, 75, 0.28); }
    .nv-cursor-family-glyph { font-weight: 700; min-width: 16px; text-align: center; }
    .nv-cursor-family-label { max-width: 86px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12px; }
    .nv-cursor-family-dropdown {
      position: absolute;
      top: calc(100% + 3px);
      left: 0;
      min-width: 184px;
      z-index: 10000;
      display: none;
      padding: 4px;
      border: 1px solid rgba(70, 92, 75, 0.45);
      border-radius: 6px;
      background: #ffffff;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18);
    }
    .nv-cursor-family-widget[data-open="true"] .nv-cursor-family-dropdown { display: block; }
    .nv-cursor-family-option {
      width: 100%;
      display: flex;
      align-items: center;
      gap: 8px;
      border: 0;
      background: transparent;
      padding: 6px 8px;
      border-radius: 4px;
      cursor: pointer;
      text-align: left;
      color: #1f2a24;
      font-size: 12px;
    }
    .nv-cursor-family-option:hover { background: rgba(98, 138, 109, 0.14); }
    .nv-cursor-family-option[aria-checked="true"] { background: rgba(47, 128, 255, 0.15); font-weight: 600; }
    .nv-cursor-family-option-kind { margin-left: auto; color: #607064; font-size: 11px; }
  `;
  document.head.appendChild(style);
}

function labelForTool(tool) {
  return String(tool?.label || tool?.id || "Cursor");
}

function glyphForTool(tool) {
  return String(tool?.glyph || "P");
}

function closeAllExcept(widget) {
  document.querySelectorAll(".nv-cursor-family-widget[data-open='true']").forEach((el) => {
    if (el !== widget) el.dataset.open = "false";
  });
}

function renderEmpty(host) {
  host.innerHTML = "";
  host.style.display = "none";
}

function buildOption(tool, activeToolId, provider, refresh) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "nv-cursor-family-option";
  button.setAttribute("role", "menuitemradio");
  button.setAttribute("aria-checked", String(tool.id === activeToolId));
  button.title = tool.description || labelForTool(tool);
  button.innerHTML = `<span class="nv-cursor-family-glyph"></span><span></span><span class="nv-cursor-family-option-kind"></span>`;
  button.children[0].textContent = glyphForTool(tool);
  button.children[1].textContent = labelForTool(tool);
  button.children[2].textContent = tool.kind === "drawing" ? "Draw" : "Select";
  button.addEventListener("click", async (event) => {
    event.preventDefault();
    event.stopPropagation();
    await provider.activateTool?.(tool.id);
    refresh({ keepOpen: false });
  });
  return button;
}

async function renderWidget(host, options = {}) {
  const token = (host.__nvCursorFamilyRenderToken || 0) + 1;
  host.__nvCursorFamilyRenderToken = token;
  const snapshot = await snapshotCursorFamily({ familyId: "selection" });
  if (host.__nvCursorFamilyRenderToken !== token) return;
  const { provider, tools, activeToolId } = snapshot;
  if (!provider || !tools.length || !activeToolId) {
    renderEmpty(host);
    return;
  }

  host.style.display = "inline-flex";
  const activeTool = tools.find((tool) => tool.id === activeToolId) || tools[0];
  const wasOpen = options.keepOpen && host.querySelector(".nv-cursor-family-widget")?.dataset?.open === "true";
  host.innerHTML = "";

  const widget = document.createElement("div");
  widget.className = "nv-cursor-family-widget";
  widget.dataset.open = wasOpen ? "true" : "false";
  widget.dataset.activeTool = activeTool.id;
  widget.dataset.providerId = provider.id || "";

  const main = document.createElement("button");
  main.type = "button";
  main.className = "nv-cursor-family-main";
  main.title = `Activate ${labelForTool(activeTool)}`;
  main.setAttribute("aria-label", `Activate ${labelForTool(activeTool)}`);
  main.innerHTML = `<span class="nv-cursor-family-glyph"></span><span class="nv-cursor-family-label"></span>`;
  main.children[0].textContent = glyphForTool(activeTool);
  main.children[1].textContent = labelForTool(activeTool);
  main.addEventListener("click", async (event) => {
    event.preventDefault();
    event.stopPropagation();
    await provider.activateTool?.(activeTool.id);
    renderWidget(host, { keepOpen: false });
  });

  const menuButton = document.createElement("button");
  menuButton.type = "button";
  menuButton.className = "nv-cursor-family-menu-button";
  menuButton.textContent = "v";
  menuButton.title = "Choose contextual cursor";
  menuButton.setAttribute("aria-haspopup", "menu");
  menuButton.setAttribute("aria-expanded", widget.dataset.open);
  menuButton.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    const nextOpen = widget.dataset.open !== "true";
    closeAllExcept(widget);
    widget.dataset.open = String(nextOpen);
    menuButton.setAttribute("aria-expanded", String(nextOpen));
  });

  const dropdown = document.createElement("div");
  dropdown.className = "nv-cursor-family-dropdown";
  dropdown.setAttribute("role", "menu");
  tools.forEach((tool) => dropdown.appendChild(buildOption(tool, activeTool.id, provider, renderWidget.bind(null, host))));

  widget.append(main, menuButton, dropdown);
  host.appendChild(widget);
}

export function initToolbarWidget(hostElement) {
  if (!hostElement) return;
  ensureStyle();
  if (hostElement.__nvCleanupCursorFamilyWidget) hostElement.__nvCleanupCursorFamilyWidget();

  const refresh = () => renderWidget(hostElement, { keepOpen: true });
  const closeOnDocumentClick = (event) => {
    if (hostElement.contains(event.target)) return;
    hostElement.querySelectorAll(".nv-cursor-family-widget[data-open='true']").forEach((el) => {
      el.dataset.open = "false";
      el.querySelector(".nv-cursor-family-menu-button")?.setAttribute("aria-expanded", "false");
    });
  };

  window.addEventListener("nv-contextual-cursor-family-changed", refresh);
  window.addEventListener("activePanelChanged", refresh);
  document.addEventListener("click", closeOnDocumentClick);
  hostElement.__nvCleanupCursorFamilyWidget = () => {
    window.removeEventListener("nv-contextual-cursor-family-changed", refresh);
    window.removeEventListener("activePanelChanged", refresh);
    document.removeEventListener("click", closeOnDocumentClick);
  };
  renderWidget(hostElement);
}
