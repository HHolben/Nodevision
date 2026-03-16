// Nodevision/ApplicationSystem/public/PanelInstances/InfoPanels/SVGLayersPanel.mjs
// This module renders the SVG layers panel for the active SVG editor session. This module attaches to the SVG editor layer manager so layer visibility and ordering stay synchronized. This module dispatches Nodevision panel actions so related SVG panels can be opened from the same workflow.

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
  Object.assign(header.style, {
    display: "flex",
    alignItems: "center",
    gap: "8px",
  });
  Object.assign(header.style, {
    fontWeight: "700",
    borderBottom: "1px solid #d0d0d0",
    paddingBottom: "4px",
  });
  const title = document.createElement("div");
  title.textContent = "SVG Layers";
  title.style.flex = "1";
  header.appendChild(title);

  const propsBtn = document.createElement("button");
  propsBtn.type = "button";
  propsBtn.textContent = "Properties";
  propsBtn.title = "Open SVG properties panel";
  propsBtn.addEventListener("click", () => {
    window.dispatchEvent(new CustomEvent("toolbarAction", {
      detail: {
        id: "SVGPropertiesPanel",
        type: "InfoPanel",
        replaceActive: true,
      }
    }));
  });
  header.appendChild(propsBtn);
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
