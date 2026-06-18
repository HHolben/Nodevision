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

function rgbaToHex(value, fallback = "#000000") {
  const text = String(value || "").trim();
  if (/^#[0-9a-fA-F]{6}$/.test(text)) return text;
  const match = text.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?/i);
  if (!match) return fallback;
  if (match[4] !== undefined && Number(match[4]) <= 0) return fallback;
  const toHex = (part) => Math.max(0, Math.min(255, Number(part) || 0)).toString(16).padStart(2, "0");
  return `#${toHex(match[1])}${toHex(match[2])}${toHex(match[3])}`;
}

function buildShadow(offsetX, offsetY, blur, color) {
  const x = clampNumber(offsetX, { min: -200, max: 200 }) ?? 2;
  const y = clampNumber(offsetY, { min: -200, max: 200 }) ?? 2;
  const b = clampNumber(blur, { min: 0, max: 200 }) ?? 4;
  return `${x}px ${y}px ${b}px ${color || "#000000"}`;
}

function renderToolbar(mount) {
  mount.innerHTML = `<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;font:12px monospace;">
    <label style="display:flex;align-items:center;gap:5px;" title="Text color">Color
      <input data-field="color" type="color" value="#222222" style="width:30px;height:22px;padding:0;border:0;background:transparent;" />
    </label>
    <label style="display:flex;align-items:center;gap:5px;" title="Text background highlight">Highlight
      <input data-field="backgroundColor" type="color" value="#ffffe3" style="width:30px;height:22px;padding:0;border:0;background:transparent;" />
    </label>
    <label style="display:flex;align-items:center;gap:5px;" title="Text outline color">Outline
      <input data-field="outlineColor" type="color" value="#000000" style="width:30px;height:22px;padding:0;border:0;background:transparent;" />
    </label>
    <label style="display:flex;align-items:center;gap:5px;" title="Text outline width">W
      <input data-field="outlineWidth" type="number" min="0" max="20" step="0.25" value="0" style="width:56px;height:22px;" />
    </label>
    <label style="display:flex;align-items:center;gap:5px;" title="Text shadow color">Shadow
      <input data-field="shadowColor" type="color" value="#000000" style="width:30px;height:22px;padding:0;border:0;background:transparent;" />
    </label>
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
    color: field(mount, "color")?.value || "#222222",
    backgroundColor: field(mount, "backgroundColor")?.value || "#ffffe3",
    webkitTextStrokeColor: field(mount, "outlineColor")?.value || "#000000",
    webkitTextStrokeWidth: outlineWidth > 0 ? `${outlineWidth}px` : "",
    textShadow: buildShadow(
      field(mount, "shadowX")?.value,
      field(mount, "shadowY")?.value,
      field(mount, "shadowBlur")?.value,
      field(mount, "shadowColor")?.value || "#000000",
    ),
  };
}

function syncFromSelection(mount) {
  const snapshot = typeof tools().readTextStyleSelection === "function"
    ? tools().readTextStyleSelection()
    : {};
  if (!snapshot || !Object.keys(snapshot).length) return;
  field(mount, "color").value = rgbaToHex(snapshot.color, "#222222");
  field(mount, "backgroundColor").value = rgbaToHex(snapshot.backgroundColor, "#ffffe3");
  field(mount, "outlineColor").value = rgbaToHex(snapshot.outlineColor, "#000000");
  const outlineWidth = Number.parseFloat(String(snapshot.outlineWidth || "0"));
  field(mount, "outlineWidth").value = Number.isFinite(outlineWidth) ? String(outlineWidth) : "0";
  const shadow = String(snapshot.shadow || "");
  const match = shadow.match(/(-?\d+(?:\.\d+)?)px\s+(-?\d+(?:\.\d+)?)px\s+(\d+(?:\.\d+)?)px\s+(#[0-9a-fA-F]{6}|rgba?\([^)]*\))/);
  if (match) {
    field(mount, "shadowX").value = match[1];
    field(mount, "shadowY").value = match[2];
    field(mount, "shadowBlur").value = match[3];
    field(mount, "shadowColor").value = rgbaToHex(match[4], "#000000");
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
