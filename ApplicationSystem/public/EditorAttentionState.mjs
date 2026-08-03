// Nodevision/ApplicationSystem/public/EditorAttentionState.mjs
// This module stores editor attention state for the Nodevision browser client and exposes safe update, subscription, label, settings, and per-file persistence helpers for editor integrations.

const BASE_STATE = Object.freeze({
  filePath: null,
  fileFamily: null,
  fileFamilyLabel: null,
  editorMode: null,
  editorModeLabel: null,
  activeTool: null,
  activeToolLabel: null,
  selectedObjectType: null,
  selectedObjectId: null,
  selectedObjectLabel: null,
  hasSelection: false,
  hasEditableSelection: false,
  busyOperation: null,
});

export const ATTENTION_FILE_STATE_KEY = "nodevision.editorAttention.fileState.v1";
export const USER_PREFERENCES_KEY = "nodevision.userPreferences";

export const DEFAULT_EDITOR_ATTENTION_SETTINGS = Object.freeze({
  editorAttentionContextualToolVisibility: false,
  editorAttentionRestoreLastEditingPosition: true,
  editorAttentionRestoreActiveToolWhenSafe: true,
  editorAttentionShowRoutineSaveConfirmation: false,
});

export const EDITOR_ATTENTION_PREFERENCE_FIELDS = Object.freeze([
  {
    key: "editorAttentionContextualToolVisibility",
    type: "checkbox",
    label: "Enable contextual tool visibility",
    help: "When enabled, hide tools that declare narrow selection-specific visibility rules. Keep this off to preserve the broader editor tool set.",
  },
  {
    key: "editorAttentionRestoreLastEditingPosition",
    type: "checkbox",
    label: "Restore last editing position",
    help: "Restore supported cursor, selection, and scroll state when reopening a file.",
  },
  {
    key: "editorAttentionRestoreActiveToolWhenSafe",
    type: "checkbox",
    label: "Restore active tool when safe",
    help: "Return graphical editors to the last safe tool used for the same file.",
  },
  {
    key: "editorAttentionShowRoutineSaveConfirmation",
    type: "checkbox",
    label: "Show routine save confirmations",
    help: "Show quiet saved messages without stealing focus.",
  },
]);

const BOOLEAN_SETTING_KEYS = new Set([
  "editorAttentionContextualToolVisibility",
  "editorAttentionRestoreLastEditingPosition",
  "editorAttentionRestoreActiveToolWhenSafe",
  "editorAttentionShowRoutineSaveConfirmation",
]);

const MAX_ATTENTION_TEXT_LENGTH = 240;
const MAX_FILE_STATE_ENTRIES = 300;

function getGlobal() {
  if (typeof window !== "undefined") return window;
  if (typeof globalThis !== "undefined") return globalThis;
  return {};
}

function safeStorage(storage) {
  if (storage) return storage;
  const global = getGlobal();
  try {
    return global.localStorage || null;
  } catch {
    return null;
  }
}

function safeEventTarget(eventTarget) {
  if (eventTarget) return eventTarget;
  const global = getGlobal();
  if (typeof global.addEventListener === "function" && typeof global.dispatchEvent === "function") return global;
  return null;
}

function clone(value) {
  if (value == null) return value;
  if (typeof structuredClone === "function") {
    try { return structuredClone(value); } catch {}
  }
  return JSON.parse(JSON.stringify(value));
}

function readJson(storage, key, fallback) {
  const target = safeStorage(storage);
  if (!target) return fallback;
  try {
    const raw = target.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(storage, key, value) {
  const target = safeStorage(storage);
  if (!target) return false;
  try {
    target.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function editorAttentionPreferenceDefaults() {
  return { ...DEFAULT_EDITOR_ATTENTION_SETTINGS };
}

export function validateEditorAttentionSettings(input = {}) {
  const settings = editorAttentionPreferenceDefaults();
  const source = input && typeof input === "object" ? input : {};
  for (const key of BOOLEAN_SETTING_KEYS) {
    if (typeof source[key] === "boolean") settings[key] = source[key];
  }
  return settings;
}

export function readEditorAttentionSettings(storage) {
  const global = getGlobal();
  const runtimePrefs = global.NodevisionUserPreferences || global.NodevisionState?.userPreferences;
  const storedPrefs = readJson(storage, USER_PREFERENCES_KEY, {});
  return validateEditorAttentionSettings({ ...storedPrefs, ...(runtimePrefs || {}) });
}

export function normalizeAttentionPath(input) {
  if (!input || typeof input !== "string") return null;
  let value = input.trim().replace(/\\/g, "/").replace(/^file:\/\//, "");
  value = value.replace(/\/+/g, "/");
  const marker = "/Notebook/";
  const idx = value.indexOf(marker);
  if (idx >= 0) value = value.slice(idx + marker.length);
  value = value.replace(/^\.?\/?Notebook\//, "").replace(/^\/+/, "");
  const parts = [];
  for (const part of value.split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") {
      if (parts.length) parts.pop();
      continue;
    }
    parts.push(part);
  }
  return parts.join("/") || null;
}

export function sanitizeAttentionText(value, maxLength = MAX_ATTENTION_TEXT_LENGTH) {
  if (typeof value !== "string") return "";
  return value.replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

export function escapeAttentionText(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function labelFromToken(value, labels = {}) {
  if (!value) return "";
  if (labels && labels[value]) return labels[value];
  const text = String(value)
    .replace(/[-_]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .trim();
  if (!text) return "";
  return text.replace(/\b\w/g, char => char.toUpperCase());
}

export function buildEditorContextLabel(snapshot = {}, labels = {}) {
  const modeLabel = snapshot.editorModeLabel || labelFromToken(snapshot.editorMode, labels.editorModes);
  const toolLabel = snapshot.activeToolLabel || labelFromToken(snapshot.activeTool, labels.tools);
  const objectLabel = snapshot.selectedObjectLabel || labelFromToken(snapshot.selectedObjectType, labels.objectTypes);
  return [modeLabel, toolLabel, objectLabel].filter(Boolean).join(" · ");
}

function normalizeBusyOperation(operation) {
  if (!operation) return null;
  if (typeof operation === "string") {
    return { id: operation, label: operation, detail: "", progressCurrent: null, progressTotal: null, cancellable: false };
  }
  if (typeof operation !== "object") return null;
  const id = sanitizeAttentionText(operation.id || operation.label || "busy", 80) || "busy";
  const label = sanitizeAttentionText(operation.label || id, 120) || id;
  const detail = sanitizeAttentionText(operation.detail || "", 180);
  const progressCurrent = Number.isFinite(operation.progressCurrent) ? Math.max(0, operation.progressCurrent) : null;
  const progressTotal = Number.isFinite(operation.progressTotal) && operation.progressTotal > 0 ? operation.progressTotal : null;
  return {
    id,
    label,
    detail,
    progressCurrent,
    progressTotal,
    cancellable: Boolean(operation.cancellable),
  };
}

function normalizeSerializableContext(context = {}) {
  if (!context || typeof context !== "object") return {};
  const out = {};
  if (context.scroll && typeof context.scroll === "object") {
    out.scroll = {
      top: Number.isFinite(context.scroll.top) ? context.scroll.top : 0,
      left: Number.isFinite(context.scroll.left) ? context.scroll.left : 0,
    };
  }
  if (context.cursorPosition && typeof context.cursorPosition === "object") {
    out.cursorPosition = clone(context.cursorPosition);
  }
  if (context.selection && typeof context.selection === "object") out.selection = clone(context.selection);
  if (typeof context.editorMode === "string") out.editorMode = context.editorMode;
  if (typeof context.activeTool === "string") out.activeTool = context.activeTool;
  if (context.panels && typeof context.panels === "object") out.panels = clone(context.panels);
  return out;
}

function readFileState(storage) {
  const state = readJson(storage, ATTENTION_FILE_STATE_KEY, {});
  return state && typeof state === "object" ? state : {};
}

function writeFileState(storage, state) {
  return writeJson(storage, ATTENTION_FILE_STATE_KEY, state && typeof state === "object" ? state : {});
}

function trimFileStateEntries(state) {
  const entries = Object.entries(state || {});
  if (entries.length <= MAX_FILE_STATE_ENTRIES) return state || {};
  entries.sort((a, b) => (b[1]?.updatedAt || 0) - (a[1]?.updatedAt || 0));
  return Object.fromEntries(entries.slice(0, MAX_FILE_STATE_ENTRIES));
}

export function createEditorAttentionStore(options = {}) {
  const storage = safeStorage(options.storage);
  const eventTarget = safeEventTarget(options.eventTarget);
  const now = typeof options.now === "function" ? options.now : () => Date.now();
  const listeners = new Set();
  let state = { ...BASE_STATE, ...(options.initialState || {}) };

  function publish(previousState = null) {
    const snapshot = getSnapshot();
    syncGlobal(snapshot);
    for (const listener of [...listeners]) {
      try { listener(snapshot, previousState ? clone(previousState) : null); } catch (error) { console.error("Editor attention listener failed", error); }
    }
    if (eventTarget && typeof eventTarget.dispatchEvent === "function" && typeof CustomEvent !== "undefined") {
      try { eventTarget.dispatchEvent(new CustomEvent("nv-editor-attention-changed", { detail: snapshot })); } catch {}
    }
  }

  function commit(patch = {}) {
    const previous = state;
    state = { ...state, ...patch };
    publish(previous);
    return getSnapshot();
  }

  function getSnapshot() {
    return clone(state);
  }

  function syncGlobal(snapshot) {
    const global = getGlobal();
    global.NodevisionState = global.NodevisionState || {};
    global.NodevisionState.editorAttention = clone(snapshot);
    if (snapshot.editorMode) global.NodevisionState.editorMode = snapshot.editorMode;
    if (snapshot.fileFamily) global.NodevisionState.fileFamily = snapshot.fileFamily;
    global.NodevisionState.activeTool = snapshot.activeTool;
    global.NodevisionState.selectedObjectType = snapshot.selectedObjectType;
    global.NodevisionState.selectedObjectId = snapshot.selectedObjectId;
    global.NodevisionState.hasEditableSelection = snapshot.hasEditableSelection;
  }


  return {
    getSnapshot,
    subscribe(listener, opts = {}) {
      if (typeof listener !== "function") return () => {};
      listeners.add(listener);
      if (opts.immediate !== false) listener(getSnapshot(), null);
      return () => listeners.delete(listener);
    },
    setEditorContext(context = {}) {
      const normalizedPath = Object.prototype.hasOwnProperty.call(context, "filePath")
        ? normalizeAttentionPath(context.filePath)
        : state.filePath;
      const fileChanged = normalizedPath !== state.filePath;
      const modeChanged = Boolean(context.editorMode && context.editorMode !== state.editorMode);
      const resetSelection = fileChanged || modeChanged;
      const saved = normalizedPath ? readFileState(storage)[normalizedPath] || {} : {};
      const settings = readEditorAttentionSettings(storage);
      const hasExplicitTool = Object.prototype.hasOwnProperty.call(context, "activeTool");
      const patch = {
        ...context,
        filePath: normalizedPath,
        selectedObjectType: resetSelection ? null : state.selectedObjectType,
        selectedObjectId: resetSelection ? null : state.selectedObjectId,
        selectedObjectLabel: resetSelection ? null : state.selectedObjectLabel,
        hasSelection: resetSelection ? false : state.hasSelection,
        hasEditableSelection: resetSelection ? false : state.hasEditableSelection,
      };
      if ((fileChanged || modeChanged) && !hasExplicitTool) {
        patch.activeTool = null;
        patch.activeToolLabel = null;
      }
      if (fileChanged && settings.editorAttentionRestoreActiveToolWhenSafe && saved.activeTool && !hasExplicitTool) {
        patch.activeTool = saved.activeTool;
        patch.activeToolLabel = saved.activeToolLabel || labelFromToken(saved.activeTool);
      }
      if (context.activeTool && !context.activeToolLabel) patch.activeToolLabel = labelFromToken(context.activeTool);
      if (context.editorMode && !context.editorModeLabel) patch.editorModeLabel = labelFromToken(context.editorMode);
      if (context.fileFamily && !context.fileFamilyLabel) patch.fileFamilyLabel = labelFromToken(context.fileFamily);
      return commit(patch);
    },
    setActiveTool(tool, label = null) {
      return commit({ activeTool: tool || null, activeToolLabel: label || (tool ? labelFromToken(tool) : null) });
    },
    setSelectionContext(selection = {}) {
      const selectedObjectType = selection.selectedObjectType || selection.objectType || selection.type || null;
      const selectedObjectId = selection.selectedObjectId || selection.objectId || selection.id || null;
      const hasSelection = selection.hasSelection ?? Boolean(selectedObjectType || selectedObjectId);
      return commit({
        selectedObjectType,
        selectedObjectId,
        selectedObjectLabel: selection.selectedObjectLabel || selection.objectLabel || (selectedObjectType ? labelFromToken(selectedObjectType) : null),
        hasSelection: Boolean(hasSelection),
        hasEditableSelection: Boolean(selection.hasEditableSelection ?? hasSelection),
      });
    },
    setBusyOperation(operation) {
      return commit({ busyOperation: normalizeBusyOperation(operation) });
    },
    clearEditorContext(filePath = null) {
      const targetPath = normalizeAttentionPath(filePath);
      if (targetPath && targetPath !== state.filePath) return getSnapshot();
      return commit({ ...BASE_STATE });
    },
    saveEditingContext(filePath, context = {}) {
      const key = normalizeAttentionPath(filePath || state.filePath);
      if (!key) return null;
      const compact = normalizeSerializableContext(context);
      const fileState = trimFileStateEntries(readFileState(storage));
      fileState[key] = { ...(fileState[key] || {}), ...compact, updatedAt: now() };
      writeFileState(storage, key ? fileState : {});
      return clone(fileState[key]);
    },
    getEditingContext(filePath) {
      const key = normalizeAttentionPath(filePath || state.filePath);
      if (!key) return null;
      const saved = readFileState(storage)[key];
      return saved && typeof saved === "object" ? clone(saved) : null;
    },
    restoreEditingContext(filePath) {
      return this.getEditingContext(filePath);
    },
    _resetForTests(nextState = {}) {
      state = { ...BASE_STATE, ...nextState };
      listeners.clear();
      syncGlobal(getSnapshot());
    },
  };
}

const defaultStore = createEditorAttentionStore();

export const getSnapshot = () => defaultStore.getSnapshot();
export const subscribe = (listener, opts) => defaultStore.subscribe(listener, opts);
export const setEditorContext = context => defaultStore.setEditorContext(context);
export const setActiveTool = (tool, label) => defaultStore.setActiveTool(tool, label);
export const setSelectionContext = selection => defaultStore.setSelectionContext(selection);
export const setBusyOperation = operation => defaultStore.setBusyOperation(operation);
export const clearEditorContext = filePath => defaultStore.clearEditorContext(filePath);
export const saveEditingContext = (filePath, context) => defaultStore.saveEditingContext(filePath, context);
export const getEditingContext = filePath => defaultStore.getEditingContext(filePath);
export const restoreEditingContext = filePath => defaultStore.restoreEditingContext(filePath);

const global = getGlobal();
global.NodevisionEditorAttention = {
  getSnapshot,
  subscribe,
  setEditorContext,
  setActiveTool,
  setSelectionContext,
  setBusyOperation,
  clearEditorContext,
  saveEditingContext,
  getEditingContext,
  restoreEditingContext,
  buildEditorContextLabel,
  readEditorAttentionSettings,
};
