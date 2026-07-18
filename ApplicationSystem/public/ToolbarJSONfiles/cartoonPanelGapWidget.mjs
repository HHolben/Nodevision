// Nodevision/ApplicationSystem/public/ToolbarJSONfiles/cartoonPanelGapWidget.mjs
// Compact subtoolbar control for comic-panel gutter width.

import { getDefaultCartoonGap, setDefaultCartoonGap } from "/ToolbarCallbacks/insert/cartoonTools.mjs";

function activeGap() {
  const panel = window.__nvHtmlCartoonActivePanel;
  const raw = panel?.dataset?.panelGap;
  const parsed = Number.parseFloat(String(raw ?? ""));
  return Number.isFinite(parsed) ? parsed : getDefaultCartoonGap();
}

export function initToolbarWidget(hostElement) {
  if (!hostElement) return;
  hostElement.innerHTML = "";
  hostElement.style.cssText = "display:flex;align-items:center;gap:6px;min-width:210px;";

  const label = document.createElement("label");
  label.textContent = "Gap";
  label.style.cssText = "display:flex;align-items:center;gap:6px;font:12px system-ui,sans-serif;color:#1f2933;";

  const range = document.createElement("input");
  range.type = "range";
  range.min = "0";
  range.max = "48";
  range.step = "1";
  range.title = "Default width between cartoon panels";
  range.style.width = "110px";

  const number = document.createElement("input");
  number.type = "number";
  number.min = "0";
  number.max = "96";
  number.step = "1";
  number.title = "Panel gap in pixels";
  number.style.cssText = "width:54px;font:12px monospace;";

  const syncInputs = (value = activeGap()) => {
    const gap = Math.max(0, Math.min(96, Number.parseFloat(String(value)) || 0));
    range.value = String(Math.min(48, gap));
    number.value = String(Math.round(gap));
  };

  const apply = (value) => {
    const gap = setDefaultCartoonGap(value);
    syncInputs(gap);
  };

  range.addEventListener("input", () => apply(range.value));
  number.addEventListener("change", () => apply(number.value));

  const onSelectionChanged = () => syncInputs();
  const onGapChanged = (event) => syncInputs(event.detail?.gap);
  window.addEventListener("nv-cartoon-selection-changed", onSelectionChanged);
  window.addEventListener("nv-cartoon-gap-changed", onGapChanged);
  const cleanupObserver = new MutationObserver(() => {
    if (hostElement.isConnected) return;
    window.removeEventListener("nv-cartoon-selection-changed", onSelectionChanged);
    window.removeEventListener("nv-cartoon-gap-changed", onGapChanged);
    cleanupObserver.disconnect();
  });
  cleanupObserver.observe(document.body, { childList: true, subtree: true });

  syncInputs();
  label.append(range, number);
  hostElement.appendChild(label);
}
