// Nodevision/ApplicationSystem/public/PanelInstances/Common/Appearance/AppearancePanel.mjs
// This module renders reusable fill and outline controls against a small host adapter that owns editor-specific reading, previewing, committing, cancellation, eyedropper sampling, and cleanup.

import { normalizeAppearance, normalizeAppearanceCapabilities } from "./AppearanceModel.mjs";

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  Object.entries(attrs).forEach(([key, value]) => {
    if (key === "className") node.className = value;
    else if (key === "textContent") node.textContent = value;
    else if (key === "style") Object.assign(node.style, value || {});
    else if (value !== null && value !== undefined) node.setAttribute(key, String(value));
  });
  children.filter(Boolean).forEach((child) => node.append(child));
  return node;
}

function row(label, control, inputId = "") {
  const wrapper = el("label", { className: "nv-appearance-row" });
  const text = el("span", { textContent: label });
  if (inputId) wrapper.setAttribute("for", inputId);
  wrapper.append(text, control);
  return wrapper;
}

function makeSelect(id, options, value) {
  const select = el("select", { id });
  options.forEach(([optionValue, label]) => {
    const opt = el("option", { value: optionValue, textContent: label });
    if (optionValue === value) opt.selected = true;
    select.append(opt);
  });
  return select;
}

function setHidden(node, hidden) {
  if (!node) return;
  node.hidden = Boolean(hidden);
  node.style.display = hidden ? "none" : "";
}

function setPreview(preview, value) {
  const appearance = normalizeAppearance(value);
  const fill = appearance.fill;
  preview.style.opacity = "1";
  preview.style.background = "repeating-conic-gradient(#f3f4f6 0% 25%, #fff 0% 50%) 0 0 / 16px 16px";
  if (fill.type === "solid") preview.style.background = fill.color;
  if (fill.type === "gradient") preview.style.background = `linear-gradient(90deg, ${fill.gradient.from}, ${fill.gradient.to})`;
  if (fill.type === "pattern") {
    const fg = fill.pattern.foreground;
    const bg = fill.pattern.background;
    preview.style.background = fill.pattern.key === "dots"
      ? `radial-gradient(${fg} 20%, transparent 22%) 0 0 / 12px 12px, ${bg}`
      : fill.pattern.key === "grid"
        ? `linear-gradient(${fg} 1px, transparent 1px), linear-gradient(90deg, ${fg} 1px, transparent 1px), ${bg}`
        : `repeating-linear-gradient(45deg, ${bg} 0 8px, ${fg} 8px 10px, ${bg} 10px 18px)`;
    if (fill.pattern.key === "grid") preview.style.backgroundSize = "12px 12px";
  }
  preview.style.opacity = String(fill.opacity);
  preview.style.borderColor = appearance.outline.enabled ? appearance.outline.color : "#9ca3af";
  preview.style.borderWidth = appearance.outline.enabled ? `${Math.max(1, appearance.outline.width)}px` : "1px";
  preview.style.borderStyle = appearance.outline.dasharray ? "dashed" : "solid";
}

export function createAppearancePanel(host, options = {}) {
  const adapter = host || {};
  const capabilities = normalizeAppearanceCapabilities(adapter.getCapabilities?.() || options.capabilities || {});
  let state = normalizeAppearance(adapter.readAppearance?.() || {});
  let disposed = false;
  let previewRaf = 0;
  const disposers = [];

  const root = el("div", { className: "nv-appearance-panel", role: "group", "aria-label": options.title || "Appearance" });
  root.innerHTML = `
    <style>
      .nv-appearance-panel{display:flex;flex-direction:column;gap:10px;min-width:280px;max-width:520px;font:13px system-ui,-apple-system,Segoe UI,sans-serif;color:#111827}
      .nv-appearance-tabs{display:flex;gap:4px;border-bottom:1px solid #d1d5db}
      .nv-appearance-tab{border:1px solid #d1d5db;border-bottom:0;background:#f9fafb;padding:6px 10px;border-radius:6px 6px 0 0;cursor:pointer}
      .nv-appearance-tab[aria-selected="true"]{background:#fff;font-weight:600}
      .nv-appearance-section{display:grid;gap:8px}
      .nv-appearance-row{display:grid;grid-template-columns:minmax(88px,1fr) minmax(140px,2fr);align-items:center;gap:8px}
      .nv-appearance-row input,.nv-appearance-row select{min-width:0;width:100%;box-sizing:border-box}
      .nv-appearance-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:4px}
      .nv-appearance-preview{height:42px;border:1px solid #9ca3af;border-radius:6px;box-sizing:border-box}
      .nv-appearance-message{min-height:18px;color:#7f1d1d}
    </style>
  `;

  const tabBar = el("div", { className: "nv-appearance-tabs", role: "tablist" });
  const fillTab = el("button", { className: "nv-appearance-tab", type: "button", role: "tab", "aria-selected": "true", textContent: "Fill" });
  const outlineTab = el("button", { className: "nv-appearance-tab", type: "button", role: "tab", "aria-selected": "false", textContent: "Outline" });
  tabBar.append(fillTab, outlineTab);

  const preview = el("div", { className: "nv-appearance-preview", "aria-label": "Appearance preview", role: "img" });
  const message = el("div", { className: "nv-appearance-message", role: "status", "aria-live": "polite" });

  const fillSection = el("div", { className: "nv-appearance-section", role: "tabpanel" });
  const fillType = makeSelect("nv-appearance-fill-type", [
    ["none", "Transparent"],
    ["solid", "Solid color"],
    ["gradient", "Gradient"],
    ["pattern", "Pattern"],
  ], state.fill.type);
  const fillColor = el("input", { id: "nv-appearance-fill-color", type: "color", value: state.fill.color });
  const fillOpacity = el("input", { id: "nv-appearance-fill-opacity", type: "range", min: "0", max: "1", step: "0.01", value: state.fill.opacity });
  const gradFrom = el("input", { id: "nv-appearance-gradient-from", type: "color", value: state.fill.gradient.from });
  const gradTo = el("input", { id: "nv-appearance-gradient-to", type: "color", value: state.fill.gradient.to });
  const patternSelect = makeSelect("nv-appearance-pattern", (capabilities.patterns || []).map((p) => [p.key, p.label || p.key]), state.fill.pattern.key);
  const patternFg = el("input", { id: "nv-appearance-pattern-fg", type: "color", value: state.fill.pattern.foreground });
  const eyedropper = el("button", { type: "button", textContent: "Eyedropper", title: "Sample a color from the current editor" });
  fillSection.append(
    row("Paint", fillType, fillType.id),
    row("Color", fillColor, fillColor.id),
    row("Opacity", fillOpacity, fillOpacity.id),
    row("Gradient from", gradFrom, gradFrom.id),
    row("Gradient to", gradTo, gradTo.id),
    row("Pattern", patternSelect, patternSelect.id),
    row("Pattern color", patternFg, patternFg.id),
    capabilities.fill.eyedropper ? eyedropper : null,
  );

  const outlineSection = el("div", { className: "nv-appearance-section", role: "tabpanel" });
  const outlineEnabled = el("input", { id: "nv-appearance-outline-enabled", type: "checkbox" });
  outlineEnabled.checked = state.outline.enabled;
  const outlineColor = el("input", { id: "nv-appearance-outline-color", type: "color", value: state.outline.color });
  const outlineOpacity = el("input", { id: "nv-appearance-outline-opacity", type: "range", min: "0", max: "1", step: "0.01", value: state.outline.opacity });
  const outlineWidth = el("input", { id: "nv-appearance-outline-width", type: "number", min: "0", step: "0.1", value: state.outline.width });
  const dash = makeSelect("nv-appearance-outline-dash", [["", "Solid"], ["4 2", "Dashed"], ["1 2", "Dotted"]], state.outline.dasharray);
  const cap = makeSelect("nv-appearance-linecap", [["butt", "Butt"], ["round", "Round"], ["square", "Square"]], state.outline.linecap);
  const join = makeSelect("nv-appearance-linejoin", [["miter", "Miter"], ["round", "Round"], ["bevel", "Bevel"]], state.outline.linejoin);
  const miter = el("input", { id: "nv-appearance-miter", type: "number", min: "1", step: "0.5", value: state.outline.miterlimit });
  outlineSection.append(
    row("Outline", outlineEnabled, outlineEnabled.id),
    row("Color", outlineColor, outlineColor.id),
    row("Opacity", outlineOpacity, outlineOpacity.id),
    row("Width", outlineWidth, outlineWidth.id),
    row("Dash", dash, dash.id),
    row("Line cap", cap, cap.id),
    row("Line join", join, join.id),
    row("Miter limit", miter, miter.id),
  );

  const actions = el("div", { className: "nv-appearance-actions" });
  const cancel = el("button", { type: "button", textContent: "Cancel" });
  const apply = el("button", { type: "button", textContent: "Apply" });
  actions.append(cancel, apply);
  root.append(tabBar, preview, fillSection, outlineSection, message, actions);

  function syncCapabilityVisibility() {
    [...fillType.options].forEach((option) => {
      option.disabled = option.value !== "none" && capabilities.fill[option.value] === false;
    });
    if (!capabilities.fill.none && fillType.value === "none") fillType.value = capabilities.fill.solid ? "solid" : fillType.value;
    setHidden(fillColor.parentElement, !capabilities.fill.solid || state.fill.type !== "solid");
    setHidden(fillOpacity.parentElement, !capabilities.fill.opacity || state.fill.type === "none");
    setHidden(gradFrom.parentElement, !capabilities.fill.gradient || state.fill.type !== "gradient");
    setHidden(gradTo.parentElement, !capabilities.fill.gradient || state.fill.type !== "gradient");
    setHidden(patternSelect.parentElement, !capabilities.fill.pattern || state.fill.type !== "pattern");
    setHidden(patternFg.parentElement, !capabilities.fill.pattern || state.fill.type !== "pattern");
    setHidden(outlineColor.parentElement, !capabilities.outline.solid);
    setHidden(outlineOpacity.parentElement, !capabilities.outline.opacity);
    setHidden(outlineWidth.parentElement, !capabilities.outline.width);
    setHidden(dash.parentElement, !capabilities.outline.dasharray);
    setHidden(cap.parentElement, !capabilities.outline.linecap);
    setHidden(join.parentElement, !capabilities.outline.linejoin);
    setHidden(miter.parentElement, !capabilities.outline.miterlimit);
  }

  function readControls() {
    return normalizeAppearance({
      fill: {
        type: fillType.value,
        color: fillColor.value,
        opacity: fillOpacity.value,
        gradient: { ...state.fill.gradient, from: gradFrom.value, to: gradTo.value },
        pattern: { ...state.fill.pattern, key: patternSelect.value, foreground: patternFg.value },
      },
      outline: {
        enabled: outlineEnabled.checked,
        color: outlineColor.value,
        opacity: outlineOpacity.value,
        width: outlineWidth.value,
        dasharray: dash.value,
        linecap: cap.value,
        linejoin: join.value,
        miterlimit: miter.value,
      },
    });
  }

  function refreshControls(nextValue) {
    state = normalizeAppearance(nextValue || state);
    fillType.value = state.fill.type;
    fillColor.value = state.fill.color;
    fillOpacity.value = String(state.fill.opacity);
    gradFrom.value = state.fill.gradient.from;
    gradTo.value = state.fill.gradient.to;
    patternSelect.value = state.fill.pattern.key;
    patternFg.value = state.fill.pattern.foreground;
    outlineEnabled.checked = state.outline.enabled;
    outlineColor.value = state.outline.color;
    outlineOpacity.value = String(state.outline.opacity);
    outlineWidth.value = String(state.outline.width);
    dash.value = state.outline.dasharray;
    cap.value = state.outline.linecap;
    join.value = state.outline.linejoin;
    miter.value = String(state.outline.miterlimit);
    syncCapabilityVisibility();
    setPreview(preview, state);
  }

  function schedulePreview() {
    state = readControls();
    syncCapabilityVisibility();
    setPreview(preview, state);
    if (previewRaf) cancelAnimationFrame(previewRaf);
    previewRaf = requestAnimationFrame(() => {
      previewRaf = 0;
      try {
        adapter.previewAppearance?.(state);
        message.textContent = adapter.getValidationError?.() || "";
      } catch (err) {
        message.textContent = err?.message || "Preview failed.";
      }
    });
  }

  function selectTab(which) {
    const fillActive = which === "fill";
    fillTab.setAttribute("aria-selected", String(fillActive));
    outlineTab.setAttribute("aria-selected", String(!fillActive));
    setHidden(fillSection, !fillActive);
    setHidden(outlineSection, fillActive);
  }

  const controls = [fillType, fillColor, fillOpacity, gradFrom, gradTo, patternSelect, patternFg, outlineEnabled, outlineColor, outlineOpacity, outlineWidth, dash, cap, join, miter];
  controls.forEach((control) => {
    const eventName = control.type === "range" || control.type === "color" ? "input" : "change";
    control.addEventListener(eventName, schedulePreview);
  });
  fillTab.addEventListener("click", () => selectTab("fill"));
  outlineTab.addEventListener("click", () => selectTab("outline"));
  cancel.addEventListener("click", () => {
    adapter.cancelAppearance?.();
    options.onCancel?.();
  });
  apply.addEventListener("click", async () => {
    try {
      state = readControls();
      await adapter.commitAppearance?.(state);
      options.onDone?.(state);
    } catch (err) {
      message.textContent = err?.message || "Apply failed.";
    }
  });
  eyedropper.addEventListener("click", async () => {
    try {
      const sampled = await adapter.requestPaintSample?.("fill");
      if (!sampled) return;
      fillType.value = "solid";
      fillColor.value = sampled;
      schedulePreview();
    } catch (err) {
      message.textContent = err?.message || "Eyedropper unavailable.";
    }
  });

  const unsubscribe = adapter.subscribe?.((nextValue) => refreshControls(nextValue));
  if (typeof unsubscribe === "function") disposers.push(unsubscribe);

  selectTab("fill");
  refreshControls(state);

  return {
    element: root,
    refresh: refreshControls,
    activate() {
      fillTab.focus({ preventScroll: true });
    },
    destroy() {
      if (disposed) return;
      disposed = true;
      if (previewRaf) cancelAnimationFrame(previewRaf);
      disposers.forEach((dispose) => {
        try { dispose(); } catch {}
      });
      adapter.dispose?.();
    },
  };
}
