// Nodevision/public/ToolbarCallbacks/draw/DrawSVG.mjs
// SVG-specific drawing controls rendered in the shared sub-toolbar row.

function buttonStyle(active) {
  return `padding:2px 8px;border:1px solid #333;background:${active ? "#cfead2" : "#fff"};cursor:pointer;`;
}

export default function DrawSVG() {
  const subToolbar = document.getElementById("sub-toolbar");
  if (!subToolbar) return;

  const ctx = window.SVGEditorContext;
  if (!ctx || typeof ctx.setMode !== "function") {
    subToolbar.innerHTML = `
      <div style="padding:6px 8px;border:1px solid #933;background:#fff3f3;color:#700;">
        SVG draw tools are unavailable. Open an SVG editor first.
      </div>
    `;
    subToolbar.style.display = "flex";
    return;
  }

  window.NodevisionState = window.NodevisionState || {};
  const defaults = typeof ctx.getCurrentStyleDefaults === "function"
    ? ctx.getCurrentStyleDefaults()
    : {};
  const currentTool = window.NodevisionState.svgDrawTool || "select";
  const fill = window.NodevisionState.svgFillColor || defaults.fill || "#80c0ff";
  const stroke = window.NodevisionState.svgStrokeColor || defaults.stroke || "#000000";
  const strokeWidth = Number.parseFloat(window.NodevisionState.svgStrokeWidth || defaults.strokeWidth || "2");
  const safeStrokeWidth = Number.isFinite(strokeWidth) ? Math.max(0, Math.min(64, strokeWidth)) : 2;

  subToolbar.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;padding:4px 6px;background:#f5f5f5;border:1px solid #333;border-radius:4px;flex-wrap:wrap;">
      <strong style="font-size:12px;">SVG Draw</strong>
      <div style="display:flex;align-items:center;gap:4px;">
        <button id="svg-draw-select" type="button" style="${buttonStyle(currentTool === "select")}">Select</button>
        <button id="svg-draw-line" type="button" style="${buttonStyle(currentTool === "line")}">Line</button>
        <button id="svg-draw-freehand" type="button" style="${buttonStyle(currentTool === "freehand")}">Freehand</button>
        <button id="svg-draw-bezier" type="button" style="${buttonStyle(currentTool === "bezier")}">Bezier</button>
      </div>
      <div style="display:flex;align-items:center;gap:4px;">
        <button id="svg-add-rect" type="button" style="padding:2px 8px;border:1px solid #333;background:#fff;cursor:pointer;">Rect</button>
        <button id="svg-add-circle" type="button" style="padding:2px 8px;border:1px solid #333;background:#fff;cursor:pointer;">Circle</button>
        <button id="svg-add-ellipse" type="button" style="padding:2px 8px;border:1px solid #333;background:#fff;cursor:pointer;">Ellipse</button>
        <button id="svg-add-polygon" type="button" style="padding:2px 8px;border:1px solid #333;background:#fff;cursor:pointer;">Polygon</button>
      </div>
      <label for="svg-fill-color-input" style="font-size:12px;">Fill</label>
      <input id="svg-fill-color-input" type="color" value="${fill}" style="cursor:pointer;" />
      <label for="svg-stroke-color-input" style="font-size:12px;">Stroke</label>
      <input id="svg-stroke-color-input" type="color" value="${stroke}" style="cursor:pointer;" />
      <label for="svg-stroke-width-input" style="font-size:12px;">Stroke Width</label>
      <input id="svg-stroke-width-input" type="range" min="0" max="64" step="0.5" value="${safeStrokeWidth}" style="cursor:pointer;" />
      <span id="svg-stroke-width-value" style="font-family:monospace;font-size:12px;min-width:36px;">${safeStrokeWidth}px</span>
    </div>
  `;
  subToolbar.style.display = "flex";

  const setMode = (mode) => {
    window.NodevisionState.svgDrawTool = mode;
    ctx.setMode?.(mode);
    DrawSVG();
  };

  const setFill = (value) => {
    window.NodevisionState.svgFillColor = value;
    ctx.setFillColor?.(value);
  };

  const setStroke = (value) => {
    window.NodevisionState.svgStrokeColor = value;
    ctx.setStrokeColor?.(value);
  };

  const setStrokeWidth = (value) => {
    const numeric = Math.max(0, Math.min(64, Number.parseFloat(value) || 0));
    window.NodevisionState.svgStrokeWidth = numeric;
    ctx.setStrokeWidth?.(String(numeric));
    const label = subToolbar.querySelector("#svg-stroke-width-value");
    if (label) label.textContent = `${numeric}px`;
  };

  subToolbar.querySelector("#svg-draw-select")?.addEventListener("click", () => setMode("select"));
  subToolbar.querySelector("#svg-draw-line")?.addEventListener("click", () => setMode("line"));
  subToolbar.querySelector("#svg-draw-freehand")?.addEventListener("click", () => setMode("freehand"));
  subToolbar.querySelector("#svg-draw-bezier")?.addEventListener("click", () => setMode("bezier"));

  subToolbar.querySelector("#svg-add-rect")?.addEventListener("click", () => ctx.insertShape?.("rect"));
  subToolbar.querySelector("#svg-add-circle")?.addEventListener("click", () => ctx.insertShape?.("circle"));
  subToolbar.querySelector("#svg-add-ellipse")?.addEventListener("click", () => ctx.insertShape?.("ellipse"));
  subToolbar.querySelector("#svg-add-polygon")?.addEventListener("click", () => ctx.insertShape?.("polygon"));

  subToolbar.querySelector("#svg-fill-color-input")?.addEventListener("input", (e) => setFill(e.target.value));
  subToolbar.querySelector("#svg-stroke-color-input")?.addEventListener("input", (e) => setStroke(e.target.value));
  subToolbar.querySelector("#svg-stroke-width-input")?.addEventListener("input", (e) => setStrokeWidth(e.target.value));
}
