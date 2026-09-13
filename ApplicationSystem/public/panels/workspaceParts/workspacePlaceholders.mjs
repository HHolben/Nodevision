// Nodevision/ApplicationSystem/public/panels/workspaceParts/workspacePlaceholders.mjs
// This module displays temporary colored placeholders while Nodevision workspace panels are being resized.

import { collectPanelCells } from "./workspacePrimitives.mjs";

function placeholderColorForCell(cell, index) {
  const key = `${cell.dataset?.id || "panel"}:${index}`;
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) {
    hash = ((hash << 5) - hash) + key.charCodeAt(i);
    hash |= 0;
  }
  return `hsl(${Math.abs(hash) % 360} 45% 55% / 0.78)`;
}

export function startResizePlaceholderMode(elements) {
  const uniqueCells = new Set();
  for (const element of elements) for (const cell of collectPanelCells(element)) uniqueCells.add(cell);
  const states = [];
  let idx = 0;
  for (const cell of uniqueCells) {
    const visibilityEntries = [];
    for (const child of Array.from(cell.children)) {
      visibilityEntries.push([child, child.style.visibility]);
      child.style.visibility = "hidden";
    }
    const placeholder = document.createElement("div");
    placeholder.className = "panel-resize-placeholder";
    Object.assign(placeholder.style, {
      position: "absolute", inset: "0", background: placeholderColorForCell(cell, idx),
      border: "1px solid rgba(20, 20, 20, 0.18)", display: "flex", alignItems: "center",
      justifyContent: "center", color: "rgba(255, 255, 255, 0.95)", fontSize: "12px",
      fontFamily: "monospace", letterSpacing: "0.02em", pointerEvents: "none", userSelect: "none",
      zIndex: "999", opacity: "0", transition: "opacity 140ms ease"
    });
    placeholder.textContent = cell.dataset?.id || "Panel";
    const prevPosition = cell.style.position;
    if (!prevPosition) cell.style.position = "relative";
    cell.appendChild(placeholder);
    requestAnimationFrame(() => { placeholder.style.opacity = "1"; });
    states.push({ cell, visibilityEntries, placeholder, prevPosition });
    idx += 1;
  }
  return () => {
    for (const state of states) {
      const { cell, visibilityEntries, placeholder, prevPosition } = state;
      placeholder.style.opacity = "0";
      for (const [child, vis] of visibilityEntries) child.style.visibility = vis;
      setTimeout(() => { if (placeholder.parentNode === cell) cell.removeChild(placeholder); }, 140);
      cell.style.position = prevPosition;
    }
  };
}
