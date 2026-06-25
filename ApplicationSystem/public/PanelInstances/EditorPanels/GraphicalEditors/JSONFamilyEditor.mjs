// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/JSONFamilyEditor.mjs
// Graphical JSON editor that displays JSON files as top-down tree structures.

import {
  resetEditorHooks,
  ensureNodevisionState,
  createBaseLayout,
  fetchText,
  saveText,
} from "./FamilyEditorCommon.mjs";
import {
  formatJsonText,
  parseJsonText,
  renderJsonTree,
} from "/PanelInstances/ViewPanels/FileViewers/jsonTreeRenderer.mjs";
import { updateToolbarState } from "/panels/createToolbar.mjs";

export async function renderEditor(filePath, container) {
  resetEditorHooks();
  ensureNodevisionState("JSONFamilyEditing");
  const { status, body } = createBaseLayout(container, `JSON Tree Editor - ${filePath}`);
  body.style.overflow = "hidden";

  const root = document.createElement("div");
  root.style.cssText = "display:flex;flex-direction:column;height:100%;min-height:0;gap:8px;";
  body.appendChild(root);

  const toolbar = document.createElement("div");
  toolbar.style.cssText = "display:flex;gap:8px;align-items:center;flex-wrap:wrap;";
  toolbar.innerHTML = `
    <button type="button" data-action="tree">Tree</button>
    <button type="button" data-action="raw">Raw JSON</button>
    <button type="button" data-action="apply">Apply Raw to Tree</button>
    <button type="button" data-action="format">Format Raw</button>
    <button type="button" data-action="save">Save</button>
    <span data-field="status" style="font:12px monospace;color:#52606d;"></span>
  `;
  root.appendChild(toolbar);

  const treeHost = document.createElement("div");
  treeHost.style.cssText = "flex:1;min-height:0;overflow:auto;border:1px solid #d8dde6;border-radius:8px;background:#f8fafc;";
  root.appendChild(treeHost);

  const rawEditor = document.createElement("textarea");
  rawEditor.id = "markdown-editor";
  rawEditor.spellcheck = false;
  rawEditor.style.cssText = [
    "display:none",
    "flex:1",
    "min-height:0",
    "resize:none",
    "padding:12px",
    "box-sizing:border-box",
    "font:13px/1.5 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace",
    "border:1px solid #c9c9c9",
    "border-radius:8px",
    "background:#fff",
    "color:#111",
  ].join(";");
  root.appendChild(rawEditor);

  let currentData = {};
  let dirty = false;

  const localStatus = toolbar.querySelector("[data-field=\"status\"]");
  const setEditorStatus = (message, isError = false) => {
    status.textContent = message;
    if (localStatus) {
      localStatus.textContent = message;
      localStatus.style.color = isError ? "#b00020" : "#166534";
    }
  };

  const markDirty = (message = "JSON changed") => {
    dirty = true;
    updateToolbarState({ fileIsDirty: true });
    setEditorStatus(message);
  };

  const syncRawFromTree = () => {
    rawEditor.value = formatJsonText(currentData);
  };

  const renderTree = () => {
    renderJsonTree(treeHost, currentData, {
      filePath,
      editable: true,
      onChange(nextData) {
        currentData = nextData;
        syncRawFromTree();
        renderTree();
        markDirty("Tree updated");
      },
    });
  };

  const showTree = () => {
    treeHost.style.display = "block";
    rawEditor.style.display = "none";
    setEditorStatus(dirty ? "Tree view - unsaved changes" : "Tree view");
  };

  const showRaw = () => {
    syncRawFromTree();
    treeHost.style.display = "none";
    rawEditor.style.display = "block";
    setEditorStatus("Raw JSON view");
  };

  const applyRawToTree = () => {
    try {
      currentData = parseJsonText(rawEditor.value, filePath);
      syncRawFromTree();
      renderTree();
      showTree();
      markDirty("Raw JSON applied to tree");
    } catch (err) {
      setEditorStatus(`Invalid JSON: ${err.message}`, true);
    }
  };

  const formatRaw = () => {
    try {
      rawEditor.value = formatJsonText(parseJsonText(rawEditor.value, filePath));
      setEditorStatus("Raw JSON formatted");
    } catch (err) {
      setEditorStatus(`Format failed: ${err.message}`, true);
    }
  };

  const getText = () => {
    if (rawEditor.style.display !== "none") {
      currentData = parseJsonText(rawEditor.value, filePath);
      syncRawFromTree();
      renderTree();
    }
    return formatJsonText(currentData);
  };

  const save = async (path = filePath) => {
    await saveText(path, getText());
    dirty = false;
    updateToolbarState({ fileIsDirty: false });
    setEditorStatus("JSON saved");
  };

  toolbar.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const action = target.dataset.action;
    if (action === "tree") showTree();
    if (action === "raw") showRaw();
    if (action === "apply") applyRawToTree();
    if (action === "format") formatRaw();
    if (action === "save") save().catch((err) => setEditorStatus(`Save failed: ${err.message}`, true));
  });

  rawEditor.addEventListener("input", () => markDirty("Raw JSON edited"));

  try {
    const text = await fetchText(filePath);
    currentData = parseJsonText(text, filePath);
    syncRawFromTree();
    renderTree();

    window.getEditorMarkdown = getText;
    window.saveMDFile = save;

    updateToolbarState({
      currentMode: "JSONFamilyEditing",
      activePanelType: "GraphicalEditor",
      selectedFile: filePath,
      activeEditorFilePath: filePath,
      fileIsDirty: false,
    });
    setEditorStatus("JSON tree loaded");
  } catch (err) {
    treeHost.innerHTML = `<div style="color:#b00020;font:13px monospace;padding:12px;">Failed to load JSON: ${err.message}</div>`;
    setEditorStatus("Load failed", true);
  }
}
