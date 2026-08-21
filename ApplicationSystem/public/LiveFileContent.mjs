// Nodevision/ApplicationSystem/public/LiveFileContent.mjs
// Shared client-side registry for editor buffers that can be previewed before saving.

const LIVE_PROVIDERS_KEY = "__nvLiveFileContentProviders";

function globalObject() {
  return typeof window === "undefined" ? globalThis : window;
}

export function normalizeLiveFilePath(value = "") {
  let cleaned = String(value || "")
    .trim()
    .replace(/\\/g, "/")
    .replace(/[?#].*$/, "")
    .replace(/^https?:\/\/[^/]+/i, "")
    .replace(/^\/+/, "");

  if (cleaned.toLowerCase().startsWith("notebook/")) {
    cleaned = cleaned.slice("Notebook/".length);
  }

  return cleaned;
}

function providers(global = globalObject()) {
  if (!global[LIVE_PROVIDERS_KEY]) {
    global[LIVE_PROVIDERS_KEY] = new Map();
  }
  return global[LIVE_PROVIDERS_KEY];
}

function providerDirty(provider) {
  if (typeof provider?.dirty === "function") {
    try {
      return Boolean(provider.dirty());
    } catch {
      return false;
    }
  }
  return Boolean(provider?.dirty);
}

function dispatchProviderEvent(type, provider, extra = {}) {
  const global = globalObject();
  global.dispatchEvent?.(new CustomEvent(type, {
    detail: {
      filePath: provider?.filePath || "",
      normalizedPath: normalizeLiveFilePath(provider?.filePath || ""),
      sourceId: provider?.id || "",
      editorKind: provider?.editorKind || "",
      panelKind: provider?.panelKind || "",
      dirty: providerDirty(provider),
      timestamp: provider?.timestamp || Date.now(),
      ...extra,
    },
  }));
}

export function registerLiveFileContentProvider(provider = {}) {
  const global = globalObject();
  const id = String(provider.id || "").trim();
  if (!id) throw new Error("Live file content provider requires an id.");

  const registry = providers(global);
  const previous = registry.get(id) || {};
  const entry = {
    ...previous,
    ...provider,
    id,
    filePath: normalizeLiveFilePath(provider.filePath || previous.filePath || ""),
    timestamp: Date.now(),
  };

  registry.set(id, entry);
  dispatchProviderEvent("nodevision-live-file-content-provider-registered", entry, { reason: "registered" });
  dispatchProviderEvent("nodevision-live-file-content-changed", entry, { reason: "registered" });

  return () => clearLiveFileContentProvider(id);
}

export function updateLiveFileContentProvider(id, patch = {}) {
  const global = globalObject();
  const registry = providers(global);
  const key = String(id || "").trim();
  const previous = registry.get(key);
  if (!key || !previous) return null;

  const entry = {
    ...previous,
    ...patch,
    id: key,
    filePath: normalizeLiveFilePath(patch.filePath || previous.filePath || ""),
    timestamp: Date.now(),
  };
  registry.set(key, entry);
  dispatchProviderEvent("nodevision-live-file-content-changed", entry, { reason: patch.reason || "updated" });
  return entry;
}

export function touchLiveFileContentProvider(id, detail = {}) {
  return updateLiveFileContentProvider(id, detail);
}

export function clearLiveFileContentProvider(id) {
  const global = globalObject();
  const registry = providers(global);
  const key = String(id || "").trim();
  const provider = registry.get(key);
  if (!provider) return false;
  registry.delete(key);
  dispatchProviderEvent("nodevision-live-file-content-provider-cleared", provider, { reason: "cleared" });
  return true;
}

function readProviderContent(provider) {
  if (typeof provider?.getContent === "function") {
    return provider.getContent();
  }
  if (Object.prototype.hasOwnProperty.call(provider || {}, "content")) {
    return provider.content;
  }
  return undefined;
}

export function getLiveFileContentForPath(filePath, options = {}) {
  const targetPath = normalizeLiveFilePath(filePath);
  if (!targetPath) return null;

  const textOnly = options.textOnly !== false;
  const matches = [...providers().values()]
    .filter((provider) => normalizeLiveFilePath(provider.filePath).toLowerCase() === targetPath.toLowerCase())
    .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

  for (const provider of matches) {
    if (textOnly && provider.isBinary) continue;
    try {
      const content = readProviderContent(provider);
      if (typeof content !== "string") continue;
      return {
        content,
        filePath: targetPath,
        sourceId: provider.id,
        sourceLabel: provider.sourceLabel || provider.panelKind || provider.editorKind || "Editor",
        editorKind: provider.editorKind || "",
        panelKind: provider.panelKind || "",
        dirty: providerDirty(provider),
        encoding: provider.encoding || "utf8",
        mimeType: provider.mimeType || "",
        timestamp: provider.timestamp || 0,
      };
    } catch (err) {
      console.warn("[LiveFileContent] Provider read failed:", provider.id, err);
    }
  }

  return null;
}

export function listLiveFileContentProviders() {
  return [...providers().values()].map((provider) => ({
    id: provider.id,
    filePath: provider.filePath,
    editorKind: provider.editorKind || "",
    panelKind: provider.panelKind || "",
    sourceLabel: provider.sourceLabel || "",
    dirty: providerDirty(provider),
    timestamp: provider.timestamp || 0,
    isBinary: Boolean(provider.isBinary),
  }));
}

if (typeof window !== "undefined") {
  window.NodevisionLiveFileContent = window.NodevisionLiveFileContent || {
    normalizePath: normalizeLiveFilePath,
    registerProvider: registerLiveFileContentProvider,
    updateProvider: updateLiveFileContentProvider,
    touchProvider: touchLiveFileContentProvider,
    clearProvider: clearLiveFileContentProvider,
    getForPath: getLiveFileContentForPath,
    listProviders: listLiveFileContentProviders,
  };
}
