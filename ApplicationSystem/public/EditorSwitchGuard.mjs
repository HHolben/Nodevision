// Nodevision/ApplicationSystem/public/EditorSwitchGuard.mjs
// Shared unsaved-change guard for switching the active file from file/graph managers.

import saveFile from "/ToolbarCallbacks/file/saveFile.mjs";
import { updateToolbarState } from "/panels/createToolbar.mjs";

let promptEl = null;
let promptOpen = false;
let queuedSwitch = null;

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
  return normalizePath(a).toLowerCase() === normalizePath(b).toLowerCase();
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

function activeEditorIsDirty(nextPath = "") {
  const editorPath = activeEditorPath();
  if (!editorPath || samePath(editorPath, nextPath)) return false;

  if (isCodeEditorOpen() && Boolean(window.__nvCodeEditorDirty)) return true;

  if (isGraphicalEditorOpen()) {
    return Boolean(window.NodevisionState?.fileIsDirty);
  }

  return false;
}

function ensurePrompt() {
  if (promptEl) return promptEl;

  const backdrop = document.createElement("div");
  Object.assign(backdrop.style, {
    position: "fixed",
    inset: "0",
    background: "rgba(0,0,0,0.35)",
    display: "none",
    zIndex: "1199",
  });

  const panel = document.createElement("div");
  panel.className = "panel overlay";
  panel.dataset.instanceName = "UnsavedPrompt";
  panel.dataset.panelClass = "InfoPanel";
  Object.assign(panel.style, {
    position: "fixed",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    width: "min(360px, calc(100vw - 32px))",
    background: "#fff",
    border: "1px solid #9aa7b0",
    borderRadius: "8px",
    boxShadow: "0 18px 44px rgba(0,0,0,0.28)",
    padding: "16px",
    display: "none",
    flexDirection: "column",
    gap: "12px",
    zIndex: "1200",
    color: "#172026",
    font: "13px/1.4 system-ui, sans-serif",
  });

  const message = document.createElement("div");
  message.textContent = "Do you want to save your changes?";
  message.style.fontWeight = "650";

  const buttons = document.createElement("div");
  Object.assign(buttons.style, {
    display: "flex",
    justifyContent: "flex-end",
    gap: "8px",
    flexWrap: "wrap",
  });

  const makeButton = (label) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    Object.assign(button.style, {
      border: "1px solid #aebbc4",
      borderRadius: "6px",
      background: "#f7fafb",
      color: "#1d2e38",
      minHeight: "30px",
      padding: "5px 10px",
      font: "inherit",
      cursor: "pointer",
    });
    return button;
  };

  const cancelBtn = makeButton("Cancel");
  const discardBtn = makeButton("Don't Save");
  const saveBtn = makeButton("Save");
  buttons.append(cancelBtn, discardBtn, saveBtn);
  panel.append(message, buttons);
  document.body.append(backdrop, panel);

  promptEl = {
    backdrop,
    panel,
    cancelBtn,
    discardBtn,
    saveBtn,
    show(handlers) {
      cancelBtn.onclick = handlers.onCancel;
      discardBtn.onclick = handlers.onDiscard;
      saveBtn.onclick = handlers.onSave;
      backdrop.style.display = "block";
      panel.style.display = "flex";
      promptOpen = true;
      saveBtn.focus?.();
    },
    hide() {
      backdrop.style.display = "none";
      panel.style.display = "none";
      promptOpen = false;
    },
  };

  return promptEl;
}

async function saveActiveEditor() {
  const path = activeEditorPath();
  if (!path) throw new Error("No active editor file path.");
  const saved = await saveFile({ path });
  if (!saved) throw new Error("Save failed.");
  window.__nvCodeEditorDirty = false;
  if (window.NodevisionState) window.NodevisionState.fileIsDirty = false;
  updateToolbarState({ fileIsDirty: false });
  return true;
}

function proceedWithSwitch(nextPath, proceed) {
  queuedSwitch = null;
  proceed?.();
  window.dispatchEvent(new CustomEvent("nodevision-editor-file-switch-accepted", {
    detail: { filePath: nextPath },
  }));
}

export function guardFileSwitch(nextPath, proceed) {
  if (window.__nvFileSwitchGuardBypass) {
    proceed?.();
    return;
  }

  if (!activeEditorIsDirty(nextPath)) {
    proceed?.();
    return;
  }

  queuedSwitch = { nextPath, proceed };
  if (promptOpen) return;

  const prompt = ensurePrompt();
  prompt.show({
    onCancel: () => {
      queuedSwitch = null;
      prompt.hide();
    },
    onDiscard: () => {
      const pending = queuedSwitch;
      prompt.hide();
      if (pending) proceedWithSwitch(pending.nextPath, pending.proceed);
    },
    onSave: async () => {
      try {
        await saveActiveEditor();
        const pending = queuedSwitch;
        prompt.hide();
        if (pending) proceedWithSwitch(pending.nextPath, pending.proceed);
      } catch (err) {
        alert(`Save failed: ${err?.message || err}`);
      }
    },
  });
}

export function requestNodevisionFileSelection(filePath, options = {}) {
  const nextPath = normalizePath(filePath);
  if (!nextPath) return;
  guardFileSwitch(nextPath, () => {
    window.__nvFileSwitchGuardBypass = true;
    try {
      window.selectedFilePath = nextPath;
    } finally {
      window.__nvFileSwitchGuardBypass = false;
    }
    options.onSelected?.(nextPath);
  });
}

export function installEditorSwitchGuard() {
  window.__nvGuardFileSwitch = guardFileSwitch;
  window.requestNodevisionFileSelection = requestNodevisionFileSelection;
}

if (typeof window !== "undefined") {
  installEditorSwitchGuard();
}
