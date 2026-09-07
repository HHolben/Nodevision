// Nodevision/ApplicationSystem/public/ToolbarJSONfiles/insertMediaImage.mjs
// Insert -> Media image picker shared by graphical editors that can place images.
import {
  dirname,
  escapeHtml,
  getActiveEditorNotebookPath,
  insertHtmlAtCaret,
  joinNotebookPath,
  normalizeNotebookPath,
  notebookHrefFromPath,
  notebookPathFromPickedFile,
} from "./insertMediaCommon.mjs";
import {
  fetchUrlAsDataUrl,
  looksLikeUrlOrAbsPath,
  notebookSourceFromPath,
  readFileAsDataUrl,
  saveNotebookBinaryFromDataUrl,
} from "./insertMediaIO.mjs";
import { attachFallbackReferenceList } from "./referenceFallbackRows.mjs";
import { getInsertMediaOriginContext, openInsertMediaPanel, resolveSvgEditorContextForInsertMedia } from "./insertMediaPanel.mjs";
import {
  attachInsertMediaBrowseWebHandler,
  captureNamedInsertMediaState,
  populateExistingSourceFromResource,
  restoreNamedInsertMediaState,
  setRadioValue,
} from "./insertMediaExternalSource.mjs";
import {
  normalizeFallbackReferencesForSource,
  serializeFallbackAttributes
} from "../utils/referenceFallbacks.mjs";
import { createResourceReference, RESOURCE_SOURCE_KINDS } from "/Resources/ResourceReference.mjs";

const IMAGE_EXTS = ["png", "svg", "jpg", "jpeg", "gif", "webp", "bmp"];

function sanitizeName(name = "") {
  return String(name || "").trim().replace(/[^\w.\-]+/g, "_").replace(/^_+|_+$/g, "") || `image-${Date.now()}.png`;
}

function ensureExt(name = "", ext = "png") {
  const clean = sanitizeName(name || `image-${Date.now()}.${ext}`);
  if (/\.[a-z0-9]+$/i.test(clean)) return clean;
  return `${clean}.${ext}`;
}

function mimeFromExt(ext = "png") {
  const clean = String(ext || "").toLowerCase();
  if (clean === "svg") return "image/svg+xml";
  if (clean === "jpg" || clean === "jpeg") return "image/jpeg";
  if (clean === "gif") return "image/gif";
  if (clean === "webp") return "image/webp";
  if (clean === "bmp") return "image/bmp";
  return "image/png";
}

function utf8ToBase64(value = "") {
  const bytes = new TextEncoder().encode(String(value));
  let binary = "";
  bytes.forEach((b) => { binary += String.fromCharCode(b); });
  return btoa(binary);
}

function blankImageDataUrl(ext = "png", width = 512, height = 512) {
  const format = String(ext || "png").toLowerCase() === "svg" ? "svg" : "png";
  if (format === "svg") {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"></svg>`;
    return `data:image/svg+xml;base64,${utf8ToBase64(svg)}`;
  }
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas.toDataURL("image/png");
}

function clampDimension(value, fallback = 512) {
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(4096, Math.max(1, n));
}

function selectedValue(root, name) {
  return Array.from(root.querySelectorAll(`input[name="${name}"]`)).find((el) => el.checked)?.value || "";
}

function refreshLinkedManagers(linkedPath = "") {
  if (!linkedPath) return;
  try {
    const dir = dirname(linkedPath);
    if (typeof window.refreshFileManager === "function") window.refreshFileManager(dir);
    document.dispatchEvent(new CustomEvent("refreshFileManager", { detail: { path: dir } }));
    if (typeof window.refreshGraphManager === "function") window.refreshGraphManager({ fit: false, reason: "insert-media-image" });
    document.dispatchEvent(new CustomEvent("refreshGraphManager", { detail: { path: dir, reason: "insert-media-image" } }));
  } catch (err) {
    console.warn("[insertMediaImage] refresh failed:", err);
  }
}

function resourceFromInsertion({ src = "", linkedNotebookPath = "", sourceName = "", fallbacks = [], editorPath = "" } = {}) {
  const source = String(src || "").trim();
  const linked = normalizeNotebookPath(linkedNotebookPath);
  const inline = source.startsWith("data:");
  return createResourceReference({
    resourceType: "image",
    sourceKind: inline ? RESOURCE_SOURCE_KINDS.INLINE : (linked ? RESOURCE_SOURCE_KINDS.NOTEBOOK : (looksLikeUrlOrAbsPath(source) ? RESOURCE_SOURCE_KINDS.URL : RESOURCE_SOURCE_KINDS.UNKNOWN)),
    sourcePath: editorPath,
    sourceName,
    src: source,
    notebookPath: linked,
    inlineDataUrl: inline ? source : "",
    fallbacks,
    metadata: { title: sourceName || linked || source, license: "unknown" },
  });
}

function renderImageForm(root, onInsert, { svgMode = false, exts = [], initialState = null, initialResource = null, originContext = null } = {}) {
  const extensions = Array.from(new Set([...(exts || []), ...IMAGE_EXTS]))
    .map((e) => String(e).toLowerCase())
    .filter(Boolean);
  const optionHtml = extensions
    .map((ext) => `<option value="${escapeHtml(ext)}"${ext === "png" ? " selected" : ""}>${escapeHtml(ext.toUpperCase())}</option>`)
    .join("");

  root.innerHTML = `<form style="display:flex;flex-direction:column;gap:10px;font:12px monospace;min-width:280px;max-width:540px;">
    <fieldset style="border:1px solid #c6c6c6;padding:8px;">
      <legend>Image Source</legend>
      <label style="display:block;margin-bottom:6px;"><input type="radio" name="nv-image-source" value="new" checked> New Image</label>
      <label style="display:block;"><input type="radio" name="nv-image-source" value="existing"> Existing Image</label>
    </fieldset>
    <fieldset style="border:1px solid #c6c6c6;padding:8px;">
      <legend>Storage Mode</legend>
      <label style="display:block;margin-bottom:6px;"><input type="radio" name="nv-image-storage" value="referenced" checked> Referenced (src points to file path)</label>
      <label style="display:block;"><input type="radio" name="nv-image-storage" value="inline"> Inline (embed as data URL)</label>
    </fieldset>
    <div data-section="new" style="display:flex;flex-direction:column;gap:8px;">
      <label>New Image Format<select data-field="format" style="display:block;width:100%;margin-top:4px;">${optionHtml}</select></label>
      <label data-section="new-name">New Image File Name<input data-field="newName" type="text" style="display:block;width:100%;margin-top:4px;" /></label>
      <div style="display:flex;gap:8px;align-items:flex-end;">
        <label style="flex:1;">Width (px)<input data-field="width" type="number" min="1" max="4096" value="512" style="display:block;width:100%;margin-top:4px;" /></label>
        <label style="flex:1;">Height (px)<input data-field="height" type="number" min="1" max="4096" value="512" style="display:block;width:100%;margin-top:4px;" /></label>
      </div>
      <div data-field="targetHint" style="font-size:11px;color:#4b4b4b;"></div>
    </div>
    <div data-section="existing" style="display:none;flex-direction:column;gap:8px;">
      <div style="display:flex;gap:8px;align-items:flex-end;">
        <label style="flex:1;">Existing Source (Notebook path or URL)<input data-field="existingSource" type="text" placeholder="images/example.png or https://..." style="display:block;width:100%;margin-top:4px;" /></label>
        <button type="button" data-action="choose-existing" style="font:12px monospace;padding:6px 10px;border:1px solid #333;background:#eee;cursor:pointer;">Choose File...</button>
        <button type="button" data-action="browse-web-resource" style="font:12px monospace;padding:6px 10px;border:1px solid #333;background:#eee;cursor:pointer;">Browse Web...</button>
      </div>
      <div data-field="existingFileStatus" style="font-size:11px;color:#4b4b4b;">No local file selected.</div>
    </div>
    <div data-field="fallbackHost"></div>
    <div style="display:flex;gap:10px;justify-content:flex-end;"><button type="submit" style="font:12px monospace;padding:6px 10px;border:1px solid #333;background:#eee;cursor:pointer;">Insert</button></div>
    <div data-field="status" style="font-size:11px;color:#b00;min-height:14px;"></div>
  </form>`;

  const form = root.querySelector("form");
  const newSection = root.querySelector('[data-section="new"]');
  const existingSection = root.querySelector('[data-section="existing"]');
  const newNameRow = root.querySelector('[data-section="new-name"]');
  const formatEl = root.querySelector('[data-field="format"]');
  const newNameEl = root.querySelector('[data-field="newName"]');
  const widthEl = root.querySelector('[data-field="width"]');
  const heightEl = root.querySelector('[data-field="height"]');
  const targetHintEl = root.querySelector('[data-field="targetHint"]');
  const existingSourceEl = root.querySelector('[data-field="existingSource"]');
  const existingFileStatusEl = root.querySelector('[data-field="existingFileStatus"]');
  const statusEl = root.querySelector('[data-field="status"]');
  const fallbackList = attachFallbackReferenceList({
    container: root.querySelector("[data-field=\"fallbackHost\"]"),
    primaryInput: existingSourceEl
  });
  const stateConfig = () => ({
    radios: { sourceMode: "nv-image-source", storageMode: "nv-image-storage" },
    fields: {
      format: '[data-field="format"]',
      newName: '[data-field="newName"]',
      width: '[data-field="width"]',
      height: '[data-field="height"]',
      existingSource: '[data-field="existingSource"]',
    },
    fallbackList,
  });
  const hiddenExisting = document.createElement("input");
  hiddenExisting.type = "file";
  hiddenExisting.accept = "image/*";
  hiddenExisting.style.display = "none";
  form.appendChild(hiddenExisting);

  let existingFile = { dataUrl: "", name: "", notebookPath: "", sourceValue: "" };
  let existingFilePending = null;
  const setStatus = (message) => { statusEl.textContent = String(message || ""); };
  const formOriginContext = originContext || getInsertMediaOriginContext(root) || null;
  const originEditorNotebookPath = normalizeNotebookPath(formOriginContext?.originEditorPath || "");
  const editorPath = () => originEditorNotebookPath || getActiveEditorNotebookPath();
  const sourceForNotebook = (path) => svgMode ? notebookHrefFromPath(path) : notebookSourceFromPath(path, editorPath());

  const updateExistingStatus = () => {
    if (existingFilePending) {
      existingFileStatusEl.textContent = `Loading: ${existingFile.name || "..."}`;
      return;
    }
    if (!existingFile.dataUrl) {
      existingFileStatusEl.textContent = "No local file selected.";
      return;
    }
    existingFileStatusEl.textContent = existingFile.notebookPath
      ? `Selected Notebook file: ${existingFile.notebookPath}`
      : `Selected local file: ${existingFile.name}`;
  };

  const updateHint = () => {
    const sourceMode = selectedValue(root, "nv-image-source");
    const storageMode = selectedValue(root, "nv-image-storage");
    newSection.style.display = sourceMode === "new" ? "flex" : "none";
    existingSection.style.display = sourceMode === "existing" ? "flex" : "none";
    newNameRow.style.display = sourceMode === "new" && storageMode === "referenced" ? "block" : "none";
    if (sourceMode !== "new" || storageMode !== "referenced") {
      targetHintEl.textContent = "";
      return;
    }
    const baseDir = dirname(editorPath());
    const filename = ensureExt(newNameEl.value, formatEl.value || "png");
    targetHintEl.textContent = `Will save to: ${normalizeNotebookPath(joinNotebookPath(baseDir, filename))}`;
  };

  const syncDefaultName = () => {
    const ext = String(formatEl.value || "png").toLowerCase();
    const current = String(newNameEl.value || "").trim();
    newNameEl.value = current ? ensureExt(current.replace(/\.[^.]+$/, ""), ext) : `image-${Date.now()}.${ext}`;
    updateHint();
  };

  root.querySelectorAll('input[name="nv-image-source"],input[name="nv-image-storage"]').forEach((el) => el.addEventListener("change", updateHint));
  formatEl.addEventListener("change", syncDefaultName);
  newNameEl.addEventListener("input", updateHint);
  syncDefaultName();
  updateExistingStatus();
  if (initialState) restoreNamedInsertMediaState(root, initialState, stateConfig());
  if (initialResource) {
    setRadioValue(root, "nv-image-source", "existing");
    populateExistingSourceFromResource(root, initialResource, {
      sourceSelector: '[data-field="existingSource"]',
      fallbackList,
    });
    existingFile = { dataUrl: "", name: "", notebookPath: "", sourceValue: "" };
    delete existingSourceEl.dataset.localFile;
    existingFilePending = null;
    updateExistingStatus();
    updateHint();
  }

  root.querySelector('[data-action="choose-existing"]').addEventListener("click", () => hiddenExisting.click());
  attachInsertMediaBrowseWebHandler(root.querySelector('[data-action="browse-web-resource"]'), () => {
    const insertMediaState = captureNamedInsertMediaState(root, stateConfig());
    return {
      root,
      resourceType: "image",
      mediaFamily: "Image",
      sourceMode: "existing",
      originContext: formOriginContext,
      originEditorPath: formOriginContext?.originEditorPath || editorPath(),
      targetMode: formOriginContext?.targetMode || window.NodevisionState?.currentMode || "",
      insertMediaState,
      onStatus: (message) => setStatus(message),
      reopenInsertMedia: async ({ invocation, resource }) => {
        const returnOriginContext = invocation.insertMediaOriginContext || formOriginContext;
        const panel = await openInsertMediaPanel("Insert Image", "Image", { originContext: returnOriginContext });
        renderImageForm(panel.mount, onInsert, {
          svgMode,
          exts,
          initialState: invocation.insertMediaState,
          initialResource: resource,
          originContext: panel.originContext || returnOriginContext,
        });
      },
    };
  }, { setStatus });
  hiddenExisting.addEventListener("change", async () => {
    const file = hiddenExisting.files?.[0] || null;
    hiddenExisting.value = "";
    if (!file) return;

    const name = file.name || "image.png";
    const notebookPath = notebookPathFromPickedFile(file);
    const fallbackPath = normalizeNotebookPath(joinNotebookPath(dirname(editorPath()), sanitizeName(name)));
    const sourceValue = notebookPath || fallbackPath;
    existingFile = { dataUrl: "", name, notebookPath, sourceValue };
    existingSourceEl.value = sourceValue;
    existingSourceEl.dataset.localFile = "true";
    existingFilePending = readFileAsDataUrl(file);
    updateExistingStatus();
    try {
      existingFile = { dataUrl: await existingFilePending, name, notebookPath, sourceValue };
    } catch (err) {
      existingFile = { dataUrl: "", name: "", notebookPath: "", sourceValue: "" };
      delete existingSourceEl.dataset.localFile;
      setStatus(err?.message || String(err));
    } finally {
      existingFilePending = null;
      updateExistingStatus();
    }
  });

  existingSourceEl.addEventListener("input", () => {
    if (existingSourceEl.dataset.localFile !== "true") return;
    const entered = String(existingSourceEl.value || "").trim();
    const notebookish = entered.replace(/^\/+/, "").toLowerCase().startsWith("notebook/");
    if (entered && looksLikeUrlOrAbsPath(entered) && !notebookish) {
      existingFile = { dataUrl: "", name: "", notebookPath: "", sourceValue: "" };
      delete existingSourceEl.dataset.localFile;
      existingFilePending = null;
      updateExistingStatus();
    }
  });

  form.addEventListener("submit", async (evt) => {
    evt.preventDefault();
    setStatus("");
    try {
      const sourceMode = selectedValue(root, "nv-image-source");
      const storageMode = selectedValue(root, "nv-image-storage");
      const baseDir = dirname(editorPath());
      let src = "";
      let linkedNotebookPath = "";
      let sourceName = "";

      if (sourceMode === "new") {
        const ext = String(formatEl.value || "png").toLowerCase();
        sourceName = ensureExt(newNameEl.value, ext);
        const dataUrl = blankImageDataUrl(ext, clampDimension(widthEl.value), clampDimension(heightEl.value));
        if (storageMode === "inline") {
          src = dataUrl;
        } else {
          linkedNotebookPath = normalizeNotebookPath(joinNotebookPath(baseDir, sourceName));
          await saveNotebookBinaryFromDataUrl(linkedNotebookPath, dataUrl, mimeFromExt(ext));
          src = sourceForNotebook(linkedNotebookPath);
        }
      } else {
        const entered = String(existingSourceEl.value || "").trim();
        if (existingFilePending) await existingFilePending.catch(() => null);
        const localSelected = Boolean(existingFile.dataUrl && existingSourceEl.dataset.localFile === "true");
        if (!entered && !localSelected) throw new Error("Enter an existing image source or choose a local file.");
        sourceName = existingFile.name || entered.split("/").pop() || "image.png";

        if (storageMode === "inline") {
          if (localSelected) {
            src = existingFile.dataUrl;
          } else {
            const url = looksLikeUrlOrAbsPath(entered) ? entered : notebookHrefFromPath(normalizeNotebookPath(entered));
            src = await fetchUrlAsDataUrl(url);
          }
        } else if (localSelected) {
          if (looksLikeUrlOrAbsPath(entered) && !entered.replace(/^\/+/, "").toLowerCase().startsWith("notebook/")) {
            throw new Error("For referenced local files, enter a Notebook destination path.");
          }
          const selectedPath = normalizeNotebookPath(existingFile.notebookPath);
          const enteredPath = normalizeNotebookPath(entered);
          const selectedWasKept = selectedPath && enteredPath.toLowerCase() === selectedPath.toLowerCase();
          linkedNotebookPath = selectedWasKept
            ? selectedPath
            : (enteredPath || normalizeNotebookPath(joinNotebookPath(baseDir, sanitizeName(existingFile.name || "image.png"))));
          if (!selectedWasKept) {
            await saveNotebookBinaryFromDataUrl(linkedNotebookPath, existingFile.dataUrl, mimeFromExt(linkedNotebookPath.split(".").pop()));
          }
          src = sourceForNotebook(linkedNotebookPath);
        } else if (looksLikeUrlOrAbsPath(entered)) {
          src = entered;
        } else {
          linkedNotebookPath = normalizeNotebookPath(entered);
          src = sourceForNotebook(linkedNotebookPath);
        }
      }

      const fallbacks = normalizeFallbackReferencesForSource(fallbackList.getFallbacks(), {
        sourcePath: editorPath(),
        primary: src
      });
      const resource = resourceFromInsertion({ src, linkedNotebookPath, sourceName, fallbacks, editorPath: editorPath() });
      const inserted = await onInsert({
        src,
        linkedNotebookPath,
        sourceName,
        mode: storageMode + "-" + sourceMode,
        fallbacks,
        resource
      });
      if (inserted === false || inserted == null) throw new Error("Image insertion failed.");
      refreshLinkedManagers(linkedNotebookPath);
      setStatus("Inserted.");
    } catch (err) {
      console.warn("[insertMediaImage]", err);
      setStatus(err?.message || String(err));
    }
  });
}

function isSvgInsertOrigin(originContext = null) {
  const context = originContext || {};
  const mode = String(context.targetMode || window.NodevisionState?.currentMode || "").toLowerCase();
  const panelType = String(context.originPanelType || "").toLowerCase();
  const editorPath = String(context.originEditorPath || window.__nvSvgEditorActivePath || "").toLowerCase();
  return mode.includes("svg") || panelType.includes("svg") || (panelType.includes("graphical") && editorPath.endsWith(".svg"));
}

async function insertImageIntoOriginatingSvg(insertion = {}, originContext = null) {
  const src = String(insertion.src || insertion.resource?.src || "").trim();
  if (!src) throw new Error("Image source invalid: no image source was provided.");
  const resolved = resolveSvgEditorContextForInsertMedia(originContext || {});
  if (!resolved.ok) {
    console.warn("[insertMediaImage] SVG origin resolution failed", resolved.diagnostic || {}, resolved.code || "unknown");
    throw new Error(resolved.message || "SVG image insertion was unavailable for the originating editor.");
  }
  const api = resolved.context;
  if (typeof api?.insertImageFromInsertion !== "function") {
    console.warn("[insertMediaImage] SVG insertion API unavailable", resolved.diagnostic || {});
    throw new Error("SVG insertion API unavailable for the originating editor.");
  }
  const inserted = await api.insertImageFromInsertion(insertion);
  if (!inserted) {
    console.warn("[insertMediaImage] SVG element insertion failed", resolved.diagnostic || {});
    throw new Error("SVG element insertion failed.");
  }
  return inserted;
}

export function renderImage(root, exts = [], renderOptions = {}) {
  const originContext = renderOptions.originContext || getInsertMediaOriginContext(root) || null;
  if (isSvgInsertOrigin(originContext)) {
    renderImageForm(root, async (insertion) => {
      return await insertImageIntoOriginatingSvg(insertion, originContext);
    }, { svgMode: true, exts, originContext });
    return;
  }

  renderImageForm(root, async (insertion) => {
    const resource = insertion.resource || {};
    const src = resource.src || insertion.src || "";
    const linkedPath = resource.notebookPath || insertion.linkedNotebookPath || "";
    const fallbacks = resource.fallbacks || insertion.fallbacks || [];
    const linkedAttr = linkedPath ? " data-nv-linked-path=\"" + escapeHtml(linkedPath) + "\"" : "";
    const fallbackAttrs = serializeFallbackAttributes(fallbacks, { primary: src });
    const html = "<img src=\"" + escapeHtml(src) + "\"" + linkedAttr + fallbackAttrs + " alt=\"Inserted image\">";
    return insertHtmlAtCaret(html);
  }, { svgMode: false, exts, originContext });
}
