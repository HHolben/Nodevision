// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/GameViewDependencies/embeddedResourceEditor.mjs
// Hosts a linked Notebook resource editor inside the virtual world editor.

import { updateToolbarState } from "/panels/createToolbar.mjs";

const GRAPHICAL_EDITORS_BASE = "/PanelInstances/EditorPanels/GraphicalEditors";
const RASTER_IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "gif", "webp", "bmp", "ico"]);
const SVG_IMAGE_EXTENSIONS = new Set(["svg"]);
const MODEL_EXTENSIONS = new Set(["stl", "obj", "scad"]);
const AUDIO_EXTENSIONS = new Set(["aiff", "flac", "mid", "midi", "mp3", "ogg", "opus", "wav", "m4a"]);
const IFRAME_HOST_PAGE_SOURCE = "nodevision://host-page";
const IFRAME_HOST_PAGE_KIND = "host-page";

const WINDOW_HOOKS = [
  "selectedFilePath",
  "currentActiveFilePath",
  "selectedFile",
  "filePath",
  "getEditorHTML",
  "setEditorHTML",
  "getEditorMarkdown",
  "saveMDFile",
  "saveWYSIWYGFile",
  "selectSVGElement",
  "toggleSVGElementSelection",
  "SVGEditorContext",
  "toggleSVGLayersPanel",
  "rasterCanvas",
  "__nvRasterEditorApi",
  "__nvPngEditorApi",
  "STLEditorContext",
  "GraphicalScadEditorContext",
  "NodevisionModelExportContext",
];

let moduleMapCache = null;

function normalizeNotebookPath(rawPath = "") {
  let clean = String(rawPath || "").trim();
  if (!clean || clean.startsWith("#")) return "";
  if (/^(data|blob|javascript):/i.test(clean)) return "";

  try {
    const parsed = new URL(clean, window.location.origin);
    if (parsed.origin !== window.location.origin) return "";
    clean = parsed.pathname || clean;
  } catch {
    if (/^https?:\/\//i.test(clean)) return "";
  }

  clean = clean
    .replace(/\\/g, "/")
    .replace(/[?#].*$/, "")
    .replace(/^\/+/, "")
    .replace(/^.*\/Notebook\//i, "")
    .replace(/^Notebook\/+/i, "")
    .replace(/^\.\/+/, "");

  const parts = clean.split("/").filter(Boolean);
  if (!parts.length || parts.some((part) => part === "." || part === "..")) return "";
  return parts.join("/");
}

function pathExtension(path = "") {
  const clean = normalizeNotebookPath(path).toLowerCase();
  if (clean.endsWith(".tar.gz")) return "tar.gz";
  if (clean.endsWith(".nvcircuit.json")) return "nvcircuit.json";
  if (clean.endsWith(".td.json")) return "td.json";
  if (clean.endsWith(".terrain.json")) return "terrain.json";
  const last = clean.split("/").pop() || "";
  const idx = last.lastIndexOf(".");
  return idx === -1 ? "" : last.slice(idx + 1).replace(/[^a-z0-9_+-]/g, "");
}

function fileLabel(path = "") {
  return normalizeNotebookPath(path).split("/").pop() || "Linked Resource";
}

function resourceKindForPath(path = "", fallback = "resource") {
  const ext = pathExtension(path);
  if (MODEL_EXTENSIONS.has(ext)) return "model";
  if (AUDIO_EXTENSIONS.has(ext)) return "sound";
  if (RASTER_IMAGE_EXTENSIONS.has(ext) || SVG_IMAGE_EXTENSIONS.has(ext)) return "image";
  if (ext === "html" || ext === "htm" || ext === "xhtml") return "world";
  return fallback || "resource";
}

function candidateResource(path, kind, source) {
  const normalized = normalizeNotebookPath(path);
  if (!normalized) return null;
  const resolvedKind = resourceKindForPath(normalized, kind);
  return {
    path: normalized,
    kind: resolvedKind,
    source,
    label: fileLabel(normalized),
  };
}

export function resolveLinkedWorldResource(target) {
  const data = target?.userData || {};
  const sound = data.soundObject && typeof data.soundObject === "object" ? data.soundObject : {};
  const iframe = data.iframeObject && typeof data.iframeObject === "object" ? data.iframeObject : {};
  const iframeSrc = data.iframeSrc || iframe.iframeSrc || iframe.src;
  const iframeSourceKind = String(data.iframeSourceKind || iframe.iframeSourceKind || iframe.sourceKind || "").trim().toLowerCase();
  const iframeResource = iframeSourceKind === IFRAME_HOST_PAGE_KIND || String(iframeSrc || "").trim().toLowerCase() === IFRAME_HOST_PAGE_SOURCE
    ? null
    : candidateResource(iframeSrc, "world", "iframe");
  return candidateResource(data.objectFilePath || data.objectFileNormalizedPath, "model", "objectFile")
    || candidateResource(data.imageFilePath, "image", "imageFile")
    || candidateResource(
      data.soundLinkedPath || data.soundFile || sound.audioLinkedPath || sound.audioFile || data.audioAssetPath || data.soundSource || sound.src,
      "sound",
      "soundObject"
    )
    || iframeResource
    || candidateResource(data.consoleProperties?.objectFile, "model", "consoleObjectFile")
    || candidateResource(data.portalTarget, "world", "portalTarget");
}

async function loadModuleMap() {
  if (moduleMapCache && Object.keys(moduleMapCache).length > 0) return moduleMapCache;
  try {
    const res = await fetch("/PanelInstances/ModuleMap.csv", { cache: "no-store" });
    if (!res.ok) return {};
    const text = await res.text();
    const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    const header = lines.shift()?.split(",").map((value) => value.trim()) || [];
    const extIndex = header.indexOf("Extension");
    const familyIndex = header.indexOf("Family");
    const editorIndex = header.indexOf("GraphicalEditorModule");
    if (extIndex < 0 || editorIndex < 0) return {};
    const map = {};
    lines.forEach((line) => {
      const cols = line.split(",").map((value) => value.trim());
      const ext = String(cols[extIndex] || "").toLowerCase();
      map[ext] = {
        family: familyIndex >= 0 ? cols[familyIndex] || null : null,
        editor: cols[editorIndex] || null,
      };
    });
    moduleMapCache = map;
    return map;
  } catch (err) {
    console.warn("Virtual world embedded resource editor: failed to load ModuleMap.csv", err);
    return {};
  }
}

async function resolveEditorDescriptor(path) {
  const moduleMap = await loadModuleMap();
  const ext = pathExtension(path);
  const entry = moduleMap[ext] || moduleMap[""] || {};
  const editorFile = entry.editor || "EditorFallback.mjs";
  if (!/^[\w.-]+\.mjs$/.test(editorFile)) {
    return { modulePath: `${GRAPHICAL_EDITORS_BASE}/EditorFallback.mjs`, ext, family: entry.family || null };
  }
  return { modulePath: `${GRAPHICAL_EDITORS_BASE}/${editorFile}`, ext, family: entry.family || null };
}

function parseDataUrl(value = "") {
  const match = /^data:([^;,]+)?;base64,(.*)$/i.exec(String(value || ""));
  if (!match) return null;
  return {
    mimeType: match[1] || "application/octet-stream",
    base64: match[2] || "",
  };
}

async function saveNotebookBinaryFromDataUrl(path, dataUrl) {
  const normalized = normalizeNotebookPath(path);
  const parsed = parseDataUrl(dataUrl);
  if (!normalized || !parsed) throw new Error("Invalid binary save request.");
  const res = await fetch("/api/save", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      path: normalized,
      content: parsed.base64,
      encoding: "base64",
      mimeType: parsed.mimeType,
    }),
  });
  const payload = await res.json().catch(() => null);
  if (!res.ok || !payload?.success) throw new Error(payload?.error || `${res.status} ${res.statusText}`);
  return normalized;
}

async function saveNotebookText(path, content, mimeType = "text/plain") {
  const normalized = normalizeNotebookPath(path);
  if (!normalized) throw new Error("Invalid text save request.");
  const res = await fetch("/api/save", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      path: normalized,
      content: String(content || ""),
      encoding: "utf8",
      mimeType,
    }),
  });
  const payload = await res.json().catch(() => null);
  if (!res.ok || !payload?.success) throw new Error(payload?.error || `${res.status} ${res.statusText}`);
  return normalized;
}

function captureEditorGlobals() {
  const hooks = {};
  WINDOW_HOOKS.forEach((key) => {
    hooks[key] = {
      existed: Object.prototype.hasOwnProperty.call(window, key) || key in window,
      value: window[key],
    };
  });
  return {
    hooks,
    nodevisionState: { ...(window.NodevisionState || {}) },
  };
}

function restoreEditorGlobals(snapshot, resource = null) {
  if (!snapshot) return;
  Object.entries(snapshot.hooks || {}).forEach(([key, entry]) => {
    if (entry?.existed) {
      window[key] = entry.value;
    } else {
      try {
        delete window[key];
      } catch {
        window[key] = undefined;
      }
    }
  });

  window.NodevisionState = window.NodevisionState || {};
  Object.assign(window.NodevisionState, snapshot.nodevisionState || {});
  window.NodevisionState.virtualWorldResourceSelected = Boolean(resource);
  window.NodevisionState.activeVirtualWorldLinkedResource = resource || null;
  updateToolbarState({
    ...(snapshot.nodevisionState || {}),
    virtualWorldResourceSelected: Boolean(resource),
    activeVirtualWorldLinkedResource: resource || null,
  });
}

function createButton(label, onClick) {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  button.addEventListener("click", onClick);
  return button;
}

function ensurePanelPosition(panel) {
  const current = window.getComputedStyle(panel).position;
  if (!current || current === "static") panel.style.position = "relative";
}

function createFrame(resource, handlers) {
  const frame = document.createElement("div");
  frame.className = "nv-vw-embedded-resource-editor";
  Object.assign(frame.style, {
    position: "absolute",
    top: "12px",
    right: "12px",
    bottom: "12px",
    width: "min(780px, 64%)",
    minWidth: "320px",
    maxWidth: "calc(100% - 24px)",
    zIndex: "80",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    background: "#f7f8fb",
    border: "1px solid rgba(20, 30, 45, 0.32)",
    borderRadius: "8px",
    boxShadow: "0 14px 38px rgba(0,0,0,0.32)",
    color: "#111",
    font: "12px/1.35 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
  });

  const header = document.createElement("div");
  Object.assign(header.style, {
    flex: "0 0 auto",
    minHeight: "38px",
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "6px 8px",
    borderBottom: "1px solid rgba(20, 30, 45, 0.16)",
    background: "#ffffff",
    boxSizing: "border-box",
  });

  const title = document.createElement("div");
  title.textContent = resource.label || "Linked Resource";
  title.title = resource.path;
  Object.assign(title.style, {
    flex: "1 1 auto",
    minWidth: "0",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    fontWeight: "700",
  });
  header.appendChild(title);

  const finishButton = createButton("Finish", handlers.finish);
  const closeButton = createButton("Close", handlers.close);
  header.append(finishButton, closeButton);

  const host = document.createElement("div");
  Object.assign(host.style, {
    flex: "1 1 auto",
    minHeight: "0",
    minWidth: "0",
    overflow: "hidden",
    position: "relative",
    background: "#ffffff",
  });

  frame.append(header, host);
  return { frame, host, finishButton, closeButton, title };
}

async function saveSessionResource(session) {
  const ext = pathExtension(session?.resource?.path);
  if (RASTER_IMAGE_EXTENSIONS.has(ext)) {
    const canvas = session.rasterCanvas instanceof HTMLCanvasElement
      ? session.rasterCanvas
      : session.host?.querySelector?.("canvas");
    if (canvas instanceof HTMLCanvasElement) {
      await saveNotebookBinaryFromDataUrl(session.resource.path, canvas.toDataURL("image/png"));
      return true;
    }
  }

  if (SVG_IMAGE_EXTENSIONS.has(ext)) {
    const serializer = typeof session.getEditorHTML === "function" ? session.getEditorHTML : null;
    if (serializer) {
      const markup = serializer();
      if (typeof markup === "string" && markup.trim()) {
        await saveNotebookText(session.resource.path, markup, "image/svg+xml");
        return true;
      }
    }
  }

  if (typeof session.saveWYSIWYGFile === "function") {
    await session.saveWYSIWYGFile(session.resource.path);
    return true;
  }
  if (typeof session.saveMDFile === "function") {
    await session.saveMDFile(session.resource.path);
    return true;
  }
  return false;
}

async function refreshWorldResource({ session, THREE, objectInspector }) {
  const target = session?.target;
  if (!target?.userData) return;
  const resource = resolveLinkedWorldResource(target);
  const source = resource?.source || session.resource?.source || "";

  if (source === "objectFile" && target.userData.objectFilePath) {
    const mod = await import("./objectFileLoader.mjs");
    await mod.applyObjectFileGeometry(target, { cacheBust: true });
  } else if (source === "imageFile" && target.userData.imageFilePath) {
    const mod = await import("./imagePlaneLoader.mjs");
    await mod.applyImagePlaneTexture(target, THREE, { cacheBust: true });
  }

  objectInspector?.refreshActiveTarget?.();
}

export function createVirtualWorldEmbeddedResourceEditor({ panel, THREE, objectInspector } = {}) {
  let session = null;

  async function close(options = {}) {
    const current = session;
    if (!current) return false;
    session = null;
    if (current.instance?.destroy) {
      try {
        current.instance.destroy();
      } catch (err) {
        console.warn("Embedded resource editor cleanup failed:", err);
      }
    } else if (current.instance?.dispose) {
      try {
        current.instance.dispose();
      } catch (err) {
        console.warn("Embedded resource editor cleanup failed:", err);
      }
    }
    if (typeof current.host?.__nvModelFamilyEditorCleanup === "function") {
      try {
        current.host.__nvModelFamilyEditorCleanup();
      } catch (err) {
        console.warn("Embedded model editor cleanup failed:", err);
      }
      current.host.__nvModelFamilyEditorCleanup = null;
    }
    current.frame?.remove();

    const activeTarget = objectInspector?.getActiveTarget?.() || null;
    const resource = objectInspector
      ? (objectInspector.getActiveLinkedResource?.() || resolveLinkedWorldResource(activeTarget) || null)
      : (current.resource || null);
    if (options.restore !== false) restoreEditorGlobals(current.previousGlobals, resource);
    return true;
  }

  async function finish() {
    const current = session;
    if (!current || current.busy) return false;
    current.busy = true;
    current.finishButton.disabled = true;
    current.closeButton.disabled = true;
    const previousTitle = current.title.textContent;
    current.title.textContent = "Saving " + previousTitle;
    try {
      await saveSessionResource(current);
      await refreshWorldResource({ session: current, THREE, objectInspector });
      await close();
      return true;
    } catch (err) {
      console.warn("Embedded resource editor save failed:", err);
      alert("Failed to save linked resource: " + (err?.message || err));
      current.title.textContent = previousTitle;
      current.finishButton.disabled = false;
      current.closeButton.disabled = false;
      current.busy = false;
      return false;
    }
  }

  async function open(target, rawResource = null) {
    const resource = rawResource || resolveLinkedWorldResource(target);
    if (!panel || !resource?.path) {
      console.warn("Virtual world edit here: no linked resource is selected.");
      return false;
    }

    if (session) await close();
    ensurePanelPosition(panel);
    window.VRWorldContext?.controls?.unlock?.();

    const previousGlobals = captureEditorGlobals();
    const frameParts = createFrame(resource, {
      finish,
      close: () => { void close(); },
    });
    panel.appendChild(frameParts.frame);

    session = {
      ...frameParts,
      target,
      resource,
      previousGlobals,
      instance: null,
      rasterCanvas: null,
      getEditorHTML: null,
      saveWYSIWYGFile: null,
      saveMDFile: null,
      busy: false,
    };

    try {
      const descriptor = await resolveEditorDescriptor(resource.path);
      window.NodevisionState = window.NodevisionState || {};
      window.NodevisionState.selectedFile = resource.path;
      window.NodevisionState.activeEditorFilePath = resource.path;
      window.selectedFilePath = resource.path;
      window.currentActiveFilePath = resource.path;
      window.filePath = resource.path;

      const mod = await import(descriptor.modulePath);
      if (typeof mod.renderEditor !== "function") throw new Error("Editor module missing renderEditor().");
      const instance = await mod.renderEditor(resource.path, frameParts.host);
      if (!session || session.resource !== resource) {
        instance?.destroy?.();
        instance?.dispose?.();
        return false;
      }

      session.instance = instance || null;
      session.rasterCanvas = window.rasterCanvas instanceof HTMLCanvasElement && frameParts.host.contains(window.rasterCanvas)
        ? window.rasterCanvas
        : frameParts.host.querySelector("canvas");
      session.getEditorHTML = typeof window.getEditorHTML === "function" ? window.getEditorHTML : null;
      session.saveWYSIWYGFile = typeof window.saveWYSIWYGFile === "function" ? window.saveWYSIWYGFile : null;
      session.saveMDFile = typeof window.saveMDFile === "function" ? window.saveMDFile : null;
      return true;
    } catch (err) {
      console.warn("Virtual world edit here failed:", err);
      frameParts.host.innerHTML = "";
      const message = document.createElement("div");
      message.textContent = "Unable to open " + resource.label;
      message.style.cssText = "padding:12px;color:#9b1c1c;font:13px/1.4 monospace;";
      frameParts.host.appendChild(message);
      restoreEditorGlobals(previousGlobals, resource);
      return false;
    }
  }

  return {
    open,
    openSelectedResource() {
      const target = objectInspector?.getActiveTarget?.() || null;
      const resource = objectInspector?.getActiveLinkedResource?.() || resolveLinkedWorldResource(target);
      return open(target, resource);
    },
    close,
    finish,
    dispose() {
      return close({ restore: true });
    },
    isOpen() {
      return Boolean(session);
    },
  };
}
