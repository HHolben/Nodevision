// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/SVGeditorComponents/SvgChrome.mjs
// This module keeps SVG editor controls outside the authored document. It maps document coordinates into a viewport overlay without copying user styles or geometry.

export function createSvgChrome(svgRoot, host, layer) {
  const overlay = svgRoot.ownerDocument.createElementNS(svgRoot.namespaceURI, "svg");
  overlay.setAttribute("data-nv-editor-ui", "viewport-overlay");
  Object.assign(overlay.style, { position: "absolute", inset: "0", width: "100%", height: "100%", pointerEvents: "none", overflow: "hidden" });
  overlay.appendChild(layer);
  host.appendChild(overlay);
  let disposed = false;
  function sync() {
    if (disposed || !svgRoot.isConnected) return;
    const documentMatrix = svgRoot.getScreenCTM();
    const overlayMatrix = overlay.getScreenCTM();
    if (!documentMatrix || !overlayMatrix) { overlay.style.visibility = "hidden"; return; }
    try {
      const m = overlayMatrix.inverse().multiply(documentMatrix);
      overlay.style.visibility = "visible";
      layer.setAttribute("transform", `matrix(${m.a} ${m.b} ${m.c} ${m.d} ${m.e} ${m.f})`);
    } catch { overlay.style.visibility = "hidden"; }
  }
  // Root viewBox/style changes also occur through Properties and snapshot restores.
  const observer = new MutationObserver(sync);
  observer.observe(svgRoot, { attributes: true });
  sync();
  return { sync, dispose() { disposed = true; observer.disconnect(); overlay.remove(); } };
}
