// Nodevision/ApplicationSystem/public/ToolbarJSONfiles/htmlTextStyleToolbar.mjs
// Styles -> Text subtoolbar for the graphical HTML/WYSIWYG editor.

function tools() {
  return window.HTMLWysiwygTools || {};
}

function clampNumber(value, { min = -Infinity, max = Infinity } = {}) {
  const n = Number.parseFloat(value);
  if (!Number.isFinite(n)) return null;
  return Math.min(max, Math.max(min, n));
}

function clampTransparency(value) {
  return clampNumber(value, { min: 0, max: 100 }) ?? 0;
}

function hexToRgb(value) {
  const text = String(value || "").trim();
  const match = text.match(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/);
  if (!match) return null;
  const raw = match[1].length === 3
    ? match[1].split("").map((part) => `${part}${part}`).join("")
    : match[1];
  return {
    r: Number.parseInt(raw.slice(0, 2), 16),
    g: Number.parseInt(raw.slice(2, 4), 16),
    b: Number.parseInt(raw.slice(4, 6), 16),
    a: raw.length === 8 ? Number.parseInt(raw.slice(6, 8), 16) / 255 : 1,
  };
}

function rgbToHex({ r, g, b } = {}, fallback = "#000000") {
  if (![r, g, b].every(Number.isFinite)) return fallback;
  const toHex = (part) => Math.max(0, Math.min(255, Math.round(part))).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function parseAlpha(value, fallback = 1) {
  const text = String(value ?? "").trim();
  if (!text) return fallback;
  const n = text.endsWith("%") ? Number.parseFloat(text) / 100 : Number.parseFloat(text);
  return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : fallback;
}

function parseCssColor(value, fallback = "#000000") {
  const text = String(value || "").trim();
  if (!text) return { hex: fallback, transparency: 0 };
  if (/^transparent$/i.test(text)) return { hex: fallback, transparency: 100 };

  const fromHex = hexToRgb(text);
  if (fromHex) {
    return {
      hex: rgbToHex(fromHex, fallback),
      transparency: Math.round((1 - fromHex.a) * 100),
    };
  }

  const commaMatch = text.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+%?))?\s*\)$/i);
  if (commaMatch) {
    const color = {
      r: Number.parseFloat(commaMatch[1]),
      g: Number.parseFloat(commaMatch[2]),
      b: Number.parseFloat(commaMatch[3]),
    };
    const alpha = parseAlpha(commaMatch[4], 1);
    return {
      hex: rgbToHex(color, fallback),
      transparency: Math.round((1 - alpha) * 100),
    };
  }

  const slashMatch = text.match(/^rgba?\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+%?))?\s*\)$/i);
  if (slashMatch) {
    const color = {
      r: Number.parseFloat(slashMatch[1]),
      g: Number.parseFloat(slashMatch[2]),
      b: Number.parseFloat(slashMatch[3]),
    };
    const alpha = parseAlpha(slashMatch[4], 1);
    return {
      hex: rgbToHex(color, fallback),
      transparency: Math.round((1 - alpha) * 100),
    };
  }

  return { hex: fallback, transparency: 0 };
}

function formatAlpha(alpha) {
  const clamped = Math.max(0, Math.min(1, alpha));
  if (clamped === 0 || clamped === 1) return String(clamped);
  return String(Math.round(clamped * 100) / 100);
}

function colorWithTransparency(hex, transparency, fallback = "#000000") {
  const rgb = hexToRgb(hex) || hexToRgb(fallback) || { r: 0, g: 0, b: 0 };
  const alpha = (100 - clampTransparency(transparency)) / 100;
  if (alpha >= 1) return rgbToHex(rgb, fallback);
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${formatAlpha(alpha)})`;
}

function readColorControl(mount, name, fallback) {
  const transparent = field(mount, `${name}Transparent`)?.checked;
  const transparency = transparent ? 100 : clampTransparency(field(mount, `${name}Transparency`)?.value);
  return colorWithTransparency(field(mount, name)?.value || fallback, transparency, fallback);
}

function buildShadow(offsetX, offsetY, blur, color) {
  const x = clampNumber(offsetX, { min: -200, max: 200 }) ?? 2;
  const y = clampNumber(offsetY, { min: -200, max: 200 }) ?? 2;
  const b = clampNumber(blur, { min: 0, max: 200 }) ?? 4;
  return `${x}px ${y}px ${b}px ${color || "#000000"}`;
}

function renderColorControls(name, label, value, title) {
  return `<span style="display:flex;align-items:center;gap:5px;flex-wrap:nowrap;" title="${title}">
    <label style="display:flex;align-items:center;gap:5px;">${label}
      <input data-field="${name}" type="color" value="${value}" style="width:30px;height:22px;padding:0;border:0;background:transparent;" />
    </label>
    <label style="display:flex;align-items:center;gap:3px;" title="Make ${label.toLowerCase()} fully transparent">
      <input data-field="${name}Transparent" type="checkbox" style="width:14px;height:14px;" /> Off
    </label>
    <label style="display:flex;align-items:center;gap:4px;" title="${label} transparency">Trans
      <input data-field="${name}Transparency" type="range" min="0" max="100" step="1" value="0" style="width:78px;" />
      <span data-field="${name}TransparencyValue" style="display:inline-block;width:32px;text-align:right;">0%</span>
    </label>
  </span>`;
}

function renderToolbar(mount) {
  mount.innerHTML = `<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;font:12px monospace;">
    ${renderColorControls("color", "Color", "#222222", "Text color")}
    ${renderColorControls("backgroundColor", "Highlight", "#ffffe3", "Text background highlight")}
    ${renderColorControls("outlineColor", "Outline", "#000000", "Text outline color")}
    <label style="display:flex;align-items:center;gap:5px;" title="Text outline width">W
      <input data-field="outlineWidth" type="number" min="0" max="20" step="0.25" value="0" style="width:56px;height:22px;" />
    </label>
    ${renderColorControls("shadowColor", "Shadow", "#000000", "Text shadow color")}
    <label style="display:flex;align-items:center;gap:5px;" title="Shadow X offset">X
      <input data-field="shadowX" type="number" min="-200" max="200" step="1" value="2" style="width:50px;height:22px;" />
    </label>
    <label style="display:flex;align-items:center;gap:5px;" title="Shadow Y offset">Y
      <input data-field="shadowY" type="number" min="-200" max="200" step="1" value="2" style="width:50px;height:22px;" />
    </label>
    <label style="display:flex;align-items:center;gap:5px;" title="Shadow blur">Blur
      <input data-field="shadowBlur" type="number" min="0" max="200" step="1" value="4" style="width:50px;height:22px;" />
    </label>
    <button type="button" data-action="select" title="Select the nearest text element" style="font:12px monospace;padding:5px 9px;border:1px solid #777;background:#f4f4f4;cursor:pointer;">Target</button>
    <button type="button" data-action="apply" title="Apply text style" style="font:12px monospace;padding:5px 9px;border:1px solid #333;background:#eee;cursor:pointer;">Apply</button>
    <button type="button" data-action="clear" title="Clear text color, outline, and shadow" style="font:12px monospace;padding:5px 9px;border:1px solid #777;background:#f4f4f4;cursor:pointer;">Clear</button>
    <span data-field="status" style="min-width:120px;color:#555;"></span>
  </div>`;
}

function field(mount, name) {
  return mount.querySelector(`[data-field="${name}"]`);
}

function setStatus(mount, message, isError = false) {
  const status = field(mount, "status");
  if (!status) return;
  status.textContent = String(message || "");
  status.style.color = isError ? "#b00" : "#555";
}

function readControls(mount) {
  const outlineWidth = clampNumber(field(mount, "outlineWidth")?.value, { min: 0, max: 20 }) ?? 0;
  return {
    color: readColorControl(mount, "color", "#222222"),
    backgroundColor: readColorControl(mount, "backgroundColor", "#ffffe3"),
    webkitTextStrokeColor: readColorControl(mount, "outlineColor", "#000000"),
    webkitTextStrokeWidth: outlineWidth > 0 ? `${outlineWidth}px` : "",
    textShadow: buildShadow(
      field(mount, "shadowX")?.value,
      field(mount, "shadowY")?.value,
      field(mount, "shadowBlur")?.value,
      readColorControl(mount, "shadowColor", "#000000"),
    ),
  };
}

function syncColorControl(mount, name, value, fallback) {
  const parsed = parseCssColor(value, fallback);
  const color = field(mount, name);
  const transparent = field(mount, `${name}Transparent`);
  const transparency = field(mount, `${name}Transparency`);
  const valueLabel = field(mount, `${name}TransparencyValue`);
  if (color) color.value = parsed.hex;
  if (transparent) transparent.checked = parsed.transparency >= 100;
  if (transparency) transparency.value = String(parsed.transparency);
  if (valueLabel) valueLabel.textContent = `${parsed.transparency}%`;
}

function syncTransparencyDisplay(mount, name) {
  const slider = field(mount, `${name}Transparency`);
  const checkbox = field(mount, `${name}Transparent`);
  const valueLabel = field(mount, `${name}TransparencyValue`);
  if (!slider) return;
  const value = Math.round(clampTransparency(slider.value));
  slider.value = String(value);
  if (checkbox) checkbox.checked = value >= 100;
  if (valueLabel) valueLabel.textContent = `${value}%`;
}

function handleTransparentToggle(mount, name) {
  const checkbox = field(mount, `${name}Transparent`);
  const slider = field(mount, `${name}Transparency`);
  if (!checkbox || !slider) return;
  if (checkbox.checked) {
    slider.dataset.nvPreviousTransparency = slider.value;
    slider.value = "100";
  } else if (Number(slider.value) >= 100) {
    slider.value = slider.dataset.nvPreviousTransparency && Number(slider.dataset.nvPreviousTransparency) < 100
      ? slider.dataset.nvPreviousTransparency
      : "0";
  }
  syncTransparencyDisplay(mount, name);
}

function parseTextShadow(shadowText) {
  const text = String(shadowText || "").trim();
  if (!text || /^none$/i.test(text)) return null;
  const colorMatch = text.match(/rgba?\([^)]*\)|#[0-9a-fA-F]{3,8}\b|transparent\b/i);
  const lengths = Array.from(text.matchAll(/(-?\d+(?:\.\d+)?)px/g)).map((match) => match[1]);
  if (lengths.length < 2 && !colorMatch) return null;
  return {
    color: colorMatch?.[0] || "#000000",
    x: lengths[0] || "2",
    y: lengths[1] || "2",
    blur: lengths[2] || "4",
  };
}

function syncFromSelection(mount) {
  const snapshot = typeof tools().readTextStyleSelection === "function"
    ? tools().readTextStyleSelection()
    : {};
  if (!snapshot || !Object.keys(snapshot).length) return;
  syncColorControl(mount, "color", snapshot.color, "#222222");
  syncColorControl(mount, "backgroundColor", snapshot.backgroundColor, "#ffffe3");
  syncColorControl(mount, "outlineColor", snapshot.outlineColor, "#000000");
  const outlineWidth = Number.parseFloat(String(snapshot.outlineWidth || "0"));
  field(mount, "outlineWidth").value = Number.isFinite(outlineWidth) ? String(outlineWidth) : "0";
  const shadow = parseTextShadow(snapshot.shadow);
  if (shadow) {
    field(mount, "shadowX").value = shadow.x;
    field(mount, "shadowY").value = shadow.y;
    field(mount, "shadowBlur").value = shadow.blur;
    syncColorControl(mount, "shadowColor", shadow.color, "#000000");
  }
}

export function initToolbarWidget(hostElement) {
  if (!hostElement || hostElement.dataset.nvHtmlTextStyleToolbarBound === "true") return;
  hostElement.dataset.nvHtmlTextStyleToolbarBound = "true";
  const mount = hostElement.querySelector("#nv-html-text-style-toolbar") || hostElement;
  renderToolbar(mount);

  const rememberSelection = () => {
    if (typeof tools().saveCurrentSelection === "function") tools().saveCurrentSelection();
  };

  mount.addEventListener("pointerdown", rememberSelection, true);
  mount.addEventListener("mousedown", rememberSelection, true);

  mount.addEventListener("input", (evt) => {
    if (!evt.target?.matches?.("input")) return;
    const transparencyField = evt.target?.dataset?.field?.match(/^(.+)Transparency$/);
    if (transparencyField) syncTransparencyDisplay(mount, transparencyField[1]);
    setStatus(mount, "");
  });

  mount.addEventListener("change", (evt) => {
    const transparentField = evt.target?.dataset?.field?.match(/^(.+)Transparent$/);
    if (transparentField) handleTransparentToggle(mount, transparentField[1]);
    setStatus(mount, "");
  });

  mount.addEventListener("click", (evt) => {
    const action = evt.target?.closest?.("[data-action]")?.dataset?.action || "";
    if (!action) return;
    evt.preventDefault();
    setStatus(mount, "");
    rememberSelection();

    try {
      if (typeof tools().restoreSavedSelection === "function") tools().restoreSavedSelection();
      if (action === "select") {
        if (typeof tools().selectTextStyleTarget !== "function") throw new Error("No active WYSIWYG editor.");
        tools().selectTextStyleTarget();
        syncFromSelection(mount);
        setStatus(mount, "Text targeted.");
        return;
      }
      if (action === "clear") {
        if (typeof tools().removeTextStylesFromSelection !== "function") throw new Error("No active WYSIWYG editor.");
        tools().removeTextStylesFromSelection();
        setStatus(mount, "Text styles cleared.");
        return;
      }
      if (action === "apply") {
        if (typeof tools().applyTextStylesToSelection !== "function") throw new Error("No active WYSIWYG editor.");
        tools().applyTextStylesToSelection(readControls(mount));
        setStatus(mount, "Text style applied.");
      }
    } catch (err) {
      console.warn("[htmlTextStyleToolbar]", err);
      setStatus(mount, err?.message || String(err), true);
    }
  });

  syncFromSelection(mount);
}
