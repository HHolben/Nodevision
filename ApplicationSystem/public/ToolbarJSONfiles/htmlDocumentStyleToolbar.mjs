// Nodevision/ApplicationSystem/public/ToolbarJSONfiles/htmlDocumentStyleToolbar.mjs
// Styles -> Document subtoolbar for whole-document HTML/WYSIWYG backgrounds.

import { escapeHtml } from "./insertMediaCommon.mjs";
import { readFileAsDataUrl } from "./insertMediaIO.mjs";

function tools() {
  return window.HTMLWysiwygTools || {};
}


function rgbaToHex(value, fallback = "#ffffff") {
  const text = String(value || "").trim();
  if (/^#[0-9a-fA-F]{6}$/.test(text)) return text;
  const match = text.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?/i);
  if (!match) return fallback;
  if (match[4] !== undefined && Number(match[4]) <= 0) return fallback;
  const toHex = (part) => Math.max(0, Math.min(255, Number(part) || 0)).toString(16).padStart(2, "0");
  return `#${toHex(match[1])}${toHex(match[2])}${toHex(match[3])}`;
}

function renderToolbar(mount) {
  const snapshot = typeof tools().readDocumentBackground === "function"
    ? tools().readDocumentBackground()
    : {};
  const mode = snapshot.mode || "color";
  const color = rgbaToHex(snapshot.color, "#ffffff");
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

function readControls(mount) {
  const mode = field(mount, "mode")?.value || "color";
  return {
    mode,
    color: field(mount, "color")?.value || "#ffffff",
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

  mount.addEventListener("change", (evt) => {
    if (!evt.target?.matches?.("select")) return;
    setStatus(mount, "");
    syncSections(mount);
  });

  mount.addEventListener("input", (evt) => {
    if (!evt.target?.matches?.("input")) return;
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
