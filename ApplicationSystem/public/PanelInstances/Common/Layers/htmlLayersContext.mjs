// Nodevision/ApplicationSystem/public/PanelInstances/Common/Layers/htmlLayersContext.mjs
// Generic layer context for HTML documents. Provides an attachHost(host) API
// so the shared Layers panel can render checkboxes to toggle element visibility.

const DEFAULT_TAGS = new Set([
  "SECTION", "ARTICLE", "ASIDE", "MAIN", "HEADER", "FOOTER", "NAV",
  "DIV", "FIGURE", "FIGCAPTION", "TABLE", "THEAD", "TBODY", "TFOOT", "TR",
  "UL", "OL", "LI", "CANVAS", "SVG", "IMG", "VIDEO", "AUDIO", "IFRAME", "FORM"
]);

function elementLabel(el) {
  const parts = [el.tagName.toLowerCase()];
  if (el.id) parts.push(`#${el.id}`);
  const classList = Array.from(el.classList || []);
  if (classList.length) parts.push(classList.map((c) => `.${c}`).join(""));
  return parts.join(" ");
}

function isVisible(el, win) {
  if (!el || !win) return false;
  if (el.hidden) return false;
  const style = win.getComputedStyle(el);
  return style.display !== "none" && style.visibility !== "hidden" && style.opacity !== "0";
}

function setVisible(el, visible) {
  if (!el) return;
  if (visible) {
    const prev = el.dataset.nvLayerPrevDisplay || "";
    el.style.display = prev;
    delete el.dataset.nvLayerPrevDisplay;
    el.hidden = false;
    el.style.visibility = "";
    return;
  }
  if (!el.dataset.nvLayerPrevDisplay) {
    el.dataset.nvLayerPrevDisplay = el.style.display || "";
  }
  el.style.display = "none";
  el.hidden = true;
}

function collectLayers(root) {
  if (!root) return [];
  const layers = [];
  const walker = root.ownerDocument.createTreeWalker(
    root,
    NodeFilter.SHOW_ELEMENT,
    {
      acceptNode: (node) => {
        if (!(node instanceof Element)) return NodeFilter.FILTER_REJECT;
        if (node.closest?.("[data-nv-layer-ignore]")) return NodeFilter.FILTER_REJECT;
        if (node === root) return NodeFilter.FILTER_SKIP;
        if (node.id || DEFAULT_TAGS.has(node.tagName)) return NodeFilter.FILTER_ACCEPT;
        return NodeFilter.FILTER_SKIP;
      },
    }
  );

  let current = walker.nextNode();
  while (current) {
    layers.push(current);
    current = walker.nextNode();
  }
  return layers;
}

export function createHtmlLayersContext(root, { title = "HTML Layers" } = {}) {
  const win = root?.ownerDocument?.defaultView || window;

  return {
    title,
    attachHost(host) {
      if (!host) return null;

      host.innerHTML = "";
      const list = document.createElement("div");
      list.style.display = "flex";
      list.style.flexDirection = "column";
      list.style.gap = "6px";
      host.appendChild(list);

      const render = () => {
        list.innerHTML = "";
        if (!root || !root.ownerDocument?.isConnected) {
          const msg = document.createElement("div");
          msg.textContent = "HTML document is not available.";
          msg.style.color = "#b00020";
          msg.style.padding = "6px 0";
          list.appendChild(msg);
          return;
        }

        const layers = collectLayers(root);
        if (!layers.length) {
          const msg = document.createElement("div");
          msg.textContent = "No layers found in this document.";
          msg.style.color = "#444";
          msg.style.padding = "6px 0";
          list.appendChild(msg);
          return;
        }

        layers.forEach((el, idx) => {
          const row = document.createElement("label");
          row.style.display = "flex";
          row.style.alignItems = "center";
          row.style.gap = "8px";
          row.style.fontSize = "12px";
          row.style.cursor = "pointer";

          const checkbox = document.createElement("input");
          checkbox.type = "checkbox";
          checkbox.checked = isVisible(el, win);
          checkbox.addEventListener("change", () => {
            setVisible(el, checkbox.checked);
          });

          const name = document.createElement("div");
          name.textContent = elementLabel(el) || `element ${idx + 1}`;
          name.style.flex = "1";
          name.style.userSelect = "none";

          row.appendChild(checkbox);
          row.appendChild(name);
          list.appendChild(row);
        });
      };

      render();

      let observer = null;
      try {
        observer = new MutationObserver(() => render());
        observer.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "id", "hidden", "style"] });
      } catch (_) {
        // ignore observer errors
      }

      return () => observer?.disconnect?.();
    },
  };
}
