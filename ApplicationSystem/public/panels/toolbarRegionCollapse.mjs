// Nodevision/ApplicationSystem/public/panels/toolbarRegionCollapse.mjs
// This module installs one shared visual collapse control for the main and contextual toolbar region while preserving toolbar DOM, state, and cached contextual content.

const COLLAPSED_CLASS = "nv-toolbar-region--collapsed";
const STRIP_ID = "toolbar-collapse-strip";
const BUTTON_CLASS = "nv-toolbar-collapse-button";

function toolbarShell() {
  return document.getElementById("app-shell") || document.body;
}

function isToolbarRegionCollapsed() {
  return toolbarShell()?.classList?.contains?.(COLLAPSED_CLASS) || false;
}

function notifyToolbarLayoutChanged() {
  window.updateGlobalToolbarHeightVar?.();
  window.dispatchEvent(new CustomEvent("nv-toolbar-region-collapse-changed", { detail: { collapsed: isToolbarRegionCollapsed() } }));
}

function updateToolbarCollapseButton(button) {
  const collapsed = isToolbarRegionCollapsed();
  button.textContent = collapsed ? "▼" : "▲";
  button.title = collapsed ? "Restore toolbar" : "Collapse toolbar";
  button.setAttribute("aria-label", collapsed ? "Restore toolbar" : "Collapse toolbar");
  button.setAttribute("aria-expanded", String(!collapsed));
}

function setToolbarRegionCollapsed(collapsed, button) {
  toolbarShell()?.classList?.toggle(COLLAPSED_CLASS, Boolean(collapsed));
  if (button) updateToolbarCollapseButton(button);
  notifyToolbarLayoutChanged();
}

function handleKeyActivation(event, button) {
  if (event.key !== "Enter" && event.key !== " ") return;
  event.preventDefault();
  setToolbarRegionCollapsed(!isToolbarRegionCollapsed(), button);
}

function bindToolbarCollapseButton(button) {
  if (!button || button.dataset.nvToolbarCollapseBound === "1") return button;
  button.dataset.nvToolbarCollapseBound = "1";
  button.addEventListener("click", () => setToolbarRegionCollapsed(!isToolbarRegionCollapsed(), button));
  button.addEventListener("keydown", (event) => handleKeyActivation(event, button));
  return button;
}

function createToolbarCollapseButton() {
  const button = document.createElement("button");
  button.type = "button";
  button.className = BUTTON_CLASS;
  bindToolbarCollapseButton(button);
  updateToolbarCollapseButton(button);
  return button;
}

function createToolbarCollapseStrip() {
  const strip = document.createElement("div");
  strip.id = STRIP_ID;
  strip.setAttribute("role", "presentation");
  strip.appendChild(createToolbarCollapseButton());
  return strip;
}

export function ensureToolbarRegionCollapseControl() {
  if (typeof document === "undefined") return null;
  let strip = document.getElementById(STRIP_ID);
  if (!strip) {
    strip = createToolbarCollapseStrip();
    const workspace = document.getElementById("workspace");
    workspace?.parentElement?.insertBefore(strip, workspace);
  }
  const button = bindToolbarCollapseButton(strip.querySelector?.("." + BUTTON_CLASS) || strip.appendChild(createToolbarCollapseButton()));
  updateToolbarCollapseButton(button);
  notifyToolbarLayoutChanged();
  return strip;
}
