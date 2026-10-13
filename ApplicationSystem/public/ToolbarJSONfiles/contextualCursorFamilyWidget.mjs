// Nodevision/ApplicationSystem/public/ToolbarJSONfiles/contextualCursorFamilyWidget.mjs
// Blender-like contextual cursor-family toolbar widget.

import { toolGlyphs } from "/CursorFamilies/ActiveToolPresentation.mjs";
import { activeToolPanel } from "/CursorFamilies/PanelActiveTool.mjs";
import { snapshotCursorFamily } from "/CursorFamilies/ContextualCursorFamilyRegistry.mjs";

import { ensureStyle } from "/CursorFamilies/ContextualCursorStyle.mjs";

function labelForTool(tool) {
  return String(tool?.label || tool?.id || "Cursor");
}

function glyphForTool(tool) {
  return String(toolGlyphs[tool?.id] || tool?.glyph || "↖");
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
  button.disabled = tool.readOnly === true;
  button.title = tool.description || labelForTool(tool);
  button.innerHTML = `<span class="nv-cursor-family-glyph"></span><span></span><span class="nv-cursor-family-option-kind"></span>`;
  button.children[0].textContent = glyphForTool(tool);
  button.children[1].textContent = labelForTool(tool);
  button.children[2].textContent = tool.kind === "drawing" ? "Draw" : tool.kind === "interaction" ? "Mode" : "Select";
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
  const panel=activeToolPanel(), signature=JSON.stringify([provider?.id,activeToolId,tools]);
  if(host.__nvCursorSignature===signature && host.__nvCursorPanel===panel && options.keepOpen)return;
  host.__nvCursorSignature=signature;host.__nvCursorPanel=panel;
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
  main.disabled = activeTool.readOnly === true;
  main.title = activeTool.readOnly ? labelForTool(activeTool) : `Activate ${labelForTool(activeTool)}`;
  main.setAttribute("aria-label", main.title);
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

  let attentionKey=null;
  const attentionChanged=event=>{const state=event.detail || {};const key=JSON.stringify([state.filePath,state.editorMode,state.activeTool]);if(key!==attentionKey){attentionKey=key;refresh();}};
  const semanticEvents=["nv-active-tool-changed","nv-draw-tool-changed","nv-panel-tab-activated"];
  semanticEvents.forEach(type=>window.addEventListener(type,refresh));
  window.addEventListener("nv-editor-attention-changed",attentionChanged);
  window.addEventListener("nv-contextual-cursor-family-changed", refresh);
  window.addEventListener("activePanelChanged", refresh);
  document.addEventListener("click", closeOnDocumentClick);
  hostElement.__nvCleanupCursorFamilyWidget = () => {
    hostElement.__nvCursorFamilyRenderToken++;
    semanticEvents.forEach(type=>window.removeEventListener(type,refresh));
    window.removeEventListener("nv-editor-attention-changed",attentionChanged);
    window.removeEventListener("nv-contextual-cursor-family-changed", refresh);
    window.removeEventListener("activePanelChanged", refresh);
    document.removeEventListener("click", closeOnDocumentClick);
  };
  renderWidget(hostElement);
}
