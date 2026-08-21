// Nodevision/ApplicationSystem/public/ToolbarCallbacks/insert/insertLink.mjs
// This file defines browser-side insert Link logic for the Nodevision UI. It renders interface components and handles user interactions.

import { saveFoundEdge } from "../../PanelInstances/InfoPanels/GraphManagerDependencies/SaveFoundEdge.mjs";
import { createFileManager } from "../../PanelInstances/InfoPanels/FileManagerDependencies.mjs/FileManagerController.mjs";
import { syncPortalForHyperlink } from "../../LinkPortalParity.mjs";
import { getNodevisionNavigationState } from "../../NodevisionNavigationState.mjs";
import { getRelativeNotebookReference, normalizeNotebookFilePath, toNotebookAssetUrl } from "../../utils/notebookPath.mjs";

const navigationState = getNodevisionNavigationState();

function normalizeNotebookPath(input = "") {
  return normalizeNotebookFilePath(input);
}

function getCurrentEditorSourcePath() {
  const candidates = [
    window.NodevisionState?.activeEditorFilePath,
    window.__nvWysiwygActivePath,
    window.__nvHtmlEditorActivePath,
    window.currentActiveFilePath,
    window.selectedFilePath,
    window.filePath,
    window.NodevisionState?.selectedFile,
  ];

  for (const value of candidates) {
    const normalized = normalizeNotebookPath(value || "");
    if (normalized) return normalized;
  }
  return "";
}

function toRelativeNotebookHref(sourcePath = "", targetPath = "", options = {}) {
  const source = normalizeNotebookPath(sourcePath);
  const target = normalizeNotebookPath(targetPath);
  if (!target) return "";
  const href = !source || source.startsWith("__epub_virtual__/")
    ? toNotebookAssetUrl(target)
    : getRelativeNotebookReference({ sourcePath: source, targetPath: target });
  return options.isDirectory && href && !href.endsWith("/") ? href + "/" : href;
}

function cloneSelectionRangeInsideEditor(wysiwyg) {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount <= 0) return null;
  const range = sel.getRangeAt(0);
  if (!wysiwyg.contains(range.startContainer) || !wysiwyg.contains(range.endContainer)) return null;
  return range.cloneRange();
}

function restoreSelectionRange(range) {
  if (!range) return false;
  const sel = window.getSelection();
  if (!sel) return false;
  sel.removeAllRanges();
  sel.addRange(range);
  return true;
}

function ensureSelectionRangeInsideEditor(wysiwyg) {
  const sel = window.getSelection();
  if (!sel) return null;
  if (sel.rangeCount > 0) {
    const range = sel.getRangeAt(0);
    if (wysiwyg.contains(range.startContainer) && wysiwyg.contains(range.endContainer)) {
      return range;
    }
  }
  const fallback = document.createRange();
  fallback.selectNodeContents(wysiwyg);
  fallback.collapse(false);
  sel.removeAllRanges();
  sel.addRange(fallback);
  return fallback;
}

function showLinkTypeDialog() {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,.35);z-index:32000;display:flex;align-items:center;justify-content:center;";

    const box = document.createElement("div");
    box.style.cssText = "width:min(420px,92vw);background:#fff;border:1px solid #888;border-radius:8px;padding:14px;font:13px monospace;";
    box.innerHTML = "<div style='font-weight:700;margin-bottom:10px;'>Insert Link</div><div style='margin-bottom:12px;'>Choose link source:</div>";

    const actions = document.createElement("div");
    actions.style.cssText = "display:flex;gap:8px;justify-content:flex-end;";
    const localBtn = document.createElement("button");
    localBtn.textContent = "Local File";
    const externalBtn = document.createElement("button");
    externalBtn.textContent = "Hyperlink URL";
    const internalBtn = document.createElement("button");
    internalBtn.textContent = "Notebook File";
    const cancelBtn = document.createElement("button");
    cancelBtn.textContent = "Cancel";

    [localBtn, externalBtn, internalBtn, cancelBtn].forEach((btn) => {
      btn.style.cssText = "padding:6px 10px;border:1px solid #777;background:#f6f6f6;cursor:pointer;";
      actions.appendChild(btn);
    });
    box.appendChild(actions);
    overlay.appendChild(box);
    document.body.appendChild(overlay);

    const finish = (value) => {
      overlay.remove();
      resolve(value);
    };
    localBtn.onclick = () => finish("local");
    internalBtn.onclick = () => finish("internal");
    externalBtn.onclick = () => finish("external");
    cancelBtn.onclick = () => finish(null);
    overlay.onclick = (evt) => {
      if (evt.target === overlay) finish(null);
    };
  });
}

function showManagerSubToolbar(panelType = "GraphManager") {
  const heading = panelType === "FileManager" ? "File Manager" : "Graph Manager";
  window.dispatchEvent(new CustomEvent("nv-show-subtoolbar", {
    detail: { heading, force: true, toggle: false }
  }));
}


function makePickerButton(label, primary = false) {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  Object.assign(button.style, {
    border: primary ? "1px solid #1d4ed8" : "1px solid #94a3b8",
    borderRadius: "6px",
    background: primary ? "#2563eb" : "#f8fafc",
    color: primary ? "#ffffff" : "#1e293b",
    minHeight: "32px",
    padding: "6px 12px",
    font: "12px system-ui, sans-serif",
    cursor: "pointer"
  });
  return button;
}

function setButtonDisabled(button, disabled) {
  if (!button) return;
  button.disabled = Boolean(disabled);
  button.style.opacity = disabled ? "0.48" : "1";
  button.style.cursor = disabled ? "not-allowed" : "pointer";
}

function showNotebookFileManagerOverlay() {
  return new Promise((resolve) => {
    let selectedPath = "";
    let selectedIsDirectory = false;
    let currentDirectory = normalizeNotebookPath(navigationState.getSearchRoot?.() || window.currentDirectoryPath || "");

    const overlay = document.createElement("div");
    overlay.dataset.nvLinkFileManagerOverlay = "true";
    Object.assign(overlay.style, {
      position: "fixed",
      inset: "0",
      background: "rgba(15, 23, 42, 0.42)",
      zIndex: "32000",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "18px",
      boxSizing: "border-box"
    });

    const box = document.createElement("div");
    Object.assign(box.style, {
      width: "min(760px, 96vw)",
      height: "min(720px, 92vh)",
      minHeight: "420px",
      display: "flex",
      flexDirection: "column",
      background: "#ffffff",
      border: "1px solid #94a3b8",
      borderRadius: "8px",
      boxShadow: "0 22px 54px rgba(15, 23, 42, 0.32)",
      color: "#172033",
      overflow: "hidden",
      font: "13px system-ui, sans-serif"
    });

    const header = document.createElement("div");
    Object.assign(header.style, {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: "12px",
      padding: "10px 12px",
      borderBottom: "1px solid #d7dde8",
      background: "#f8fafc",
      flex: "0 0 auto"
    });

    const title = document.createElement("div");
    title.textContent = "Select Notebook Link Target";
    title.style.cssText = "font-weight:700;font-size:13px;";
    const closeX = makePickerButton("Close");
    header.append(title, closeX);

    const managerShell = document.createElement("div");
    managerShell.style.cssText = "flex:1 1 auto;min-height:0;display:flex;";
    managerShell.innerHTML = "<div class=\"file-manager nv-link-file-manager\"><h3>File Manager</h3><div id=\"loading\" style=\"display:none;\">Loading...</div><div id=\"error\"></div><ul id=\"file-list\" class=\"file-list\"></ul><div id=\"fm-path\"></div></div>";

    const footer = document.createElement("div");
    Object.assign(footer.style, {
      flex: "0 0 auto",
      display: "grid",
      gridTemplateColumns: "minmax(0, 1fr) auto auto auto",
      alignItems: "center",
      gap: "8px",
      padding: "10px 12px",
      borderTop: "1px solid #d7dde8",
      background: "#f8fafc"
    });

    const selectedLabel = document.createElement("div");
    selectedLabel.textContent = "Select a Notebook file or folder.";
    selectedLabel.style.cssText = "min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#475569;font-size:12px;";
    const currentFolderBtn = makePickerButton("Use Current Folder");
    const cancelBtn = makePickerButton("Cancel");
    const selectBtn = makePickerButton("Select", true);
    footer.append(selectedLabel, currentFolderBtn, cancelBtn, selectBtn);

    box.append(header, managerShell, footer);
    overlay.appendChild(box);
    document.body.appendChild(overlay);

    const updateSelectionDisplay = () => {
      selectedLabel.textContent = selectedPath
        ? (selectedIsDirectory ? "Folder selected: " : "File selected: ") + selectedPath
        : "Select a Notebook file or folder.";
      setButtonDisabled(selectBtn, !selectedPath);
    };

    const finish = (value = null) => {
      window.removeEventListener("keydown", handleKeydown, true);
      overlay.remove();
      resolve(value?.path ? { path: normalizeNotebookPath(value.path), isDirectory: Boolean(value.isDirectory) } : null);
    };

    function handleKeydown(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        finish(null);
      }
      if (event.key === "Enter" && selectedPath) {
        event.preventDefault();
        finish({ path: selectedPath, isDirectory: selectedIsDirectory });
      }
    }

    createFileManager(managerShell, currentDirectory, {
      onDirectoryChange: ({ path }) => {
        currentDirectory = normalizeNotebookPath(path || "");
        selectedPath = "";
        selectedIsDirectory = false;
        navigationState.setLastOpenedDirectory?.(currentDirectory, "FileManager");
        setButtonDisabled(currentFolderBtn, !currentDirectory);
        updateSelectionDisplay();
      },
      onSelectionChange: ({ path, isDirectory }) => {
        selectedPath = normalizeNotebookPath(path || "");
        selectedIsDirectory = Boolean(isDirectory);
        navigationState.setLastFileSelectionPanelType?.("FileManager");
        updateSelectionDisplay();
      },
      onEntryActivate: ({ path, isDirectory }) => {
        const cleanPath = normalizeNotebookPath(path || "");
        if (cleanPath) finish({ path: cleanPath, isDirectory: Boolean(isDirectory) });
      },
      enableDragDrop: false
    });

    closeX.addEventListener("click", () => finish(null));
    cancelBtn.addEventListener("click", () => finish(null));
    selectBtn.addEventListener("click", () => {
      if (selectedPath) finish({ path: selectedPath, isDirectory: selectedIsDirectory });
    });
    currentFolderBtn.addEventListener("click", () => {
      if (currentDirectory) finish({ path: currentDirectory, isDirectory: true });
    });
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) finish(null);
    });
    window.addEventListener("keydown", handleKeydown, true);

    setButtonDisabled(selectBtn, true);
    setButtonDisabled(currentFolderBtn, !currentDirectory);
  });
}

async function chooseInternalNotebookTarget() {
  showManagerSubToolbar("FileManager");
  return showNotebookFileManagerOverlay();
}

function chooseLocalFile() {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.style.position = "fixed";
    input.style.left = "-2000px";
    document.body.appendChild(input);
    input.addEventListener("change", () => {
      const file = input.files?.[0] || null;
      input.remove();
      resolve(file);
    }, { once: true });
    input.click();
  });
}

async function uploadLocalFileToNotebook(file) {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch("/api/file/upload-binary", {
    method: "POST",
    body: formData
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok || !payload?.success) {
    throw new Error(payload?.error || `${res.status} ${res.statusText}`);
  }
  return normalizeNotebookPath(payload?.filename || file.name);
}

function insertAnchorAtSelection(wysiwyg, href, linkText, linkType = "external", savedRange = null) {
  const sel = window.getSelection();
  if (!sel) return null;
  restoreSelectionRange(savedRange);
  const range = ensureSelectionRangeInsideEditor(wysiwyg);
  if (!range) return null;

  const selectedText = range.toString();
  const resolvedText = linkText || selectedText || href;

  const a = document.createElement("a");
  a.href = href;
  a.textContent = resolvedText;
  a.dataset.nvLinkType = linkType;
  if (linkType === "external") {
    a.target = "_blank";
    a.rel = "noopener noreferrer";
  }

  range.deleteContents();
  range.insertNode(a);

  const spacer = document.createTextNode("\u00A0");
  a.after(spacer);
  sel.removeAllRanges();
  const caret = document.createRange();
  caret.setStart(spacer, 1);
  caret.collapse(true);
  sel.addRange(caret);
  return a;
}

export default async function insertLink() {
  const wysiwyg = document.querySelector("#wysiwyg[contenteditable='true']");
  if (!wysiwyg) {
    console.warn("insertLink: No active HTML WYSIWYG editor found.");
    return;
  }

  wysiwyg.focus();
  const savedRange = cloneSelectionRangeInsideEditor(wysiwyg);
  const linkType = await showLinkTypeDialog();
  if (!linkType) return;

  const sourcePath = getCurrentEditorSourcePath();
  let href = "";
  let edgeTarget = "";

  if (linkType === "internal") {
    let target = null;
    try {
      target = await chooseInternalNotebookTarget();
    } catch (err) {
      console.error("insertLink: Failed to open internal file dialog:", err);
      alert("Failed to load Notebook files for internal link.");
      return;
    }
    if (!target) return;
    edgeTarget = normalizeNotebookPath(target.path || target);
    href = toRelativeNotebookHref(sourcePath, edgeTarget, { isDirectory: Boolean(target.isDirectory) });
  } else if (linkType === "local") {
    let file = null;
    try {
      file = await chooseLocalFile();
    } catch (err) {
      console.error("insertLink: Failed to open local file dialog:", err);
      return;
    }
    if (!file) return;
    try {
      edgeTarget = await uploadLocalFileToNotebook(file);
    } catch (err) {
      console.error("insertLink: Failed to upload local file:", err);
      alert(`Failed to upload local file: ${err.message}`);
      return;
    }
    href = toRelativeNotebookHref(sourcePath, edgeTarget);
  } else {
    const entered = prompt("Enter the hyperlink URL:");
    const trimmed = String(entered || "").trim();
    if (!trimmed) return;
    edgeTarget = trimmed;
    href = trimmed;
  }

  const linkText = prompt(
    "Enter link text (leave blank to use selected text or URL):"
  ) || "";

  const inserted = insertAnchorAtSelection(wysiwyg, href, linkText, linkType, savedRange);
  if (!inserted) {
    console.warn("insertLink: Could not insert link at current selection.");
    return;
  }

  if (sourcePath && edgeTarget) {
    try {
      const persistedLinkText = String(inserted.textContent || linkText || href || edgeTarget || "").trim();
      await saveFoundEdge({
        source: sourcePath,
        target: edgeTarget,
        linkKind: "hyperlink",
        linkProperty: "href",
        linkText: persistedLinkText,
        edgeLabel: persistedLinkText
      });
    } catch (err) {
      console.error("insertLink: Failed to persist graph edge:", err);
    }

    try {
      await syncPortalForHyperlink({ sourcePath, targetPath: edgeTarget });
    } catch (err) {
      console.warn("insertLink: Link / portal parity could not add a portal:", err);
    }
  }
}
