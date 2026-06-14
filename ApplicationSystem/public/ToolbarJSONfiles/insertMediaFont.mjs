// Nodevision/ApplicationSystem/public/ToolbarJSONfiles/insertMediaFont.mjs
// Font-specific Insert Media picker used by the HTML/WYSIWYG Styles -> Font subtoolbar.

import {
  dirname,
  escapeHtml,
  getActiveEditorNotebookPath,
  joinNotebookPath,
  normalizeNotebookPath,
} from "./insertMediaCommon.mjs";
import {
  notebookSourceFromPath,
  readFileAsDataUrl,
  saveNotebookBinaryFromDataUrl,
} from "./insertMediaIO.mjs";
import { openInsertMediaPanel } from "./insertMediaPanel.mjs";

export const FONT_EXTENSIONS = [".ttf", ".otf", ".woff", ".woff2"];

const FONT_FORMATS = {
  ".ttf": "truetype",
  ".otf": "opentype",
  ".woff": "woff",
  ".woff2": "woff2",
};

function normalizeExtensions(exts = FONT_EXTENSIONS) {
  return Array.from(new Set((exts || FONT_EXTENSIONS)
    .map((ext) => String(ext || "").trim().toLowerCase())
    .filter(Boolean)
    .map((ext) => ext.startsWith(".") ? ext : `.${ext}`)));
}

function extensionFromPath(value) {
  const cleaned = String(value || "").split(/[?#]/)[0].trim().toLowerCase();
  const match = cleaned.match(/\.[a-z0-9]+$/);
  return match ? match[0] : "";
}

function fontFormatFromPath(value) {
  return FONT_FORMATS[extensionFromPath(value)] || "";
}

function isSafeNotebookPath(path) {
  const normalized = normalizeNotebookPath(path);
  if (!normalized || normalized === "Notebook") return false;
  const parts = normalized.replace(/\\/g, "/").split("/").filter(Boolean);
  if (parts[0] !== "Notebook") return false;
  return !parts.some((part) => part === ".." || part === ".");
}

function requireFontExtension(path, allowedExtensions) {
  const ext = extensionFromPath(path);
  if (ext === ".tff") {
    throw new Error("Use the TrueType extension .ttf, not .tff.");
  }
  if (!allowedExtensions.includes(ext)) {
    throw new Error(`Choose a font file (${allowedExtensions.join(", ")}).`);
  }
  return ext;
}

function sanitizeExternalFontUrl(rawUrl) {
  const value = String(rawUrl || "").trim();
  if (!value) throw new Error("Enter a web font URL.");
  if (/^\/\//.test(value)) throw new Error("Use a full https:// or http:// URL.");
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error("Enter a valid web URL.");
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error("Only http:// and https:// font URLs are supported.");
  }
  return parsed.href;
}

function sanitizeFamilyInput(value) {
  const family = String(value || "").trim();
  if (!family) return "";
  if (/[,;{}<>]/.test(family) || /javascript:/i.test(family) || /<\/?[a-z][\s\S]*>/i.test(family)) {
    throw new Error("Font family contains unsafe characters.");
  }
  return family.replace(/["']/g, "").replace(/\s+/g, " ").slice(0, 90);
}

function inferFamilyFromUrl(url) {
  try {
    const parsed = new URL(url);
    const familyParam = parsed.searchParams.get("family");
    if (!familyParam) return "";
    return familyParam
      .split(":")[0]
      .replace(/\+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  } catch {
    return "";
  }
}

function basenameWithoutExtension(value) {
  const clean = String(value || "").split(/[?#]/)[0].replace(/\\/g, "/");
  const name = clean.split("/").filter(Boolean).pop() || "Font";
  return name.replace(/\.[^.]+$/, "") || "Font";
}

function pickLocalFontFile(accept) {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = accept;
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

function fontMimeForExtension(ext) {
  if (ext === ".ttf") return "font/ttf";
  if (ext === ".otf") return "font/otf";
  if (ext === ".woff") return "font/woff";
  if (ext === ".woff2") return "font/woff2";
  return "application/octet-stream";
}

function fallbackSelectHtml() {
  return ["sans-serif", "serif", "monospace", "cursive", "fantasy"]
    .map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`)
    .join("");
}

export async function openInsertMediaPicker(options = {}) {
  const mediaKind = String(options.mediaKind || "font").toLowerCase();
  if (mediaKind !== "font") throw new Error("insertMediaFont only supports mediaKind: font");

  const panel = await openInsertMediaPanel("Choose Font", "Font");
  return await new Promise((resolve, reject) => {
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      if (panel.panelEl?.parentNode) panel.panelEl.parentNode.removeChild(panel.panelEl);
      resolve(value || null);
    };
    const fail = (err) => {
      if (settled) return;
      settled = true;
      reject(err);
    };
    panel.closeBtn?.addEventListener("click", () => finish(null), { once: true });
    renderFontPicker(panel.mount, options, finish, fail);
  });
}

export function renderFontPicker(root, options = {}, resolve, reject) {
  const allowedExtensions = normalizeExtensions(options.allowedExtensions || FONT_EXTENSIONS);
  const allowNotebookFile = options.allowNotebookFile !== false;
  const allowExternalUrl = options.allowExternalUrl !== false;
  const defaultSource = allowNotebookFile ? "notebook" : "web";
  const accept = allowedExtensions.join(",");
  const activeEditorPath = getActiveEditorNotebookPath();
  const baseDir = dirname(activeEditorPath);
  const defaultUploadDir = joinNotebookPath(baseDir, "Fonts");

  root.innerHTML = `<form style="display:flex;flex-direction:column;gap:10px;font:12px monospace;min-width:300px;max-width:580px;">
    <div style="font-weight:600;">Font Source</div>
    <fieldset style="border:1px solid #c6c6c6;padding:8px;display:flex;gap:14px;flex-wrap:wrap;">
      ${allowNotebookFile ? `<label><input type="radio" name="nv-font-source" value="notebook" ${defaultSource === "notebook" ? "checked" : ""}> Notebook font</label>` : ""}
      ${allowExternalUrl ? `<label><input type="radio" name="nv-font-source" value="web" ${defaultSource === "web" ? "checked" : ""}> Web font</label>` : ""}
    </fieldset>
    <div data-section="notebook" style="display:${defaultSource === "notebook" ? "flex" : "none"};flex-direction:column;gap:8px;">
      <label>Existing Notebook Font Path
        <input data-field="notebookPath" type="text" placeholder="Fonts/MyFont.woff2" style="display:block;width:100%;margin-top:4px;">
      </label>
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
        <button type="button" data-action="pickLocal" style="font:12px monospace;padding:6px 10px;border:1px solid #333;background:#eee;cursor:pointer;">Choose Local Font...</button>
        <span data-field="pickedLocal" style="color:#555;"></span>
      </div>
      <label>Save Uploaded Font In
        <input data-field="uploadDir" type="text" value="${escapeHtml(defaultUploadDir.replace(/^Notebook\/?/i, ""))}" style="display:block;width:100%;margin-top:4px;">
      </label>
      <label>Fallback
        <select data-field="notebookFallback" style="display:block;width:100%;margin-top:4px;">${fallbackSelectHtml()}</select>
      </label>
    </div>
    <div data-section="web" style="display:${defaultSource === "web" ? "flex" : "none"};flex-direction:column;gap:8px;">
      <label>Web Font URL
        <input data-field="webUrl" type="url" placeholder="https://fonts.googleapis.com/css2?family=Libre+Baskerville" style="display:block;width:100%;margin-top:4px;">
      </label>
      <label>Reference Type
        <select data-field="webType" style="display:block;width:100%;margin-top:4px;">
          <option value="auto">Auto detect</option>
          <option value="file">Direct font file</option>
          <option value="stylesheet">Stylesheet link</option>
        </select>
      </label>
      <label>CSS Font Family
        <input data-field="webFamily" type="text" placeholder="Libre Baskerville" style="display:block;width:100%;margin-top:4px;">
      </label>
      <label>Fallback
        <select data-field="webFallback" style="display:block;width:100%;margin-top:4px;">${fallbackSelectHtml()}</select>
      </label>
    </div>
    <div style="display:flex;gap:8px;justify-content:flex-end;">
      <button type="button" data-action="cancel" style="font:12px monospace;padding:6px 10px;border:1px solid #777;background:#f4f4f4;cursor:pointer;">Cancel</button>
      <button type="submit" style="font:12px monospace;padding:6px 10px;border:1px solid #333;background:#eee;cursor:pointer;">Use Font</button>
    </div>
    <div data-field="status" style="font-size:11px;color:#b00;min-height:14px;"></div>
  </form>`;

  const form = root.querySelector("form");
  const sourceRadios = () => Array.from(root.querySelectorAll('input[name="nv-font-source"]'));
  const notebookSection = root.querySelector('[data-section="notebook"]');
  const webSection = root.querySelector('[data-section="web"]');
  const notebookPathEl = root.querySelector('[data-field="notebookPath"]');
  const uploadDirEl = root.querySelector('[data-field="uploadDir"]');
  const pickedLocalEl = root.querySelector('[data-field="pickedLocal"]');
  const webUrlEl = root.querySelector('[data-field="webUrl"]');
  const webTypeEl = root.querySelector('[data-field="webType"]');
  const webFamilyEl = root.querySelector('[data-field="webFamily"]');
  const statusEl = root.querySelector('[data-field="status"]');
  let pickedFile = null;

  const setStatus = (value) => { statusEl.textContent = String(value || ""); };
  const currentSource = () => sourceRadios().find((radio) => radio.checked)?.value || defaultSource;
  const sync = () => {
    const source = currentSource();
    if (notebookSection) notebookSection.style.display = source === "notebook" ? "flex" : "none";
    if (webSection) webSection.style.display = source === "web" ? "flex" : "none";
  };

  sourceRadios().forEach((radio) => radio.addEventListener("change", sync));
  root.querySelector('[data-action="cancel"]')?.addEventListener("click", () => resolve?.(null));
  root.querySelector('[data-action="pickLocal"]')?.addEventListener("click", async () => {
    setStatus("");
    try {
      const file = await pickLocalFontFile(accept);
      if (!file) return;
      requireFontExtension(file.name, allowedExtensions);
      pickedFile = file;
      pickedLocalEl.textContent = file.name;
      if (!notebookPathEl.value.trim()) notebookPathEl.value = file.name;
    } catch (err) {
      pickedFile = null;
      pickedLocalEl.textContent = "";
      setStatus(err?.message || String(err));
    }
  });

  webUrlEl?.addEventListener("input", () => {
    const inferred = inferFamilyFromUrl(webUrlEl.value);
    if (inferred && !webFamilyEl.value.trim()) webFamilyEl.value = inferred;
  });

  form.addEventListener("submit", async (evt) => {
    evt.preventDefault();
    setStatus("");
    try {
      if (currentSource() === "notebook") {
        let notebookPath = normalizeNotebookPath(notebookPathEl.value || pickedFile?.name || "");
        if (pickedFile) {
          requireFontExtension(pickedFile.name, allowedExtensions);
          const uploadDir = normalizeNotebookPath(uploadDirEl.value || defaultUploadDir);
          if (!isSafeNotebookPath(uploadDir)) throw new Error("Choose a safe Notebook folder for the uploaded font.");
          const safeName = pickedFile.name.replace(/[\\/]+/g, "-");
          notebookPath = joinNotebookPath(uploadDir, safeName);
          const dataUrl = await readFileAsDataUrl(pickedFile);
          await saveNotebookBinaryFromDataUrl(notebookPath, dataUrl, fontMimeForExtension(extensionFromPath(safeName)));
        }
        if (!isSafeNotebookPath(notebookPath)) throw new Error("Choose a font inside the Notebook.");
        const ext = requireFontExtension(notebookPath, allowedExtensions);
        resolve?.({
          kind: "notebook-font",
          notebookPath,
          src: notebookSourceFromPath(notebookPath, activeEditorPath),
          sourceName: basenameWithoutExtension(notebookPath),
          format: FONT_FORMATS[ext],
          fallback: root.querySelector('[data-field="notebookFallback"]')?.value || "sans-serif",
        });
        return;
      }

      const href = sanitizeExternalFontUrl(webUrlEl.value);
      const selectedType = String(webTypeEl.value || "auto");
      const ext = extensionFromPath(href);
      const isDirectFont = selectedType === "file" || (selectedType === "auto" && allowedExtensions.includes(ext));
      const family = sanitizeFamilyInput(webFamilyEl.value || inferFamilyFromUrl(href) || basenameWithoutExtension(href));
      if (!family) throw new Error("Enter the CSS font-family name for this web font.");
      const fallback = root.querySelector('[data-field="webFallback"]')?.value || "sans-serif";

      if (isDirectFont) {
        requireFontExtension(href, allowedExtensions);
        resolve?.({
          kind: "web-font-file",
          url: href,
          src: href,
          sourceName: basenameWithoutExtension(href),
          fontFamily: family,
          format: fontFormatFromPath(href),
          fallback,
        });
        return;
      }

      resolve?.({
        kind: "web-font-stylesheet",
        href,
        fontFamily: family,
        fallback,
      });
    } catch (err) {
      console.warn("[insertMediaFont]", err);
      setStatus(err?.message || String(err));
    }
  });

  sync();
}
