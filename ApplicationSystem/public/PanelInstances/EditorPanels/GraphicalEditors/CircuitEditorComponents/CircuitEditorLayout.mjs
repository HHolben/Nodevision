// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/CircuitEditorComponents/CircuitEditorLayout.mjs
// This file defines the schematic editor layout container for Nodevision. This file keeps a single viewport with floating overlays for tools, inspector, and status.

export function createCircuitLayout(container) {
  container.innerHTML = "";
  const root = document.createElement("div");
  root.style.cssText = [
    "position:relative",
    "display:flex",
    "flex-direction:column",
    "width:100%",
    "height:100%",
    "font-family:Inter, sans-serif",
    "background:#f8fafc",
    "color:#0f172a",
  ].join(";");

  const viewport = document.createElement("div");
  viewport.style.cssText = [
    "position:relative",
    "flex:1",
    "min-height:0",
    "min-width:0",
    "overflow:hidden",
    "background:#ffffff",
  ].join(";");
  root.appendChild(viewport);

  const canvasHost = document.createElement("div");
  canvasHost.style.cssText = [
    "position:absolute",
    "inset:0",
    "overflow:hidden",
  ].join(";");
  viewport.appendChild(canvasHost);

  const floatingToolbar = document.createElement("div");
  floatingToolbar.style.cssText = [
    "position:absolute",
    "top:10px",
    "left:10px",
    "display:flex",
    "gap:8px",
    "padding:6px 8px",
    "background:rgba(255,255,255,0.95)",
    "border:1px solid #e2e8f0",
    "border-radius:10px",
    "box-shadow:0 4px 12px rgba(15,23,42,0.08)",
    "backdrop-filter:blur(6px)",
    "z-index:4",
  ].join(";");
  viewport.appendChild(floatingToolbar);

  const floatingInspector = document.createElement("div");
  floatingInspector.style.cssText = [
    "position:absolute",
    "top:10px",
    "right:10px",
    "width:240px",
    "max-height:60%",
    "overflow:auto",
    "padding:10px",
    "background:rgba(248,250,252,0.96)",
    "border:1px solid #e2e8f0",
    "border-radius:10px",
    "box-shadow:0 4px 12px rgba(15,23,42,0.08)",
    "z-index:4",
  ].join(";");
  viewport.appendChild(floatingInspector);

  const floatingMessage = document.createElement("div");
  floatingMessage.style.cssText = [
    "position:absolute",
    "left:10px",
    "bottom:10px",
    "padding:6px 10px",
    "background:rgba(15,23,42,0.85)",
    "color:#e2e8f0",
    "font:12px/1.4 monospace",
    "border-radius:8px",
    "z-index:4",
    "pointer-events:none",
  ].join(";");
  floatingMessage.textContent = "Circuit editor ready.";
  viewport.appendChild(floatingMessage);

  const fallbackSubToolbar = document.createElement("div");
  fallbackSubToolbar.style.cssText = [
    "position:absolute",
    "top:52px",
    "left:10px",
    "display:none",
    "gap:6px",
    "padding:6px",
    "background:rgba(255,255,255,0.95)",
    "border:1px solid #e2e8f0",
    "border-radius:10px",
    "box-shadow:0 4px 12px rgba(15,23,42,0.08)",
    "z-index:3",
  ].join(";");
  viewport.appendChild(fallbackSubToolbar);

  container.appendChild(root);
  return { root, canvasHost, toolbar: floatingToolbar, inspector: floatingInspector, message: floatingMessage, subToolbarFallback: fallbackSubToolbar };
}
