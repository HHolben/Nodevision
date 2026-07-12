// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/SVGeditorComponents/ShapeCorrectionPreview.mjs
// Temporary overlay and contextual subtoolbar for draw-and-hold shape correction.

import { createSvgElementFromSpec, shapeToSvgSpec } from "./ShapeRecognition.mjs";

function clearChildren(node) {
  while (node?.firstChild) node.removeChild(node.firstChild);
}

function percent(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "0%";
  return `${Math.round(Math.max(0, Math.min(1, n)) * 100)}%`;
}

function styleButton(button, primary = false) {
  Object.assign(button.style, {
    minHeight: "28px",
    border: "1px solid #9ba7b5",
    borderRadius: "4px",
    background: primary ? "#1f6feb" : "#f7f9fb",
    color: primary ? "#fff" : "#1f2933",
    padding: "3px 8px",
    fontSize: "12px",
    cursor: "pointer",
  });
}

function button(label, title, onClick, primary = false) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.textContent = label;
  btn.title = title;
  btn.setAttribute("aria-label", title || label);
  styleButton(btn, primary);
  btn.addEventListener("click", (event) => {
    event.preventDefault();
    onClick?.();
  });
  return btn;
}

function checkbox(labelText, title, checked, onChange) {
  const label = document.createElement("label");
  Object.assign(label.style, {
    display: "inline-flex",
    alignItems: "center",
    gap: "4px",
    fontSize: "12px",
    color: "#1f2933",
    minHeight: "28px",
  });
  const input = document.createElement("input");
  input.type = "checkbox";
  input.checked = Boolean(checked);
  input.title = title;
  input.addEventListener("change", () => onChange?.(input.checked));
  const span = document.createElement("span");
  span.textContent = labelText;
  label.append(input, span);
  return label;
}

export function createShapeCorrectionPreviewController(deps = {}) {
  const {
    overlayLayer,
    createSvgEl,
    getSubToolbar = () => document.getElementById("sub-toolbar"),
    uiAttrName = "data-nv-editor-ui",
    onCommit,
    onCancel,
    onRestore,
    onOptionsChange,
  } = deps;

  const state = {
    result: null,
    previewEl: null,
    options: {
      convertToPath: false,
      closePath: false,
      equalSides: false,
      perfectCircle: false,
      horizontal: false,
      vertical: false,
      angleSnap: true,
    },
    style: null,
  };

  function removePreview() {
    if (state.previewEl?.parentNode) state.previewEl.remove();
    state.previewEl = null;
  }

  function buildPreviewElement() {
    if (!state.result) return null;
    const spec = shapeToSvgSpec(state.result, state.style || {}, state.options);
    const el = createSvgElementFromSpec(createSvgEl, spec);
    if (!el) return null;
    el.setAttribute(uiAttrName, "shape-correction-preview");
    el.setAttribute("data-nv-shape-correction-preview", "true");
    el.setAttribute("pointer-events", "none");
    if (el.getAttribute("fill") && el.getAttribute("fill") !== "none") {
      el.setAttribute("fill-opacity", "0.16");
    }
    el.setAttribute("stroke", "#1f6feb");
    el.setAttribute("stroke-dasharray", "5 4");
    el.setAttribute("stroke-width", el.getAttribute("stroke-width") || "1");
    return el;
  }

  function renderPreview() {
    removePreview();
    const el = buildPreviewElement();
    if (!el || !overlayLayer) return;
    overlayLayer.appendChild(el);
    state.previewEl = el;
  }

  function renderToolbar() {
    const subToolbar = getSubToolbar();
    if (!subToolbar || !state.result) return;
    clearChildren(subToolbar);
    subToolbar.style.display = "flex";
    const wrapper = document.createElement("div");
    wrapper.dataset.nvShapeCorrectionToolbar = "true";
    wrapper.className = "nv-subtoolbar-widget";
    Object.assign(wrapper.style, {
      display: "flex",
      alignItems: "center",
      gap: "8px",
      flexWrap: "wrap",
      maxWidth: "100%",
    });

    const label = document.createElement("strong");
    label.textContent = `Shape: ${String(state.result.type || "shape").replace(/-/g, " ")}`;
    Object.assign(label.style, { fontSize: "12px", color: "#111827" });
    wrapper.appendChild(label);

    const confidence = document.createElement("span");
    confidence.textContent = `Confidence ${percent(state.result.confidence)}`;
    Object.assign(confidence.style, { fontSize: "12px", color: "#374151" });
    wrapper.appendChild(confidence);

    wrapper.appendChild(button("Restore Original", "Restore the original freehand stroke", () => onRestore?.()));
    wrapper.appendChild(checkbox("Convert to Path", "Commit the correction as a path", state.options.convertToPath, (value) => {
      state.options.convertToPath = value;
      renderPreview();
      onOptionsChange?.({ ...state.options });
    }));
    if (["polyline", "polygon", "smooth-open-curve"].includes(state.result.type)) {
      wrapper.appendChild(checkbox("Close Path", "Close or open the corrected path where applicable", state.options.closePath, (value) => {
        state.options.closePath = value;
        renderPreview();
        onOptionsChange?.({ ...state.options });
      }));
    }
    if (["triangle", "polygon", "rectangle"].includes(state.result.type)) {
      wrapper.appendChild(checkbox("Equal Sides", "Use equal side lengths for polygonal shapes", state.options.equalSides, (value) => {
        state.options.equalSides = value;
        renderPreview();
        onOptionsChange?.({ ...state.options });
      }));
    }
    if (state.result.type === "ellipse" || state.result.type === "circle") {
      wrapper.appendChild(checkbox("Perfect Circle", "Constrain ellipse correction to a circle", state.options.perfectCircle, (value) => {
        state.options.perfectCircle = value;
        renderPreview();
        onOptionsChange?.({ ...state.options });
      }));
    }
    if (state.result.type === "line") {
      wrapper.appendChild(checkbox("Horizontal", "Constrain the corrected line horizontally", state.options.horizontal, (value) => {
        state.options.horizontal = value;
        if (value) state.options.vertical = false;
        renderToolbar();
        renderPreview();
        onOptionsChange?.({ ...state.options });
      }));
      wrapper.appendChild(checkbox("Vertical", "Constrain the corrected line vertically", state.options.vertical, (value) => {
        state.options.vertical = value;
        if (value) state.options.horizontal = false;
        renderToolbar();
        renderPreview();
        onOptionsChange?.({ ...state.options });
      }));
      wrapper.appendChild(checkbox("Angle Snap", "Snap line correction to common angles", state.options.angleSnap, (value) => {
        state.options.angleSnap = value;
        renderPreview();
        onOptionsChange?.({ ...state.options });
      }));
    }

    wrapper.appendChild(button("Commit", "Commit corrected shape", () => onCommit?.(), true));
    wrapper.appendChild(button("Cancel", "Cancel shape correction", () => onCancel?.()));
    subToolbar.appendChild(wrapper);
  }

  function show(result, style = {}, options = {}) {
    state.result = result || null;
    state.style = style || {};
    state.options = { ...state.options, ...(options || {}) };
    renderPreview();
    renderToolbar();
  }

  function update(result, style = null) {
    if (result) state.result = result;
    if (style) state.style = style;
    if (!state.result) return;
    renderPreview();
    renderToolbar();
  }

  function hide({ clearToolbar = true } = {}) {
    removePreview();
    state.result = null;
    if (clearToolbar) {
      const subToolbar = getSubToolbar();
      const owned = subToolbar?.querySelector?.("[data-nv-shape-correction-toolbar='true']");
      if (owned) clearChildren(subToolbar);
    }
  }

  return {
    show,
    update,
    hide,
    renderPreview,
    getResult() {
      return state.result;
    },
    getOptions() {
      return { ...state.options };
    },
    isActive() {
      return Boolean(state.result);
    },
  };
}

