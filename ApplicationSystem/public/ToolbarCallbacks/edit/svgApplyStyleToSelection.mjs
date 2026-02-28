// Apply the current SVG style defaults to the selected element.

export default function svgApplyStyleToSelection() {
  const ctx = window.SVGEditorContext;
  if (!ctx?.applyCurrentStyleToSelection) {
    console.warn("svgApplyStyleToSelection: SVG editor context is not available.");
    return;
  }

  const ok = ctx.applyCurrentStyleToSelection();
  if (!ok) {
    const msg = document.getElementById("svg-message");
    if (msg) msg.textContent = "No shape selected";
  }
}
