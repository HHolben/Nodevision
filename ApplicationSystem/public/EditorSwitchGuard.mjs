// Nodevision/ApplicationSystem/public/EditorSwitchGuard.mjs
// This module provides a shared unsaved-change guard for switching the active file from File Manager, Graph Manager, and related navigation surfaces.

import { createEditorSwitchPrompt } from "./EditorSwitchPrompt.mjs";
import saveFile from "/ToolbarCallbacks/file/saveFile.mjs";
import { updateToolbarState } from "/panels/createToolbar.mjs";
import {
  installNodevisionSelectionCompatibility,
  setNodevisionSelectedPath,
} from "./NodevisionSelection.mjs";

let promptEl = null;
let promptOpen = false;
let queuedSwitch = null;
let switching = false;

function normalizePath(value = "") {
  return String(value || "")
    .trim()
    .replace(/[?#].*$/, "")
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
    .replace(/^Notebook\/+/, "")
    .replace(/\/+/g, "/");
}

function samePath(a, b) {
  return normalizePath(a) === normalizePath(b);
}

function activeEditorPath() {
  const state = window.NodevisionState || {};
  return normalizePath(
    state.activeEditorFilePath ||
    window.__nvCodeEditorActivePath ||
    window.__nvMarkdownActivePath ||
    window.__nvWysiwygActivePath ||
    window.__nvHtmlEditorActivePath ||
    window.__nvSvgEditorActivePath ||
    window.currentActiveFilePath ||
    ""
  );
}

function isCodeEditorOpen() {
  return Boolean(
    window.__nvCodeEditorActivePath ||
    window.monacoEditor ||
    document.querySelector('[data-id="CodeEditorPanel"]')
  );
}

function isGraphicalEditorOpen() {
  const state = window.NodevisionState || {};
  return Boolean(
    state.activePanelType === "GraphicalEditor" ||
    document.getElementById("graphical-editor") ||
    document.querySelector('[data-id="GraphicalEditor"]')
  );
}

function activeEditorIsDirty(nextPath = "", options = {}) {
  const editorPath = activeEditorPath();
  const guardSamePath = options.guardSamePath === true;
  if (!editorPath || (!guardSamePath && samePath(editorPath, nextPath))) return false;

  if (isCodeEditorOpen() && Boolean(window.__nvCodeEditorDirty)) return true;

  if (isGraphicalEditorOpen()) {
    return Boolean(window.NodevisionState?.fileIsDirty);
  }

  return false;
}

function ensurePrompt() {
  return promptEl ||= createEditorSwitchPrompt();
}

async function saveActiveEditor(path, target = null) {
  target?.activate?.();
  if (!path) throw new Error("No active editor file path.");
  const saved = await saveFile({ path, graphicalEditor: Boolean(target) });
  if (!saved) throw new Error("Save failed.");
  if (!target) window.__nvCodeEditorDirty = false;
  if (window.NodevisionState) window.NodevisionState.fileIsDirty = false;
  updateToolbarState({ fileIsDirty: false });
  return true;
}

async function proceedWithSwitch(nextPath, proceed) {
  await proceed?.();
  window.dispatchEvent(new CustomEvent("nodevision-editor-file-switch-accepted", {
    detail: { filePath: nextPath },
  }));
}

export function guardFileSwitch(nextPath, proceed, options = {}) {
  // Freeze the destination while a save/switch is in flight.
  if (switching) return;
  if (window.__nvFileSwitchGuardBypass) {
    proceed?.();
    return;
  }
  const target = options.graphicalTarget || null;
  const currentPath = target?.filePath || activeEditorPath();
  const graphicalSwitch = target && !samePath(currentPath, nextPath);
  if (!graphicalSwitch && !activeEditorIsDirty(nextPath, options)) {
    proceed?.();
    return;
  }

  queuedSwitch = { nextPath, proceed, currentPath, target };
  const prompt = ensurePrompt();
  prompt.describe(currentPath, nextPath);
  if (promptOpen) return;
  promptOpen = true;
  const hide = () => {
    queuedSwitch = null;
    promptOpen = false;
    prompt.hide();
  };
  const accept = async (save) => {
    if (switching || !queuedSwitch) return;
    const pending = queuedSwitch;
    switching = true;
    prompt.setBusy(true);
    try {
      if (pending.target && !pending.target.isCurrent()) throw new Error("The original editor is no longer active. Cancel and select the file again.");
      if (save) await saveActiveEditor(pending.currentPath, pending.target);
      await proceedWithSwitch(pending.nextPath, pending.proceed);
      hide();
    } catch (err) {
      prompt.showError(`Could not ${save ? "save and switch" : "switch"}: ${err?.message || err}`);
    } finally {
      switching = false;
      prompt.setBusy(false);
    }
  };
  prompt.show({
    onCancel: hide,
    onDiscard: () => accept(false),
    onSave: () => accept(true),
  });
}


export function guardEditorSwitch(nextPath, proceed) {
  const targetPath = normalizePath(nextPath || activeEditorPath());
  guardFileSwitch(targetPath, proceed, { guardSamePath: true });
}

export function requestNodevisionFileSelection(filePath, options = {}) {
  const nextPath = normalizePath(filePath);
  if (!nextPath) return;
  const selectedIsDirectory = Boolean(options.isDirectory);
  const graphicalTarget = !selectedIsDirectory && options.switchGraphicalEditor
    ? window.__nvGetGraphicalEditorFileSwitchTarget?.() || null
    : null;
  guardFileSwitch(nextPath, async () => {
    if (graphicalTarget && !samePath(graphicalTarget.filePath, nextPath)) {
      await graphicalTarget.switchTo(nextPath);
    }
    try {
      options.beforeSelected?.(nextPath);
    } catch (err) {
      console.warn("[FileSelection] beforeSelected hook failed:", err);
    }
    window.__nvFileSwitchGuardBypass = true;
    window.__nvPendingSelectedFileMetadata = { path: nextPath, isDirectory: selectedIsDirectory };
    try {
      setNodevisionSelectedPath(nextPath, { isDirectory: selectedIsDirectory });
    } finally {
      window.__nvFileSwitchGuardBypass = false;
      if (window.__nvPendingSelectedFileMetadata?.path === nextPath) {
        window.__nvPendingSelectedFileMetadata = null;
      }
    }
    window.NodevisionState = window.NodevisionState || {};
    await options.onSelected?.(nextPath);
  }, { graphicalTarget });
}

export function installEditorSwitchGuard() {
  installNodevisionSelectionCompatibility();
  window.__nvGuardFileSwitch = guardFileSwitch;
  window.__nvGuardEditorSwitch = guardEditorSwitch;
  window.requestNodevisionFileSelection = requestNodevisionFileSelection;
}

if (typeof window !== "undefined") {
  installEditorSwitchGuard();
}
