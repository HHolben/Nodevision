// Nodevision/ApplicationSystem/public/ToolbarJSONfiles/htmlDocumentStyleToolbar.mjs
// Styles -> Document subtoolbar for whole-document HTML/WYSIWYG backgrounds.

import { escapeHtml } from "./insertMediaCommon.mjs";
import { readFileAsDataUrl } from "./insertMediaIO.mjs";

function tools() {
  return window.HTMLWysiwygTools || {};
}


function clampTransparency(value, fallback = 0) {
  const n = Number.parseFloat(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(100, n));
}

function hexToRgb(value) {
  const text = String(value || "").trim();
  const match = text.match(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/);
  if (!match) return null;
  const raw = match[1].length === 3
    ? match[1].split("").map((part) => part + part).join("")
    : match[1];
  return {
    r: Number.parseInt(raw.slice(0, 2), 16),
    g: Number.parseInt(raw.slice(2, 4), 16),
    b: Number.parseInt(raw.slice(4, 6), 16),
    a: raw.length === 8 ? Number.parseInt(raw.slice(6, 8), 16) / 255 : 1,
  };
}

function rgbToHex({ r, g, b } = {}, fallback = "#ffffff") {
  if (![r, g, b].every(Number.isFinite)) return fallback;
  const toHex = (part) => Math.max(0, Math.min(255, Math.round(part))).toString(16).padStart(2, "0");
  return "#" + toHex(r) + toHex(g) + toHex(b);
}

function parseAlpha(value, fallback = 1) {
  const text = String(value ?? "").trim();
  if (!text) return fallback;
  const n = text.endsWith("%") ? Number.parseFloat(text) / 100 : Number.parseFloat(text);
  return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : fallback;
}

function formatAlpha(alpha) {
  const clamped = Math.max(0, Math.min(1, alpha));
  if (clamped === 0 || clamped === 1) return String(clamped);
  return String(Math.round(clamped * 100) / 100);
}

function hslToRgb(h, s, l) {
  const hue = ((((Number(h) || 0) % 360) + 360) % 360) / 360;
  const sat = Math.max(0, Math.min(100, Number(s) || 0)) / 100;
  const light = Math.max(0, Math.min(100, Number(l) || 0)) / 100;
  if (sat === 0) {
    const gray = Math.round(light * 255);
    return { r: gray, g: gray, b: gray };
  }
  const q = light < 0.5 ? light * (1 + sat) : light + sat - light * sat;
  const p = 2 * light - q;
  const channel = (t) => {
    let v = t;
    if (v < 0) v += 1;
    if (v > 1) v -= 1;
    if (v < 1 / 6) return p + (q - p) * 6 * v;
    if (v < 1 / 2) return q;
    if (v < 2 / 3) return p + (q - p) * (2 / 3 - v) * 6;
    return p;
  };
  return {
    r: Math.round(channel(hue + 1 / 3) * 255),
    g: Math.round(channel(hue) * 255),
    b: Math.round(channel(hue - 1 / 3) * 255),
  };
}

function parseCssColor(value, fallback = "#ffffff") {
  const text = String(value || "").trim();
  if (!text) return { hex: fallback, transparency: 0 };
  if (/^transparent$/i.test(text)) return { hex: fallback, transparency: 100 };
  const fromHex = hexToRgb(text);
  if (fromHex) return { hex: rgbToHex(fromHex, fallback), transparency: Math.round((1 - fromHex.a) * 100) };
  const hslMatch = text.match(/^hsla?\(\s*([-\d.]+)(?:deg)?\s*,\s*([\d.]+)%\s*,\s*([\d.]+)%(?:\s*,\s*([\d.]+%?))?\s*\)/i)
    || text.match(/^hsla?\(\s*([-\d.]+)(?:deg)?\s+([\d.]+)%\s+([\d.]+)%(?:\s*\/\s*([\d.]+%?))?\s*\)/i);
  if (hslMatch) {
    const rgb = hslToRgb(Number.parseFloat(hslMatch[1]), Number.parseFloat(hslMatch[2]), Number.parseFloat(hslMatch[3]));
    const alpha = parseAlpha(hslMatch[4], 1);
    return { hex: rgbToHex(rgb, fallback), transparency: Math.round((1 - alpha) * 100) };
  }
  const match = text.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+%?))?\s*\)$/i)
    || text.match(/^rgba?\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+%?))?\s*\)$/i);
  if (!match) return { hex: fallback, transparency: 0 };
  const alpha = parseAlpha(match[4], 1);
  return {
    hex: rgbToHex({ r: Number.parseFloat(match[1]), g: Number.parseFloat(match[2]), b: Number.parseFloat(match[3]) }, fallback),
    transparency: Math.round((1 - alpha) * 100),
  };
}

function colorWithTransparency(hex, transparency, fallback = "#ffffff") {
  const rgb = hexToRgb(hex) || hexToRgb(fallback) || { r: 255, g: 255, b: 255 };
  const alpha = (100 - clampTransparency(transparency)) / 100;
  if (alpha >= 1) return rgbToHex(rgb, fallback);
  return "rgba(" + Math.round(rgb.r) + ", " + Math.round(rgb.g) + ", " + Math.round(rgb.b) + ", " + formatAlpha(alpha) + ")";
}

function renderToolbar(mount) {
  const snapshot = typeof tools().readDocumentBackground === "function"
    ? tools().readDocumentBackground()
    : {};
  const mode = snapshot.mode || "color";
  const parsedColor = parseCssColor(snapshot.color, "#ffffff");
  const color = parsedColor.hex;
  const transparency = Math.round(clampTransparency(parsedColor.transparency));
  const image = snapshot.image || "";

  mount.innerHTML = `<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;font:12px monospace;">
    <label style="display:flex;align-items:center;gap:5px;" title="Document background mode">Background
      <select data-field="mode" style="font:12px monospace;padding:4px 6px;border:1px solid #888;background:#fff;">
        <option value="color"${mode === "color" ? " selected" : ""}>Color</option>
        <option value="image"${mode === "image" ? " selected" : ""}>Picture</option>
      </select>
    </label>
    <label data-section="color" style="display:flex;align-items:center;gap:5px;" title="Document background color">Color
      <input data-field="color" type="color" value="${escapeHtml(color)}" style="width:30px;height:22px;padding:0;border:0;background:transparent;" />
    </label>
    <label data-section="color" style="display:flex;align-items:center;gap:4px;" title="Document background transparency">Trans
      <input data-field="colorTransparency" type="range" min="0" max="100" step="1" value="${transparency}" style="width:78px;" />
      <span data-field="colorTransparencyValue" style="display:inline-block;width:34px;text-align:right;">${transparency}%</span>
    </label>
    <label data-section="image" style="display:flex;align-items:center;gap:5px;" title="Document background picture">Picture
      <input data-field="image" type="text" value="${escapeHtml(image)}" placeholder="Image URL or path" style="width:220px;height:24px;border:1px solid #888;padding:2px 5px;" />
    </label>
    <button type="button" data-action="choosePicture" title="Choose a local picture" style="font:12px monospace;padding:5px 9px;border:1px solid #777;background:#f4f4f4;cursor:pointer;">Choose...</button>
    <label data-section="image" style="display:flex;align-items:center;gap:5px;" title="Picture sizing">Size
      <select data-field="size" style="font:12px monospace;padding:4px 6px;border:1px solid #888;background:#fff;">
        ${["cover", "contain", "auto"].map((value) => `<option value="${value}"${(snapshot.size || "cover") === value ? " selected" : ""}>${value}</option>`).join("")}
      </select>
    </label>
    <button type="button" data-action="apply" title="Apply document background" style="font:12px monospace;padding:5px 9px;border:1px solid #333;background:#eee;cursor:pointer;">Apply</button>
    <button type="button" data-action="clear" title="Clear document background" style="font:12px monospace;padding:5px 9px;border:1px solid #777;background:#f4f4f4;cursor:pointer;">Clear</button>
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

function syncSections(mount) {
  const mode = field(mount, "mode")?.value || "color";
  mount.querySelectorAll('[data-section="color"]').forEach((el) => {
    el.style.display = mode === "color" ? "flex" : "none";
  });
  mount.querySelectorAll('[data-section="image"]').forEach((el) => {
    el.style.display = mode === "image" ? "flex" : "none";
  });
  const choose = mount.querySelector('[data-action="choosePicture"]');
  if (choose) choose.style.display = mode === "image" ? "inline-block" : "none";
}

function syncTransparencyDisplay(mount) {
  const input = field(mount, "colorTransparency");
  const value = field(mount, "colorTransparencyValue");
  if (!input) return;
  const next = Math.round(clampTransparency(input.value));
  input.value = String(next);
  if (value) value.textContent = next + "%";
}

function readControls(mount) {
  const mode = field(mount, "mode")?.value || "color";
  return {
    mode,
    color: colorWithTransparency(field(mount, "color")?.value || "#ffffff", field(mount, "colorTransparency")?.value, "#ffffff"),
    image: field(mount, "image")?.value || "",
    size: field(mount, "size")?.value || "cover",
  };
}

function pickLocalImage() {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.style.position = "fixed";
    input.style.left = "-9999px";
    input.addEventListener("change", () => {
      const file = input.files?.[0] || null;
      input.remove();
      resolve(file);
    }, { once: true });
    document.body.appendChild(input);
    input.click();
  });
}

export function initToolbarWidget(hostElement) {
  if (!hostElement || hostElement.dataset.nvHtmlDocumentStyleToolbarBound === "true") return;
  hostElement.dataset.nvHtmlDocumentStyleToolbarBound = "true";
  const mount = hostElement.querySelector("#nv-html-document-style-toolbar") || hostElement;
  renderToolbar(mount);
  syncSections(mount);
  syncTransparencyDisplay(mount);

  mount.addEventListener("change", (evt) => {
    if (!evt.target?.matches?.("select")) return;
    setStatus(mount, "");
    syncSections(mount);
  });

  mount.addEventListener("input", (evt) => {
    if (!evt.target?.matches?.("input")) return;
    if (evt.target?.dataset?.field === "colorTransparency") syncTransparencyDisplay(mount);
    setStatus(mount, "");
  });

  mount.addEventListener("click", async (evt) => {
    const action = evt.target?.closest?.("[data-action]")?.dataset?.action || "";
    if (!action) return;
    evt.preventDefault();
    setStatus(mount, "");

    try {
      if (action === "choosePicture") {
        const file = await pickLocalImage();
        if (!file) return;
        field(mount, "mode").value = "image";
        field(mount, "image").value = await readFileAsDataUrl(file);
        syncSections(mount);
        setStatus(mount, "Picture selected.");
        return;
      }

      if (typeof tools().applyDocumentBackground !== "function") {
        throw new Error("No active WYSIWYG editor.");
      }

      if (action === "clear") {
        tools().applyDocumentBackground({ mode: "clear" });
        setStatus(mount, "Background cleared.");
        return;
      }

      if (action === "apply") {
        tools().applyDocumentBackground(readControls(mount));
        setStatus(mount, "Document background applied.");
      }
    } catch (err) {
      console.warn("[htmlDocumentStyleToolbar]", err);
      setStatus(mount, err?.message || String(err), true);
    }
  });
}
