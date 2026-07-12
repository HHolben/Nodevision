// Nodevision/ApplicationSystem/public/PanelInstances/InfoPanels/SVGDrawingAssistPanel.mjs
// Drawing Assist panel for SVG-native brush gestures, guides, symmetry, masks, and clipping paths.

function ctx() {
  return window.SVGEditorContext || null;
}

function clear(node) {
  while (node?.firstChild) node.removeChild(node.firstChild);
}

function makeSection(titleText) {
  const section = document.createElement("section");
  Object.assign(section.style, {
    borderTop: "1px solid #d7d7d7",
    paddingTop: "8px",
    display: "grid",
    gap: "7px",
  });
  const title = document.createElement("div");
  title.textContent = titleText;
  Object.assign(title.style, { fontWeight: "700", fontSize: "13px" });
  section.appendChild(title);
  return section;
}

function row(labelText, control) {
  const label = document.createElement("label");
  Object.assign(label.style, {
    display: "grid",
    gridTemplateColumns: "120px minmax(0, 1fr)",
    alignItems: "center",
    gap: "8px",
    fontSize: "12px",
  });
  const span = document.createElement("span");
  span.textContent = labelText;
  label.append(span, control);
  return label;
}

function styleInput(el) {
  Object.assign(el.style, {
    minHeight: "28px",
    fontSize: "12px",
    border: "1px solid #c7c7c7",
    borderRadius: "6px",
    background: "#fff",
  });
  return el;
}

function checkbox(value, onChange) {
  const input = document.createElement("input");
  input.type = "checkbox";
  input.checked = Boolean(value);
  Object.assign(input.style, { width: "18px", height: "18px" });
  input.onchange = () => onChange(input.checked);
  return input;
}

function number(value, options, onChange) {
  const input = styleInput(document.createElement("input"));
  input.type = "number";
  input.value = String(value);
  input.min = options?.min ?? "";
  input.max = options?.max ?? "";
  input.step = options?.step ?? "1";
  input.onchange = () => onChange(input.value);
  return input;
}

function text(value, onChange) {
  const input = styleInput(document.createElement("input"));
  input.type = "text";
  input.value = String(value || "");
  input.onchange = () => onChange(input.value);
  return input;
}

function select(value, options, onChange) {
  const input = styleInput(document.createElement("select"));
  options.forEach(([optValue, label]) => {
    const option = document.createElement("option");
    option.value = optValue;
    option.textContent = label;
    input.appendChild(option);
  });
  input.value = value;
  input.onchange = () => onChange(input.value);
  return input;
}

function button(label, action, title = "") {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.textContent = label;
  btn.title = title || label;
  Object.assign(btn.style, { minHeight: "30px" });
  btn.onclick = () => action?.();
  return btn;
}

function buttonGrid(buttons) {
  const grid = document.createElement("div");
  Object.assign(grid.style, {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
    gap: "6px",
  });
  buttons.forEach((btn) => grid.appendChild(btn));
  return grid;
}

function pointRows(section, label, point, key, update) {
  const wrap = document.createElement("div");
  Object.assign(wrap.style, {
    display: "grid",
    gridTemplateColumns: "120px 1fr 1fr",
    gap: "8px",
    alignItems: "center",
    fontSize: "12px",
  });
  const span = document.createElement("span");
  span.textContent = label;
  const x = number(point?.x ?? 0, { step: "1" }, (value) => update({ [key]: { ...(point || {}), x: Number(value) } }));
  const y = number(point?.y ?? 0, { step: "1" }, (value) => update({ [key]: { ...(point || {}), y: Number(value) } }));
  x.title = `${label} X`;
  y.title = `${label} Y`;
  wrap.append(span, x, y);
  section.appendChild(wrap);
}

function renderPanel(panel) {
  clear(panel);
  const api = ctx();
  Object.assign(panel.style, {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    overflow: "auto",
    padding: "8px",
  });

  if (!api) {
    const msg = document.createElement("div");
    msg.textContent = "Open an SVG editor to show Drawing Assist controls.";
    msg.style.color = "#b00020";
    panel.appendChild(msg);
    return;
  }

  let settings = api.getDrawingAssistSettings?.() || {};
  const update = (patch) => {
    settings = api.setDrawingAssistSettings?.(patch) || settings;
    renderPanel(panel);
  };

  const guide = makeSection("Guides");
  guide.appendChild(row("Show", checkbox(settings.guidesVisible, (v) => update({ guidesVisible: v }))));
  guide.appendChild(row("Type", select(settings.guideType || "rectangular-grid", [
    ["rectangular-grid", "Rectangular grid"],
    ["isometric-grid", "Isometric grid"],
    ["horizontal-symmetry", "Horizontal symmetry"],
    ["vertical-symmetry", "Vertical symmetry"],
    ["quadrant-symmetry", "Quadrant symmetry"],
    ["radial-symmetry", "Radial symmetry"],
    ["one-point-perspective", "One-point perspective"],
    ["two-point-perspective", "Two-point perspective"],
  ], (v) => update({ guideType: v }))));
  guide.appendChild(row("Spacing", number(settings.guideSpacing || 24, { min: "1", step: "1" }, (v) => update({ guideSpacing: v }))));
  guide.appendChild(row("Angle", number(settings.guideAngle || 0, { step: "1" }, (v) => update({ guideAngle: v }))));
  pointRows(guide, "Origin", settings.guideOrigin, "guideOrigin", update);
  pointRows(guide, "Vanishing 1", settings.vanishingPoint1, "vanishingPoint1", update);
  pointRows(guide, "Vanishing 2", settings.vanishingPoint2, "vanishingPoint2", update);
  guide.appendChild(row("Radial segments", number(settings.radialSegmentCount || 8, { min: "2", max: "64", step: "1" }, (v) => update({ radialSegmentCount: v }))));
  guide.appendChild(row("Opacity", number(settings.guideOpacity || 0.35, { min: "0", max: "1", step: "0.05" }, (v) => update({ guideOpacity: v }))));
  guide.appendChild(row("Snap strength", number(settings.snapStrength || 0, { min: "0", max: "1", step: "0.05" }, (v) => update({ snapStrength: v }))));
  guide.appendChild(row("Assisted drawing", checkbox(settings.assistedDrawing, (v) => update({ assistedDrawing: v }))));
  guide.appendChild(row("Active layer only", checkbox(settings.applyAssistToActiveLayer, (v) => update({ applyAssistToActiveLayer: v }))));
  guide.appendChild(buttonGrid([
    button("Insert Guides", () => api.insertGuidesIntoSvg?.(), "Insert visible guides as ordinary SVG geometry"),
  ]));
  panel.appendChild(guide);

  const symmetry = makeSection("Symmetry");
  symmetry.appendChild(row("Mode", select(settings.symmetryMode || "none", [
    ["none", "None"],
    ["horizontal", "Horizontal"],
    ["vertical", "Vertical"],
    ["quadrant", "Quadrant"],
    ["radial", "Radial"],
  ], (v) => update({ symmetryMode: v }))));
  symmetry.appendChild(row("Output", select(settings.symmetryOutputStrategy || "linked-use", [
    ["linked-use", "Linked clones"],
    ["independent-copy", "Independent copies"],
    ["expanded-geometry", "Expanded geometry"],
  ], (v) => update({ symmetryOutputStrategy: v }))));
  pointRows(symmetry, "Axis", settings.symmetryAxis, "symmetryAxis", update);
  symmetry.appendChild(row("Mirrored radial", checkbox(settings.radialMirrored, (v) => update({ radialMirrored: v }))));
  symmetry.appendChild(buttonGrid([
    button("Expand Symmetry", () => api.expandSymmetrySelection?.(), "Expand linked symmetry clones into editable objects"),
  ]));
  panel.appendChild(symmetry);

  const gestures = makeSection("Gestures");
  gestures.appendChild(row("Shape hold ms", number(settings.shapeHoldDelayMs || 450, { min: "120", max: "5000", step: "10" }, (v) => update({ shapeHoldDelayMs: v }))));
  gestures.appendChild(row("Shape sensitivity", number(settings.shapeRecognitionSensitivity || 0.62, { min: "0", max: "1", step: "0.05" }, (v) => update({ shapeRecognitionSensitivity: v }))));
  gestures.appendChild(row("Synthetic pressure", number(settings.syntheticMousePressure || 0.5, { min: "0.02", max: "1", step: "0.05" }, (v) => update({ syntheticMousePressure: v }))));
  gestures.appendChild(row("Eyedropper target", select(settings.eyedropperTarget || "recent", [
    ["fill", "Fill"],
    ["stroke", "Stroke"],
    ["recent", "Last edited"],
  ], (v) => update({ eyedropperTarget: v }))));
  gestures.appendChild(row("QuickMenu key", text(settings.quickMenuShortcut || "q", (v) => update({ quickMenuShortcut: v }))));
  gestures.appendChild(row("QuickMenu slots", text((settings.quickMenuActionSlots || []).join(", "), (v) => update({ quickMenuActionSlots: v.split(",").map((part) => part.trim()).filter(Boolean) }))));
  gestures.appendChild(row("Long press menu", checkbox(settings.gestureLongPressQuickMenu, (v) => update({ gestureLongPressQuickMenu: v }))));
  gestures.appendChild(row("Barrel button menu", checkbox(settings.gestureBarrelButtonQuickMenu, (v) => update({ gestureBarrelButtonQuickMenu: v }))));
  gestures.appendChild(row("Right click menu", checkbox(settings.gestureRightClickQuickMenu, (v) => update({ gestureRightClickQuickMenu: v }))));
  gestures.appendChild(row("Eraser mode", select(settings.eraserMode || "delete-object", [
    ["delete-object", "Delete object"],
    ["subtract-path", "Split/subtract path"],
    ["trim-stroke", "Trim stroke segment"],
    ["mask-eraser", "Mask eraser"],
    ["restore-mask", "Restore mask"],
  ], (v) => update({ eraserMode: v }))));
  panel.appendChild(gestures);

  const masks = makeSection("Masks And Clips");
  masks.appendChild(buttonGrid([
    button("Add Mask", () => api.addMask?.()),
    button("Add Clip Path", () => api.addClippingPath?.()),
    button("Use Selected As Mask", () => api.useSelectedObjectAsMask?.()),
    button("Use Selected As Clip", () => api.useSelectedObjectAsClippingPath?.()),
    button("Disable Mask", () => api.disableSelectedMaskOrClip?.("mask")),
    button("Enable Mask", () => api.enableSelectedMaskOrClip?.("mask")),
    button("Detach Mask", () => api.detachSelectedMaskOrClip?.("mask")),
    button("Release Clip", () => api.releaseSelectedClipPath?.()),
  ]));
  panel.appendChild(masks);

  const layers = makeSection("Layer Actions");
  layers.appendChild(buttonGrid([
    button("Lock Selection", () => api.lockSelection?.(true)),
    button("Unlock Selection", () => api.lockSelection?.(false)),
    button("Solo Selection", () => api.soloSelection?.()),
    button("Select Contents", () => api.selectSelectionContents?.()),
    button("Group", () => api.groupSelection?.()),
    button("Ungroup", () => api.ungroupSelection?.()),
  ]));
  panel.appendChild(layers);
}

export async function setupPanel(panel) {
  if (!panel) throw new Error("Panel container required.");
  const rerender = () => renderPanel(panel);
  renderPanel(panel);
  window.addEventListener("nv-svg-drawing-assist-settings-changed", rerender);
  window.addEventListener("nv-svg-editor-context-ready", rerender);
  panel.__nvCleanupDrawingAssistPanel = () => {
    window.removeEventListener("nv-svg-drawing-assist-settings-changed", rerender);
    window.removeEventListener("nv-svg-editor-context-ready", rerender);
  };
}
