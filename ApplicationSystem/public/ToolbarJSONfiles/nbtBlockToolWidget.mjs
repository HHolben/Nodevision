// Nodevision/ApplicationSystem/public/ToolbarJSONfiles/nbtBlockToolWidget.mjs
// Shared sub-toolbar widget for NBT graphical editing placement settings.

import { setStatus } from "/StatusBar.mjs";

const hostRegistry = window.__nvNBTToolbarHosts || new Set();
window.__nvNBTToolbarHosts = hostRegistry;

function getContext() {
  return window.NBTEditorContext || null;
}

function ensureStyles() {
  if (document.getElementById("nv-nbt-toolbar-widget-styles")) return;
  const style = document.createElement("style");
  style.id = "nv-nbt-toolbar-widget-styles";
  style.textContent = `
    .nv-nbt-toolbar-widget { display:flex; align-items:center; gap:8px; flex-wrap:wrap; font:12px system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; color:#111827; }
    .nv-nbt-toolbar-widget label { display:flex; align-items:center; gap:6px; font-weight:650; }
    .nv-nbt-toolbar-widget input { height:24px; width:min(360px,32vw); min-width:220px; box-sizing:border-box; border:1px solid #aeb9c8; border-radius:4px; padding:2px 6px; font:inherit; }
    .nv-nbt-toolbar-widget span { color:#4b5563; }
  `;
  document.head.appendChild(style);
}

function render(hostElement) {
  if (!hostElement?.isConnected) return;
  const context = getContext();
  hostElement.innerHTML = "";
  hostElement.classList.add("nv-nbt-toolbar-widget");

  if (!context) {
    const message = document.createElement("span");
    message.textContent = "Open an NBT editor.";
    hostElement.appendChild(message);
    return;
  }

  const state = context.getState?.() || {};
  const datalistId = "nv-nbt-toolbar-blocks";
  const label = document.createElement("label");
  label.textContent = "Place";

  const input = document.createElement("input");
  input.type = "text";
  input.setAttribute("list", datalistId);
  input.value = state.placementBlock || context.getPlacementBlock?.() || "minecraft:stone";
  label.appendChild(input);
  hostElement.appendChild(label);

  const datalist = document.createElement("datalist");
  datalist.id = datalistId;
  (context.commonBlocks || []).forEach((value) => {
    const option = document.createElement("option");
    option.value = value;
    datalist.appendChild(option);
  });
  hostElement.appendChild(datalist);

  const mode = document.createElement("span");
  mode.textContent = `Tool: ${state.mode || "select"}`;
  hostElement.appendChild(mode);

  const apply = () => {
    context.setPlacementBlock?.(input.value);
    setStatus("NBT", "Placement block updated");
  };
  input.addEventListener("change", apply);
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") apply();
  });
}

function refreshHosts() {
  for (const host of Array.from(hostRegistry)) {
    if (!host?.isConnected) {
      hostRegistry.delete(host);
      continue;
    }
    render(host);
  }
}

function ensureGlobalListeners() {
  if (window.__nvNBTToolbarListenersBound) return;
  window.addEventListener("nv-nbt-context-ready", refreshHosts);
  window.addEventListener("nv-nbt-context-changed", refreshHosts);
  window.addEventListener("nv-nbt-context-cleared", refreshHosts);
  window.__nvNBTToolbarListenersBound = true;
}

export function initToolbarWidget(hostElement) {
  if (!hostElement) return;
  ensureStyles();
  ensureGlobalListeners();
  hostRegistry.add(hostElement);
  render(hostElement);
}
