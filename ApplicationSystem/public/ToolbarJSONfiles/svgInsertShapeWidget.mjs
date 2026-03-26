// Nodevision/ApplicationSystem/public/ToolbarJSONfiles/svgInsertShapeWidget.mjs
// Renders the SVG Editing sub-toolbar widget for inserting shapes.

const SVG_MODE = "SVG Editing";

function ensureSvgContext() {
  const ctx = window.SVGEditorContext;
  if (!ctx?.svgRoot) {
    console.error("SVGEditorContext not found. Are you in SVG Editing mode?");
    return null;
  }
  return ctx;
}

function makeButton(label, onClick) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.textContent = label;
  Object.assign(btn.style, {
    height: "28px",
    padding: "0 10px",
    border: "1px solid #333",
    borderRadius: "4px",
    background: "#eee",
    cursor: "pointer",
    fontSize: "12px",
    lineHeight: "28px",
    whiteSpace: "nowrap",
  });
  btn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    onClick?.();
  });
  return btn;
}

export function initToolbarWidget(hostElement) {
  if (!hostElement) return;
  if ((window.NodevisionState?.currentMode || "") !== SVG_MODE) return;

  const mount =
    hostElement.querySelector("#nv-svg-insert-shape-widget") || hostElement;
  mount.innerHTML = "";

  const ctx = ensureSvgContext();
  if (!ctx) return;

  const shapes = [
    { label: "Rectangle", kind: "rect" },
    { label: "Triangle", kind: "triangle" },
    { label: "Polygon", kind: "polygon" },
    { label: "Star", kind: "star" },
    { label: "Ellipse", kind: "ellipse" },
  ];

  shapes.forEach(({ label, kind }) => {
    mount.appendChild(
      makeButton(label, () => {
        if (typeof ctx.insertShape === "function") {
          ctx.insertShape(kind);
          return;
        }

        // Legacy fallback: direct DOM insertion (best effort).
        const svg = document.getElementById("svg-editor");
        if (!svg) return;
        if (kind === "rect") {
          const el = document.createElementNS("http://www.w3.org/2000/svg", "rect");
          el.setAttribute("x", "20");
          el.setAttribute("y", "20");
          el.setAttribute("width", "120");
          el.setAttribute("height", "80");
          el.setAttribute("fill", "rgba(0, 128, 255, 0.3)");
          el.setAttribute("stroke", "#000");
          el.setAttribute("stroke-width", "2");
          svg.appendChild(el);
          window.selectSVGElement?.(el);
        } else if (kind === "ellipse") {
          const el = document.createElementNS("http://www.w3.org/2000/svg", "ellipse");
          el.setAttribute("cx", "90");
          el.setAttribute("cy", "70");
          el.setAttribute("rx", "70");
          el.setAttribute("ry", "35");
          el.setAttribute("fill", "rgba(0, 255, 128, 0.3)");
          el.setAttribute("stroke", "#000");
          el.setAttribute("stroke-width", "2");
          svg.appendChild(el);
          window.selectSVGElement?.(el);
        }
      })
    );
  });
}

