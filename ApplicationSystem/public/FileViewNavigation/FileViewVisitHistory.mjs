// Nodevision/ApplicationSystem/public/FileViewNavigation/FileViewVisitHistory.mjs
// This module records in-memory FileView visit history so the FileView navigation toolbar can move back and forward without changing Notebook files.

import { normalizeNotebookPagePath } from "./NotebookPageTraversal.mjs";

const MAX_HISTORY = 80;
const state = {
  currentPath: "",
  backStack: [],
  forwardStack: [],
  started: false,
  timer: 0,
  observer: null,
};

function defaultGlobal() {
  return typeof window === "undefined" ? globalThis : window;
}

function readPanelPath(global = defaultGlobal()) {
  const panelPath = global.document?.querySelector?.('[data-id="FileView"] [data-current-file-path]')?.dataset?.currentFilePath;
  const cellPath = global.document?.querySelector?.('[data-id="FileView"]')?.dataset?.currentFilePath;
  return panelPath || cellPath || "";
}

export function readCurrentFileViewPath(global = defaultGlobal()) {
  const candidates = [
    global.NodevisionState?.activeFileViewPath,
    readPanelPath(global),
    global.currentActiveFilePath,
    global.selectedFilePath,
    global.NodevisionState?.selectedFile,
  ];
  for (const candidate of candidates) {
    const clean = normalizeNotebookPagePath(candidate);
    if (clean) return clean;
  }
  return "";
}

function trimStack(stack) {
  if (stack.length > MAX_HISTORY) stack.splice(0, stack.length - MAX_HISTORY);
}

export function recordFileViewVisit(pathValue, options = {}) {
  const nextPath = normalizeNotebookPagePath(pathValue);
  if (!nextPath) return state.currentPath;
  if (!state.currentPath || options.replace) {
    state.currentPath = nextPath;
    return state.currentPath;
  }
  if (nextPath === state.currentPath) return state.currentPath;
  state.backStack.push(state.currentPath);
  trimStack(state.backStack);
  if (options.clearForward !== false) state.forwardStack = [];
  state.currentPath = nextPath;
  return state.currentPath;
}

export function syncFileViewVisitHistory(global = defaultGlobal()) {
  const path = readCurrentFileViewPath(global);
  if (path) recordFileViewVisit(path);
  return getFileViewHistoryState();
}

export function getFileViewHistoryTarget(direction = "back") {
  return direction === "forward" ? state.forwardStack.at(-1) || "" : state.backStack.at(-1) || "";
}

export function commitFileViewHistoryMove(direction = "back", targetPath = "") {
  const target = normalizeNotebookPagePath(targetPath);
  const source = direction === "forward" ? state.forwardStack : state.backStack;
  const destination = direction === "forward" ? state.backStack : state.forwardStack;
  if (!target || source.at(-1) !== target) return false;
  source.pop();
  if (state.currentPath) {
    destination.push(state.currentPath);
    trimStack(destination);
  }
  state.currentPath = target;
  return true;
}

export function getFileViewHistoryState() {
  return {
    currentPath: state.currentPath,
    canGoBack: state.backStack.length > 0,
    canGoForward: state.forwardStack.length > 0,
    backCount: state.backStack.length,
    forwardCount: state.forwardStack.length,
  };
}

export function startFileViewVisitTracking(global = defaultGlobal()) {
  if (state.started) return getFileViewHistoryState();
  state.started = true;
  const sync = () => syncFileViewVisitHistory(global);
  sync();
  global.addEventListener?.("fileSelected", sync);
  global.document?.addEventListener?.("fileSelected", sync);
  global.addEventListener?.("activePanelChanged", sync);
  if (global.MutationObserver && global.document?.body) {
    state.observer = new global.MutationObserver(sync);
    state.observer.observe(global.document.body, { subtree: true, attributes: true, attributeFilter: ["data-current-file-path"] });
  }
  state.timer = global.setInterval?.(sync, 750) || 0;
  return getFileViewHistoryState();
}
