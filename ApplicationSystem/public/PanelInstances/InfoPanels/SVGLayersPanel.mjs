// Nodevision/public/PanelInstances/InfoPanels/SVGLayersPanel.mjs
// Dedicated layers panel that reuses the SVG editor's layer manager.

export async function setupPanel(panel, instanceVars = {}) {
  if (!panel) throw new Error("Panel container required.");
  panel.innerHTML = "";
  Object.assign(panel.style, {
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    gap: "6px",
  });

  const ctx = window.SVGEditorContext;
  if (!ctx || !ctx.layers) {
    const message = document.createElement("div");
    message.textContent = "Open an SVG file in the graphical editor to show layers.";
    message.style.padding = "12px";
    message.style.color = "#b00020";
    panel.appendChild(message);
    return;
  }

  const header = document.createElement("div");
  header.textContent = "SVG Layers";
  Object.assign(header.style, {
    fontWeight: "700",
    borderBottom: "1px solid #d0d0d0",
    paddingBottom: "4px",
  });
  panel.appendChild(header);

  const host = document.createElement("div");
  Object.assign(host.style, {
    flex: "1",
    minHeight: "0",
    overflow: "auto",
  });
  panel.appendChild(host);

  if (typeof ctx.layers.attachHost !== "function") {
    const fallback = document.createElement("div");
    fallback.textContent = "Layer manager cannot attach to this panel.";
    fallback.style.padding = "12px";
    fallback.style.color = "#b00020";
    host.appendChild(fallback);
    return;
  }

  ctx.layers.attachHost(host);
}
