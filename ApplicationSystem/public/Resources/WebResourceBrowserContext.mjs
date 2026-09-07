// Nodevision/ApplicationSystem/public/Resources/WebResourceBrowserContext.mjs
// Plain-data invocation helpers for the docked Web Resource Browser.

export const WEB_RESOURCE_BROWSER_INTENTS = Object.freeze({
  INSERT_MEDIA: "insert-media",
  ACQUIRE_RESOURCE: "acquire-resource",
});

const VALID_INTENTS = new Set(Object.values(WEB_RESOURCE_BROWSER_INTENTS));

function clonePlain(value) {
  if (value === undefined) return undefined;
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return null;
  }
}

function clean(value) {
  return String(value || "").trim();
}

function normalizeResourceType(value, fallback = "image") {
  const type = clean(value || fallback).toLowerCase();
  return /^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)*$/.test(type) ? type : clean(fallback).toLowerCase();
}

function makeReturnToken() {
  const crypto = globalThis.crypto;
  if (crypto?.randomUUID) return crypto.randomUUID();
  return "web-resource-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
}

function normalizeOriginContext(value = {}) {
  const source = value && typeof value === "object" ? value : {};
  return {
    originCellId: clean(source.originCellId || ""),
    originTabId: clean(source.originTabId || ""),
    originPanelType: clean(source.originPanelType || ""),
    originPanelClass: clean(source.originPanelClass || ""),
    originEditorPath: clean(source.originEditorPath || source.editorPath || ""),
    targetMode: clean(source.targetMode || ""),
    mediaFamily: clean(source.mediaFamily || source.familyKey || ""),
  };
}

export function normalizeWebResourceBrowserInvocation(input = {}) {
  const intent = VALID_INTENTS.has(clean(input.intent)) ? clean(input.intent) : WEB_RESOURCE_BROWSER_INTENTS.ACQUIRE_RESOURCE;
  const resourceType = normalizeResourceType(input.resourceType || input.typeId || "image");
  const suppliedOriginContext = normalizeOriginContext(input.insertMediaOriginContext || input.originContext || {});
  const mediaFamily = clean(input.mediaFamily || input.family || suppliedOriginContext.mediaFamily || "");
  const originCellId = clean(input.originCellId || suppliedOriginContext.originCellId || "");
  const originTabId = clean(input.originTabId || suppliedOriginContext.originTabId || "");
  const originPanelType = clean(input.originPanelType || suppliedOriginContext.originPanelType || "");
  const originPanelClass = clean(input.originPanelClass || suppliedOriginContext.originPanelClass || "");
  const originEditorPath = clean(input.originEditorPath || input.editorPath || suppliedOriginContext.originEditorPath || "");
  const targetMode = clean(input.targetMode || suppliedOriginContext.targetMode || globalThis.window?.NodevisionState?.currentMode || "");
  const insertMediaOriginContext = {
    ...suppliedOriginContext,
    originCellId,
    originTabId,
    originPanelType,
    originPanelClass,
    originEditorPath,
    targetMode,
    mediaFamily,
  };
  return {
    intent,
    resourceType,
    mediaFamily,
    sourceMode: clean(input.sourceMode || "existing"),
    originPanelId: clean(input.originPanelId || ""),
    originCellId,
    originTabId,
    originPanelType,
    originPanelClass,
    originEditorPath,
    targetMode,
    insertMediaState: clonePlain(input.insertMediaState || {}) || {},
    insertMediaOriginContext,
    returnToken: clean(input.returnToken || makeReturnToken()),
  };
}

export function isInsertMediaInvocation(invocation = {}) {
  return clean(invocation.intent) === WEB_RESOURCE_BROWSER_INTENTS.INSERT_MEDIA;
}

export function resourceTypeMatchesInvocation(resource = {}, invocation = {}) {
  const expected = normalizeResourceType(invocation.resourceType || "");
  const actual = normalizeResourceType(resource.resourceType || resource.typeId || "");
  return Boolean(expected && actual && expected === actual);
}

export function resourceReferenceToSourceValue(resource = {}) {
  const notebookPath = clean(resource.notebookPath || "");
  if (notebookPath) return notebookPath;
  const sourceValue = clean(resource.source?.value || "");
  if (sourceValue && !sourceValue.startsWith("data:")) return sourceValue;
  return clean(resource.src || resource.href || sourceValue || resource.inlineDataUrl || "");
}

function normalizePath(value = "") {
  return clean(value)
    .replace(/\\/g, "/")
    .replace(/[?#].*$/, "")
    .replace(/^https?:\/\/[^/]+/i, "")
    .replace(/^\/+/, "")
    .replace(/^Notebook\/+/, "");
}

function candidateEditorPaths() {
  const state = globalThis.window?.NodevisionState || {};
  return [
    state.activeEditorFilePath,
    globalThis.window?.__nvCodeEditorActivePath,
    globalThis.window?.__nvMarkdownActivePath,
    globalThis.window?.__nvWysiwygActivePath,
    globalThis.window?.__nvHtmlEditorActivePath,
    globalThis.window?.__nvSvgEditorActivePath,
    globalThis.window?.currentActiveFilePath,
    globalThis.window?.selectedFilePath,
    state.selectedFile,
  ].map(normalizePath).filter(Boolean);
}

export function originContextIsAvailable(invocation = {}) {
  if (!isInsertMediaInvocation(invocation)) return { ok: true };
  const mode = clean(invocation.targetMode);
  const expectedPath = normalizePath(invocation.originEditorPath);

  if (mode === "Virtual World Editing" || mode === "VR World Editing") {
    const ctx = globalThis.window?.VRWorldContext;
    if (!ctx) return { ok: false, reason: "The original Virtual World editor is no longer available." };
    const activeWorld = normalizePath(ctx.currentWorldPath || globalThis.window?.selectedFilePath || "");
    if (expectedPath && activeWorld && expectedPath !== activeWorld) {
      return { ok: false, reason: "The original Virtual World target changed before the resource was returned." };
    }
    return { ok: true };
  }

  if (mode === "SVG Editing") {
    if (typeof globalThis.window?.SVGEditorContext?.insertImageFromInsertion !== "function") {
      return { ok: false, reason: "The original SVG editor is no longer available." };
    }
    return { ok: true };
  }

  const editor = globalThis.window?.HTMLWysiwygTools?.getEditorElement?.();
  if (!editor?.isConnected) return { ok: false, reason: "The original HTML editor is no longer available." };
  if (expectedPath) {
    const paths = candidateEditorPaths();
    if (paths.length && !paths.includes(expectedPath)) {
      return { ok: false, reason: "The original editor target changed before the resource was returned." };
    }
  }
  return { ok: true };
}
