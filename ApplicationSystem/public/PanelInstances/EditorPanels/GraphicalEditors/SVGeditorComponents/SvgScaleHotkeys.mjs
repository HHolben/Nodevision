// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/SVGeditorComponents/SvgScaleHotkeys.mjs
// This module installs modal SVG scale hotkeys around the public SVG editor context while preserving selection previews and snapshot-based commits.

import { applyScaleToItems, formatScaleNumber, localAxisVector, makeScaleItem, pointerScaleFactor, restoreScaleItem, rootPointFromClient } from "./SvgScaleGeometry.mjs";

const MODE_LABELS = Object.freeze({
  uniform: "Scale evenly",
  x: "Scale X axis",
  y: "Scale Y axis",
  "local-x": "Scale original X axis",
  "local-y": "Scale original Y axis",
});

function selectedElements(ctx) {
  const items = ctx?.getSelectedElements?.() || [ctx?.getSelectedElement?.()].filter(Boolean);
  return Array.from(new Set(items.filter(Boolean)));
}

function parseScaleBuffer(buffer) {
  if (!buffer || buffer === "." || buffer === "-" || buffer === "-.") return null;
  const next = Number(buffer);
  return Number.isFinite(next) ? next : null;
}

function inputTarget(target) {
  return Boolean(target?.closest?.("input,textarea,select,[contenteditable='true']"));
}

function showStatus(host, text) {
  let status = host.querySelector?.("[data-nv-svg-scale-status]");
  if (!text && !status) return;
  if (!status) {
    status = document.createElement("div");
    status.dataset.nvSvgScaleStatus = "true";
    Object.assign(status.style, { position: "absolute", left: "12px", bottom: "12px", zIndex: "12", padding: "5px 8px", background: "rgba(20,20,20,0.78)", color: "white", font: "12px system-ui, sans-serif", borderRadius: "4px", pointerEvents: "none" });
    host.appendChild(status);
  }
  status.textContent = text;
  status.style.display = text ? "block" : "none";
}

function statusText(session) {
  const factor = formatScaleNumber(session.factor || 1);
  return MODE_LABELS[session.mode] + ": " + factor + "x; X/Y axes, RX/RY original axes, Enter commits, Esc cancels";
}

function restoreSession(session) {
  session?.items?.forEach(restoreScaleItem);
  session?.ctx?.notifyElementChanged?.("scale-preview");
}

function makeSession(ctx, svgRoot, elements, bounds, lastRoot) {
  const centerRoot = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
  const fallbackRadius = Math.max(bounds.width, bounds.height, 1) / 2;
  const startRoot = lastRoot || { x: centerRoot.x + fallbackRadius, y: centerRoot.y };
  const first = elements[0];
  return {
    ctx,
    svgRoot,
    mode: "uniform",
    localPrefix: false,
    buffer: "",
    factor: 1,
    centerRoot,
    startRoot,
    axisX: localAxisVector(svgRoot, first, "x"),
    axisY: localAxisVector(svgRoot, first, "y"),
    items: elements.map((el) => makeScaleItem(svgRoot, el)),
  };
}

export function installSvgScaleHotkeys(host = document) {
  let active = null;
  let lastRoot = null;
  const context = () => window.SVGEditorContext || null;
  const refreshStatus = () => active ? showStatus(host, statusText(active)) : showStatus(host, "");

  const preview = (session, factor) => {
    applyScaleToItems(session, factor);
    session.ctx?.notifyElementChanged?.("scale-preview");
  };

  const start = () => {
    const ctx = context();
    const svgRoot = ctx?.svgRoot;
    const bounds = ctx?.getSelectedBounds?.();
    const elements = selectedElements(ctx);
    if (!svgRoot || !bounds || !elements.length) return false;
    active = makeSession(ctx, svgRoot, elements, bounds, lastRoot);
    refreshStatus();
    return true;
  };

  const cancel = () => {
    restoreSession(active);
    active = null;
    refreshStatus();
    return true;
  };

  const commit = () => {
    const session = active;
    if (!session) return false;
    const factor = session.factor;
    restoreSession(session);
    active = null;
    refreshStatus();
    return session.ctx?.recordSvgSnapshot?.("scale-selection", () => {
      preview(session, factor);
      return true;
    }) || false;
  };

  const updateMode = (mode) => {
    if (!active) return false;
    active.mode = mode;
    active.localPrefix = false;
    preview(active, active.factor || 1);
    refreshStatus();
    return true;
  };

  const handleBackspace = () => {
    if (active.buffer) active.buffer = active.buffer.slice(0, -1);
    else active.localPrefix = false;
    const typed = parseScaleBuffer(active.buffer);
    if (typed === null) restoreSession(active);
    else preview(active, typed);
    refreshStatus();
    return true;
  };

  const handleKeydown = (event) => {
    const key = String(event.key || "");
    const lower = key.toLowerCase();
    if (event.ctrlKey || event.metaKey || event.altKey || inputTarget(event.target)) return false;
    if (!active) return key.length === 1 && lower === "s" && start();
    if (key === "Enter") return commit();
    if (key === "Escape") return cancel();
    if (key === "Backspace") return handleBackspace();
    if (!active.buffer && lower === "r") {
      active.localPrefix = true;
      refreshStatus();
      return true;
    }
    if (!active.buffer && (lower === "x" || lower === "y")) return updateMode(active.localPrefix ? "local-" + lower : lower);
    if (key.length !== 1 || !"0123456789.-".includes(key)) return false;
    if ((key === "." && active.buffer.includes(".")) || (key === "-" && active.buffer)) return false;
    active.buffer += key;
    const typed = parseScaleBuffer(active.buffer);
    if (typed !== null) preview(active, typed);
    refreshStatus();
    return true;
  };

  const handlePointermove = (event) => {
    const root = context()?.svgRoot;
    const point = rootPointFromClient(root, event.clientX, event.clientY);
    if (point) lastRoot = point;
    if (!active || active.buffer) return false;
    preview(active, pointerScaleFactor(active, point));
    refreshStatus();
    return true;
  };

  const handlePointerdown = () => active ? commit() : false;
  const trap = (handler) => (event) => {
    if (!handler(event)) return;
    event.preventDefault();
    event.stopPropagation();
  };
  const onKeydown = trap(handleKeydown);
  const onPointermove = trap(handlePointermove);
  const onPointerdown = trap(handlePointerdown);

  host.addEventListener("keydown", onKeydown, true);
  host.addEventListener("pointermove", onPointermove, true);
  host.addEventListener("pointerdown", onPointerdown, true);
  return () => {
    if (active) cancel();
    host.querySelector?.("[data-nv-svg-scale-status]")?.remove?.();
    host.removeEventListener("keydown", onKeydown, true);
    host.removeEventListener("pointermove", onPointermove, true);
    host.removeEventListener("pointerdown", onPointerdown, true);
  };
}
