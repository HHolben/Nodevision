// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/CodeEditorParts/ShowCommonVarOverlay.mjs
// This module implements show common var overlay operations for CodeEditor, preserving the existing document and instance ownership contracts.

import { ensureCommonVarOverlay, refreshCommonVarOverlay } from "./DetectLanguage.mjs";
import { moduleState, CODE_EDITOR_LIVE_PROVIDER_ID } from "./ModuleState.mjs";
import { recordEditedFile } from "/RecentFiles.mjs";
import { touchLiveFileContentProvider } from "/LiveFileContent.mjs";

export function showCommonVarOverlay() {
  ensureCommonVarOverlay();
  refreshCommonVarOverlay();
  moduleState.commonVarOverlay.style.display = "block";
}

export function updateDirtyState() {
  const model = moduleState.editorInstance?.getModel?.();
  if (!model) return;
  const currentId = model.getAlternativeVersionId?.();
  window.__nvCodeEditorDirty = moduleState.savedVersionId !== null && currentId !== moduleState.savedVersionId;
  const session = moduleState.editorContainer?.__nvCodeEditorSession || moduleState.editorInstanceContainer?.__nvCodeEditorSession;
  if (session?.editor === moduleState.editorInstance) session.dirty = window.__nvCodeEditorDirty;
  if (window.__nvCodeEditorDirty) {
    recordEditedFile(window.__nvCodeEditorActivePath || moduleState.lastEditedPath || window.currentActiveFilePath);
  }
}

export function markEditorClean() {
  const model = moduleState.editorInstance?.getModel?.();
  if (!model) return;
  moduleState.savedVersionId = model.getAlternativeVersionId?.() || null;
  const session = moduleState.editorContainer?.__nvCodeEditorSession || moduleState.editorInstanceContainer?.__nvCodeEditorSession;
  if (session?.editor === moduleState.editorInstance) {
    session.savedVersionId = moduleState.savedVersionId;
    session.dirty = false;
  }
  window.__nvCodeEditorDirty = false;
  touchLiveFileContentProvider(CODE_EDITOR_LIVE_PROVIDER_ID, {
    filePath: window.__nvCodeEditorActivePath || moduleState.lastEditedPath || window.currentActiveFilePath || "",
    reason: "clean",
  });
}

export function ensureUnsavedPrompt() {
  if (moduleState.unsavedPromptEl) return moduleState.unsavedPromptEl;
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
    top: `${Math.max(56, (window.__nvGlobalToolbarHeight || 64))}px`,
    left: "50%",
    transform: "translateX(-50%)",
    width: "min(520px, 92vw)",
    maxHeight: "80vh",
    zIndex: "1200",
    display: "flex",
    flexDirection: "column",
    boxShadow: "0 14px 40px rgba(0,0,0,0.3)",
  });

  const header = document.createElement("div");
  header.className = "panel-header";
  header.textContent = "Unsaved changes";
  header.style.display = "flex";
  header.style.justifyContent = "space-between";
  header.style.alignItems = "center";
  header.style.padding = "8px 10px";
  header.style.background = "#e2e8f0";
  header.style.fontWeight = "700";

  const closeBtn = document.createElement("button");
  closeBtn.textContent = "×";
  Object.assign(closeBtn.style, {
    border: "none",
    background: "transparent",
    fontSize: "16px",
    cursor: "pointer",
  });
  header.appendChild(closeBtn);

  const content = document.createElement("div");
  content.className = "panel-content";
  Object.assign(content.style, {
    padding: "14px 14px 10px",
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  });

  const message = document.createElement("div");
  message.id = "nv-unsaved-message";
  message.style.fontSize = "14px";
  content.appendChild(message);

  const buttons = document.createElement("div");
  Object.assign(buttons.style, {
    display: "flex",
    gap: "10px",
    justifyContent: "flex-end",
    marginTop: "4px",
  });
  const cancelBtn = document.createElement("button");
  cancelBtn.textContent = "Cancel";
  const discardBtn = document.createElement("button");
  discardBtn.textContent = "Discard";
  const saveBtn = document.createElement("button");
  saveBtn.textContent = "Save";
  [cancelBtn, discardBtn, saveBtn].forEach((btn) => {
    Object.assign(btn.style, {
      padding: "9px 14px",
      borderRadius: "8px",
      border: "1px solid #cbd5e1",
      background: "#fff",
      cursor: "pointer",
      fontWeight: "600",
    });
  });
  saveBtn.style.background = "#2563eb";
  saveBtn.style.color = "#fff";
  buttons.append(cancelBtn, discardBtn, saveBtn);
  content.appendChild(buttons);

  panel.appendChild(header);
  panel.appendChild(content);

  const mount = document.body;
  mount.appendChild(backdrop);
  mount.appendChild(panel);

  moduleState.unsavedPromptEl = panel;
  panel._backdrop = backdrop;
  panel._setHandlers = (handlers = {}) => {
    const close = () => panel._hide();
    closeBtn.onclick = handlers.onCancel || close;
    cancelBtn.onclick = handlers.onCancel || close;
    discardBtn.onclick = handlers.onDiscard || close;
    saveBtn.onclick = handlers.onSave || close;
  };
  panel._setMessage = (text) => {
    message.textContent = text;
  };
  panel._show = () => {
    backdrop.style.display = "block";
    panel.style.display = "flex";
    moduleState.unsavedPromptOpen = true;
  };
  panel._hide = () => {
    backdrop.style.display = "none";
    panel.style.display = "none";
    moduleState.unsavedPromptOpen = false;
  };
  return panel;
}
