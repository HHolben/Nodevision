// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/SVGeditorComponents/EyedropperTool.mjs
// SVG paint sampling helpers for the explicit and press-and-hold eyedropper.

function cleanPaint(value, fallback = "") {
  const raw = String(value || "").trim();
  if (!raw || raw === "none" || raw === "transparent") return raw || fallback;
  if (/^url\(#[-_a-zA-Z0-9:.]+\)$/.test(raw)) return raw;
  if (/^#[0-9a-fA-F]{3,8}$/.test(raw)) return raw;
  if (/^(rgb|rgba|hsl|hsla)\(/i.test(raw)) return raw;
  if (/^[a-zA-Z]+$/.test(raw)) return raw;
  return fallback;
}

function numericOpacity(value, fallback = 1) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(1, n));
}

export function sampleSvgPaint(target, options = {}) {
  const el = target instanceof SVGElement ? target : null;
  if (!el) return null;
  const computed = typeof getComputedStyle === "function" ? getComputedStyle(el) : null;
  const fill = cleanPaint(el.getAttribute("fill") || computed?.fill || "", "none");
  const stroke = cleanPaint(el.getAttribute("stroke") || computed?.stroke || "", "none");
  const opacity = numericOpacity(
    el.getAttribute("opacity") ??
      computed?.opacity ??
      el.getAttribute("fill-opacity") ??
      el.getAttribute("stroke-opacity"),
    1,
  );
  const tag = String(el.tagName || "").toLowerCase();
  const gradientStop = tag === "stop"
    ? {
      color: cleanPaint(el.getAttribute("stop-color") || computed?.stopColor || "", ""),
      opacity: numericOpacity(el.getAttribute("stop-opacity") || computed?.stopOpacity, 1),
    }
    : null;
  return {
    target: el,
    tag,
    fill,
    stroke,
    opacity,
    gradientStop,
    renderedColor: options.visibleColor || fill || stroke || "",
  };
}

export function applyEyedropperSample(ctx, sample, targetMode = "recent") {
  if (!ctx || !sample) return false;
  const mode = String(targetMode || "recent").toLowerCase();
  const recent = String(globalThis?.NodevisionState?.svgLastEditedPaint || "").toLowerCase();
  const resolved = mode === "recent" ? (recent === "stroke" ? "stroke" : "fill") : mode;
  const color = sample.gradientStop?.color || (resolved === "stroke" ? sample.stroke : sample.fill) || sample.renderedColor;
  if (!color || color === "none") return false;
  if (resolved === "stroke") {
    ctx.setStrokeColor?.(color);
    globalThis.NodevisionState = globalThis.NodevisionState || {};
    globalThis.NodevisionState.svgLastEditedPaint = "stroke";
  } else {
    ctx.setFillColor?.(color);
    globalThis.NodevisionState = globalThis.NodevisionState || {};
    globalThis.NodevisionState.svgLastEditedPaint = "fill";
  }
  return true;
}

export function createEyedropperIndicator() {
  const node = document.createElement("div");
  node.dataset.nvSvgEyedropperIndicator = "true";
  Object.assign(node.style, {
    position: "fixed",
    zIndex: "25001",
    display: "none",
    pointerEvents: "none",
    minWidth: "72px",
    minHeight: "34px",
    padding: "5px 8px",
    border: "1px solid rgba(17,24,39,0.35)",
    borderRadius: "8px",
    background: "rgba(255,255,255,0.96)",
    boxShadow: "0 8px 22px rgba(0,0,0,0.18)",
    font: "12px system-ui, -apple-system, Segoe UI, sans-serif",
    color: "#111827",
  });
  document.body.appendChild(node);
  return {
    show(clientX, clientY, sample) {
      const color = sample?.gradientStop?.color || sample?.fill || sample?.stroke || sample?.renderedColor || "#000000";
      node.innerHTML = "";
      const swatch = document.createElement("span");
      Object.assign(swatch.style, {
        display: "inline-block",
        width: "18px",
        height: "18px",
        marginRight: "6px",
        verticalAlign: "middle",
        border: "1px solid #333",
        background: color && color !== "none" ? color : "transparent",
      });
      const text = document.createElement("span");
      text.textContent = color || "No paint";
      node.append(swatch, text);
      node.style.left = `${Math.min(window.innerWidth - 110, clientX + 14)}px`;
      node.style.top = `${Math.min(window.innerHeight - 48, clientY + 14)}px`;
      node.style.display = "block";
    },
    hide() {
      node.style.display = "none";
    },
    destroy() {
      node.remove();
    },
  };
}

