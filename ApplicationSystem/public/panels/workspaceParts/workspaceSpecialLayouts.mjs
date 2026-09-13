// Nodevision/ApplicationSystem/public/panels/workspaceParts/workspaceSpecialLayouts.mjs
// This module builds the specialized directory component editing workspace for selected Notebook directories.

import { setStatus } from "../../StatusBar.mjs";
import { closePanelTabsInCell } from "../panelTabs.mjs";
import { activatePanelCell, highlightActiveCell } from "./workspaceActivePanels.mjs";
import { isEditorPanelRequest } from "./workspaceActiveFile.mjs";
import { makePanelCell } from "./workspaceCells.mjs";
import { rebuildLayoutDividersForContainer } from "./workspaceDividers.mjs";
import { ensurePanelEdgeSplitHandles } from "./workspaceEdgeHandles.mjs";
import { loadPanelIntoSpecificCell } from "./workspacePanelLoader.mjs";
import { createNotebookFile, joinNotebookPath, normalizeNotebookPath, notebookFileExists, refreshNavigatorsForDirectory, sameNotebookPath } from "./workspacePaths.mjs";
import { createPanelRow, resolvePanelCell, setCellIdentity } from "./workspacePrimitives.mjs";

function selectedDirectoryPathFromFileManagerDom() {
  const selected = document.querySelector("#file-list a.selected[data-is-directory=\"true\"], #file-list a.folder.selected[data-is-directory=\"true\"]");
  return normalizeNotebookPath(selected?.dataset?.fullPath || "");
}

export function selectedDirectoryPathForEditorRequest(detail = {}) {
  const panelVars = detail?.panelVars || {};
  const explicitDirectory = normalizeNotebookPath(panelVars.directoryPath || detail.directoryPath || "");
  if (explicitDirectory) return explicitDirectory;
  const pending = window.__nvPendingSelectedFileMetadata;
  if (pending?.isDirectory && pending.path) return normalizeNotebookPath(pending.path);
  const state = window.NodevisionState || {};
  const selectedPath = normalizeNotebookPath(state.selectedFile || window.selectedFilePath || "");
  if (state.selectedFileIsDirectory && selectedPath) return selectedPath;
  const requestedPath = normalizeNotebookPath(panelVars.filePath || detail.filePath || "");
  const domDirectory = selectedDirectoryPathFromFileManagerDom();
  if (requestedPath && domDirectory && sameNotebookPath(requestedPath, domDirectory)) return domDirectory;
  if (domDirectory && selectedPath && sameNotebookPath(selectedPath, domDirectory)) return domDirectory;
  return domDirectory && !selectedPath ? domDirectory : "";
}

export function shouldOpenDirectoryEditingWorkspace(detail = {}, panelId = "", panelClass = "") {
  if (detail?.__nvDirectoryEditingWorkspace) return false;
  if (!isEditorPanelRequest(panelId, panelClass)) return false;
  return Boolean(selectedDirectoryPathForEditorRequest(detail));
}

function cleanupSinglePanelCell(cell) {
  if (!cell) return;
  closePanelTabsInCell(cell, { force: true });
  if (typeof cell.cleanup === "function") {
    try { cell.cleanup(); } catch (err) { console.warn("Panel cleanup failed before directory workspace replacement:", err); }
  }
  cell.cleanup = null;
  cell.innerHTML = "";
}

function prepareDirectoryEditingCell(cell, { id, component, flex = "1 1 0px" } = {}) {
  if (!cell) return cell;
  cleanupSinglePanelCell(cell);
  Object.assign(cell.style, { border: "1px solid #bbb", background: "#fafafa", overflow: "auto", flex, display: "flex", flexDirection: "column", position: "relative", minHeight: "0", minWidth: "0", userSelect: "none" });
  setCellIdentity(cell, { id, panelClass: "EditorPanel", flex });
  cell.dataset.nvDirectoryEditingComponent = component || id || "component";
  ensurePanelEdgeSplitHandles(cell);
  return cell;
}

function directoryEditingComponentLabel(pathValue = "") {
  const clean = normalizeNotebookPath(pathValue);
  return clean.split("/").filter(Boolean).pop() || clean || "file";
}

function createDirectoryPlaceholderButton(label, onClick) {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  Object.assign(button.style, { appearance: "none", border: "1px solid #1d4ed8", borderRadius: "6px", background: "#1f6feb", color: "#fff", font: "600 13px/1.2 system-ui,-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif", padding: "9px 12px", cursor: "pointer" });
  button.addEventListener("click", onClick);
  return button;
}

function renderDirectoryComponentPlaceholder(cell, { title, detail, createTargets = [], onCreated } = {}) {
  if (!cell) return;
  cleanupSinglePanelCell(cell);
  const shell = document.createElement("div");
  Object.assign(shell.style, { minHeight: "100%", display: "grid", placeItems: "center", padding: "16px", boxSizing: "border-box", background: "#f8fafc", color: "#172026", font: "13px/1.4 system-ui,-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif", textAlign: "center" });
  const content = document.createElement("div");
  Object.assign(content.style, { display: "flex", flexDirection: "column", gap: "10px", alignItems: "center", maxWidth: "260px" });
  const heading = document.createElement("div");
  heading.textContent = title || "No file exists";
  Object.assign(heading.style, { fontWeight: "700" });
  content.appendChild(heading);
  if (detail) {
    const copy = document.createElement("div");
    copy.textContent = detail;
    Object.assign(copy.style, { color: "#475569" });
    content.appendChild(copy);
  }
  const actions = document.createElement("div");
  Object.assign(actions.style, { display: "flex", gap: "8px", justifyContent: "center", flexWrap: "wrap" });
  for (const target of createTargets) {
    const targetPath = normalizeNotebookPath(target.path || "");
    if (!targetPath) continue;
    const initialLabel = target.label || `Create ${directoryEditingComponentLabel(targetPath)}`;
    actions.appendChild(createDirectoryPlaceholderButton(initialLabel, async (event) => {
      const button = event.currentTarget;
      button.disabled = true;
      button.textContent = "Creating...";
      try {
        await createNotebookFile(targetPath);
        await refreshNavigatorsForDirectory(target.directoryPath || "");
        await onCreated?.(targetPath);
      } catch (err) {
        console.error("[DirectoryEditing] Failed to create component:", err);
        button.disabled = false;
        button.textContent = initialLabel;
        setStatus("Directory editing", "Create failed: " + (err?.message || err));
      }
    }));
  }
  if (actions.childElementCount) content.appendChild(actions);
  shell.appendChild(content);
  cell.appendChild(shell);
  ensurePanelEdgeSplitHandles(cell);
}

async function loadDirectoryComponentEditor(cell, panelType, filePath, displayName) {
  const cleanPath = normalizeNotebookPath(filePath);
  if (!cell || !cleanPath) return null;
  prepareDirectoryEditingCell(cell, { id: panelType, component: displayName || directoryEditingComponentLabel(cleanPath), flex: cell.style.flex || "1 1 0px" });
  cell.dataset.currentFilePath = cleanPath;
  return loadPanelIntoSpecificCell(cell, panelType, { id: panelType, displayName: displayName || directoryEditingComponentLabel(cleanPath), panelClass: "EditorPanel", filePath: cleanPath });
}

async function resolveDirectoryImageComponent(directoryPath) {
  const svgPath = joinNotebookPath(directoryPath, "directory.svg");
  if (await notebookFileExists(svgPath)) return svgPath;
  const pngPath = joinNotebookPath(directoryPath, "directory.png");
  return await notebookFileExists(pngPath) ? pngPath : "";
}

async function renderDirectoryIndexComponent(cell, directoryPath) {
  const indexPath = joinNotebookPath(directoryPath, "index.html");
  if (await notebookFileExists(indexPath)) return loadDirectoryComponentEditor(cell, "GraphicalEditor", indexPath, "index.html");
  renderDirectoryComponentPlaceholder(cell, { title: "No index.html exists", detail: "Create the directory presentation document.", createTargets: [{ path: indexPath, directoryPath, label: "Create index.html" }], onCreated: (createdPath) => loadDirectoryComponentEditor(cell, "GraphicalEditor", createdPath, "index.html") });
  setStatus("Directory editing", "Missing: " + indexPath);
  return null;
}

async function renderDirectoryImageComponent(cell, directoryPath) {
  const imagePath = await resolveDirectoryImageComponent(directoryPath);
  if (imagePath) return loadDirectoryComponentEditor(cell, "GraphicalEditor", imagePath, directoryEditingComponentLabel(imagePath));
  const svgPath = joinNotebookPath(directoryPath, "directory.svg");
  const pngPath = joinNotebookPath(directoryPath, "directory.png");
  renderDirectoryComponentPlaceholder(cell, { title: "No directory image exists", detail: "Create directory.svg or directory.png.", createTargets: [{ path: svgPath, directoryPath, label: "Create directory.svg" }, { path: pngPath, directoryPath, label: "Create directory.png" }], onCreated: (createdPath) => loadDirectoryComponentEditor(cell, "GraphicalEditor", createdPath, directoryEditingComponentLabel(createdPath)) });
  setStatus("Directory editing", "Missing: directory.svg or directory.png");
  return null;
}

async function renderDirectoryCssComponent(cell, directoryPath) {
  const cssPath = joinNotebookPath(directoryPath, "directory.css");
  if (await notebookFileExists(cssPath)) return loadDirectoryComponentEditor(cell, "CodeEditor", cssPath, "directory.css");
  renderDirectoryComponentPlaceholder(cell, { title: "No directory.css exists", detail: "Create the directory stylesheet without overwriting an existing one.", createTargets: [{ path: cssPath, directoryPath, label: "Create directory.css" }], onCreated: (createdPath) => loadDirectoryComponentEditor(cell, "CodeEditor", createdPath, "directory.css") });
  setStatus("Directory editing", "Missing: " + cssPath);
  return null;
}

export async function openDirectoryEditingWorkspace(directoryPath, options = {}) {
  const cleanDirectory = normalizeNotebookPath(directoryPath).replace(/\/+$/, "");
  if (!cleanDirectory) return null;
  const originCell = resolvePanelCell(options.originCell || window.activeCell) || document.querySelector(".panel-cell.active-panel");
  const parent = originCell?.parentElement;
  if (!originCell || !parent) {
    alert("Please click a panel before opening the directory editor.");
    return null;
  }
  const splitContainer = createPanelRow("row", originCell.style.flex || "1 1 0");
  splitContainer.dataset.nvDirectoryEditingWorkspace = "1";
  splitContainer.dataset.nvDirectoryPath = cleanDirectory;
  parent.replaceChild(splitContainer, originCell);
  const equalFlex = "1 1 0px";
  const indexCell = prepareDirectoryEditingCell(originCell, { id: "GraphicalEditor", component: "index.html", flex: equalFlex });
  const imageCell = prepareDirectoryEditingCell(makePanelCell(equalFlex), { id: "GraphicalEditor", component: "directory-image", flex: equalFlex });
  const cssCell = prepareDirectoryEditingCell(makePanelCell(equalFlex), { id: "CodeEditor", component: "directory.css", flex: equalFlex });
  splitContainer.append(indexCell, imageCell, cssCell);
  rebuildLayoutDividersForContainer(splitContainer, false);
  rebuildLayoutDividersForContainer(parent);
  window.NodevisionState = { ...(window.NodevisionState || {}), directoryEditingPath: cleanDirectory, selectedDirectory: cleanDirectory, selectedFile: cleanDirectory, selectedFileIsDirectory: true };
  await renderDirectoryIndexComponent(indexCell, cleanDirectory);
  await renderDirectoryImageComponent(imageCell, cleanDirectory);
  await renderDirectoryCssComponent(cssCell, cleanDirectory);
  window.NodevisionState.directoryEditingPath = cleanDirectory;
  window.NodevisionState.selectedDirectory = cleanDirectory;
  setStatus("Directory editing", cleanDirectory);
  activatePanelCell(indexCell, { announce: false });
  highlightActiveCell(indexCell);
  return { splitContainer, indexCell, imageCell, cssCell, directoryPath: cleanDirectory };
}

window.openDirectoryEditingWorkspace = openDirectoryEditingWorkspace;
