// Nodevision/ApplicationSystem/public/PanelInstances/InfoPanels/SVGLayersPanel.mjs
// This module renders a reusable Layers panel. It was originally SVG-only,
// but now supports any editor/viewer that exposes an attachHost(host) API.

function collectProviders() {
  const providers = [];

  // HTML editing context (from HTMLeditorImpl)
  if (window.HTMLLayersContext?.attachHost) {
    providers.push({
      id: "html-edit",
      title: window.HTMLLayersContext.title || "HTML Layers",
      attachHost: window.HTMLLayersContext.attachHost,
      actions: [],
    });
  }

  // HTML viewing context (from ViewHTML)
  if (window.HTMLViewLayersContext?.attachHost) {
    providers.push({
      id: "html-view",
      title: window.HTMLViewLayersContext.title || "HTML Layers (View)",
      attachHost: window.HTMLViewLayersContext.attachHost,
      actions: [],
    });
  }

  // SVG editing context (original behavior)
  const svgCtx = window.SVGEditorContext;
  if (svgCtx?.layers?.attachHost) {
    providers.push({
      id: "svg",
      title: "SVG Layers",
      attachHost: svgCtx.layers.attachHost,
      actions: [
        {
          label: "Properties",
          handler() {
            window.dispatchEvent(new CustomEvent("toolbarAction", {
              detail: {
                id: "SVGPropertiesPanel",
                type: "InfoPanel",
                replaceActive: true,
              }
            }));
          }
        }
      ]
    });
  }

  return providers;
}

export async function setupPanel(panel, instanceVars = {}) {
  if (!panel) throw new Error("Panel container required.");
  panel.innerHTML = "";
  Object.assign(panel.style, {
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    gap: "6px",
  });

  const providers = collectProviders();
  if (!providers.length) {
    const message = document.createElement("div");
    message.textContent = "Open an SVG or HTML document to show layers.";
    message.style.padding = "12px";
    message.style.color = "#b00020";
    panel.appendChild(message);
    return;
  }

  let activeProvider = providers[0];
  let teardown = null;

  const header = document.createElement("div");
  Object.assign(header.style, {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    fontWeight: "700",
    borderBottom: "1px solid #d0d0d0",
    paddingBottom: "4px",
  });

  const title = document.createElement("div");
  title.style.flex = "1";
  header.appendChild(title);

  let providerSelect = null;
  if (providers.length > 1) {
    providerSelect = document.createElement("select");
    providerSelect.style.fontSize = "12px";
    providers.forEach((p, idx) => {
      const opt = document.createElement("option");
      opt.value = p.id;
      opt.textContent = p.title || `Layers ${idx + 1}`;
      providerSelect.appendChild(opt);
    });
    providerSelect.addEventListener("change", () => {
      const next = providers.find((p) => p.id === providerSelect.value);
      if (next) mountProvider(next);
    });
    header.appendChild(providerSelect);
  }

  const actionsContainer = document.createElement("div");
  actionsContainer.style.display = "flex";
  actionsContainer.style.gap = "6px";
  header.appendChild(actionsContainer);

  panel.appendChild(header);

  const host = document.createElement("div");
  Object.assign(host.style, {
    flex: "1",
    minHeight: "0",
    overflow: "auto",
  });
  panel.appendChild(host);

  function mountProvider(provider) {
    activeProvider = provider;
    title.textContent = provider.title || "Layers";
    if (providerSelect && providerSelect.value !== provider.id) {
      providerSelect.value = provider.id;
    }

    // Rebuild action buttons
    actionsContainer.innerHTML = "";
    (provider.actions || []).forEach((action) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = action.label;
      btn.addEventListener("click", () => action.handler?.());
      actionsContainer.appendChild(btn);
    });

    host.innerHTML = "";
    if (typeof teardown === "function") teardown();
    teardown = null;

    if (typeof provider.attachHost === "function") {
      const maybeCleanup = provider.attachHost(host);
      if (typeof maybeCleanup === "function") teardown = maybeCleanup;
    } else {
      const fallback = document.createElement("div");
      fallback.textContent = "Layer manager cannot attach to this panel.";
      fallback.style.padding = "12px";
      fallback.style.color = "#b00020";
      host.appendChild(fallback);
    }
  }

  mountProvider(activeProvider);

  panel.__nvCleanupLayersPanel = () => {
    if (typeof teardown === "function") teardown();
  };
}
