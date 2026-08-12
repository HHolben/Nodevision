// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/FileViewers/XML/XmlViewerLayout.mjs
// This file builds the XML viewer's Rendered, Structure, and Source mode shell. It keeps mode switching local to the XML panel while allowing semantic handlers and generic renderers to provide their own safe DOM panes.

const MODES = ["rendered", "structure", "source"];
const LABELS = { rendered: "Rendered", structure: "Structure", source: "Source" };

export function createXmlViewerLayout({ panes, activeMode = "source", warning = "" }) {
  const wrapper = document.createElement("div");
  wrapper.style.cssText = "display:flex;flex-direction:column;height:100%;background:#fff;color:#111827;";
  const toolbar = document.createElement("div");
  toolbar.style.cssText = "display:flex;gap:6px;align-items:center;padding:8px;border-bottom:1px solid #d1d5db;background:#f9fafb;";
  const body = document.createElement("div");
  body.style.cssText = "flex:1;min-height:0;overflow:auto;";
  const state = { activeMode: MODES.includes(activeMode) ? activeMode : "source" };

  for (const mode of MODES) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = LABELS[mode];
    button.style.cssText = "padding:5px 10px;border:1px solid #9ca3af;background:#fff;color:#111827;cursor:pointer;border-radius:4px;";
    button.addEventListener("click", () => setActive(mode, toolbar, body, panes, state));
    button.dataset.mode = mode;
    toolbar.appendChild(button);
  }

  if (warning) toolbar.appendChild(createWarning(warning));
  wrapper.appendChild(toolbar);
  wrapper.appendChild(body);
  setActive(state.activeMode, toolbar, body, panes, state);
  return wrapper;
}

function setActive(mode, toolbar, body, panes, state) {
  state.activeMode = mode;
  for (const button of toolbar.querySelectorAll("button[data-mode]")) {
    const selected = button.dataset.mode === mode;
    button.style.background = selected ? "#111827" : "#fff";
    button.style.color = selected ? "#fff" : "#111827";
  }
  body.textContent = "";
  body.appendChild(panes[mode] || createMissingPane(mode));
}

function createWarning(text) {
  const span = document.createElement("span");
  span.style.cssText = "margin-left:auto;color:#92400e;font:12px/1.4 ui-monospace,SFMono-Regular,Consolas,monospace;";
  span.textContent = text;
  return span;
}

function createMissingPane(mode) {
  const pane = document.createElement("div");
  pane.style.cssText = "padding:1rem;color:#6b7280;";
  pane.textContent = `${LABELS[mode] || mode} view is unavailable.`;
  return pane;
}
