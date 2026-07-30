// Nodevision/ApplicationSystem/public/ToolbarCallbacks/insert/insertLink.mjs
// This file defines browser-side insert Link logic for the Nodevision UI. It renders interface components and handles user interactions.

import { saveFoundEdge } from "../../PanelInstances/InfoPanels/GraphManagerDependencies/SaveFoundEdge.mjs";
import { getNodevisionNavigationState } from "../../NodevisionNavigationState.mjs";

const LINK_PICKER_GRAPH_LIMIT = 2200;
const navigationState = getNodevisionNavigationState();

function normalizeNotebookPath(input = "") {
  return String(input || "")
    .trim()
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
    .replace(/^Notebook\//i, "");
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

function dirname(notebookPath = "") {
  const clean = normalizeNotebookPath(notebookPath);
  const idx = clean.lastIndexOf("/");
  return idx >= 0 ? clean.slice(0, idx) : "";
}

function toRelativeNotebookHref(sourcePath = "", targetPath = "") {
  const source = normalizeNotebookPath(sourcePath);
  const target = normalizeNotebookPath(targetPath);
  if (!target) return "";
  if (!source || source.startsWith("__epub_virtual__/")) {
    return `/Notebook/${target.split("/").map(encodeURIComponent).join("/")}`;
  }

  const fromParts = dirname(source).split("/").filter(Boolean);
  const toParts = target.split("/").filter(Boolean);
  let i = 0;
  while (i < fromParts.length && i < toParts.length && fromParts[i] === toParts[i]) {
    i += 1;
  }
  const up = fromParts.length - i;
  const relParts = [
    ...new Array(Math.max(0, up)).fill(".."),
    ...toParts.slice(i),
  ];
  const rel = relParts.join("/") || target.split("/").pop() || target;
  return encodeURI(rel);
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

function isNotebookDirectoryEntry(entry = {}) {
  return Boolean(entry?.isDirectory || entry?.fileType === "directory" || entry?.type === "directory");
}

function notebookEntryName(entry = {}) {
  return String(entry?.name || entry?.filename || entry?.path || "").split(/[\\/]/).filter(Boolean).pop() || "";
}

function sortNotebookEntries(entries = []) {
  return [...entries].sort((a, b) => {
    if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
    return String(a.path || a.name || "").localeCompare(String(b.path || b.name || ""), undefined, { numeric: true, sensitivity: "base" });
  });
}

async function fetchNotebookDirectoryEntries(dirPath = "") {
  const cleanDir = normalizeNotebookPath(dirPath);
  const res = await fetch(`/api/files?path=${encodeURIComponent(cleanDir)}`);
  if (!res.ok) throw new Error(`Failed to list directory: ${res.status}`);
  const payload = await res.json();
  return Array.isArray(payload) ? payload : [];
}

async function listNotebookEntriesRecursively(dirPath = "", entries = [], seen = new Set()) {
  const cleanDir = normalizeNotebookPath(dirPath);
  if (seen.has(cleanDir)) return entries;
  seen.add(cleanDir);

  const children = await fetchNotebookDirectoryEntries(cleanDir);
  for (const child of children) {
    const name = notebookEntryName(child);
    if (!name) continue;
    const childPath = normalizeNotebookPath(cleanDir ? `${cleanDir}/${name}` : name);
    const isDirectory = isNotebookDirectoryEntry(child);
    entries.push({ name, path: childPath, isDirectory });
    if (isDirectory) {
      await listNotebookEntriesRecursively(childPath, entries, seen);
    }
  }

  return entries;
}

function pickerPathParent(path = "") {
  return dirname(normalizeNotebookPath(path));
}

function pickerPathBase(path = "") {
  const parts = normalizeNotebookPath(path).split("/").filter(Boolean);
  return parts[parts.length - 1] || "Notebook";
}

function showManagerSubToolbar(panelType = "GraphManager") {
  const heading = panelType === "FileManager" ? "File Manager" : "Graph Manager";
  window.dispatchEvent(new CustomEvent("nv-show-subtoolbar", {
    detail: { heading, force: true, toggle: false }
  }));
}

function managerPanelType(value = "") {
  return String(value || "").trim() === "FileManager" ? "FileManager" : "GraphManager";
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

function graphPickerNodeId(path = "", isDirectory = false) {
  const clean = normalizeNotebookPath(path);
  if (!clean) return "notebook-root";
  return (isDirectory ? "dir:" : "file:") + clean;
}

function buildPickerGraphElements(entries = []) {
  const nodes = [{ data: { id: "notebook-root", label: "Notebook", fullPath: "", type: "directory" } }];
  const edges = [];
  const visibleEntries = sortNotebookEntries(entries).slice(0, LINK_PICKER_GRAPH_LIMIT);

  visibleEntries.forEach((entry) => {
    const id = graphPickerNodeId(entry.path, entry.isDirectory);
    nodes.push({
      data: {
        id,
        label: entry.name || pickerPathBase(entry.path),
        fullPath: entry.path,
        type: entry.isDirectory ? "directory" : "file"
      }
    });
    const parentPath = pickerPathParent(entry.path);
    const parent = parentPath ? graphPickerNodeId(parentPath, true) : "notebook-root";
    edges.push({ data: { id: `edge:${parent}->${id}`, source: parent, target: id } });
  });

  return { elements: [...nodes, ...edges], visibleCount: visibleEntries.length, totalCount: entries.length };
}

function renderInlineManagerSwitcher(host, activeView) {
  host.innerHTML = "";
  const label = document.createElement("label");
  label.style.cssText = "display:flex;align-items:center;gap:7px;font:12px system-ui,sans-serif;color:#1f2937;white-space:nowrap;";
  const fileLabel = document.createElement("span");
  fileLabel.textContent = "File";
  const slider = document.createElement("input");
  slider.type = "range";
  slider.min = "0";
  slider.max = "1";
  slider.step = "1";
  slider.value = activeView === "FileManager" ? "0" : "1";
  slider.style.cssText = "width:54px;accent-color:#2563eb;cursor:pointer;";
  const graphLabel = document.createElement("span");
  graphLabel.textContent = "Graph";
  const refresh = () => {
    fileLabel.style.fontWeight = slider.value === "0" ? "700" : "500";
    graphLabel.style.fontWeight = slider.value === "1" ? "700" : "500";
  };
  slider.addEventListener("input", refresh);
  slider.addEventListener("change", () => {
    host.dispatchEvent(new CustomEvent("nv-manager-panel-switch", {
      bubbles: true,
      detail: { panelType: slider.value === "0" ? "FileManager" : "GraphManager" }
    }));
  });
  refresh();
  label.append(fileLabel, slider, graphLabel);
  host.appendChild(label);
}

async function renderPickerManagerSwitcher(host, activeView) {
  try {
    const mod = await import("/ToolbarJSONfiles/graphManagerLayerControlsWidget.mjs");
    if (typeof mod.initToolbarWidget === "function") {
      mod.initToolbarWidget(host, {
        widget: "managerPanelSwitcher",
        pickerMode: true,
        selectedPanel: activeView
      });
      return;
    }
  } catch (err) {
    console.warn("insertLink: Failed to load manager switcher widget:", err);
  }
  renderInlineManagerSwitcher(host, activeView);
}

function showNotebookFileSelectionOverlay(entries = []) {
  return new Promise((resolve) => {
    let activeView = "GraphManager";
    let activeDirectory = normalizeNotebookPath(navigationState.getSearchRoot?.() || "");
    if (activeDirectory && !entries.some((entry) => entry.isDirectory && normalizeNotebookPath(entry.path) === activeDirectory)) {
      activeDirectory = "";
    }
    let selectedPath = "";
    let selectedIsDirectory = false;
    let cy = null;

    const overlay = document.createElement("div");
    overlay.dataset.nvLinkPickerOverlay = "true";
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
      width: "min(1020px, 96vw)",
      height: "min(760px, 92vh)",
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

    const switcherHost = document.createElement("div");
    switcherHost.style.cssText = "display:flex;align-items:center;justify-content:flex-end;min-width:128px;";
    header.append(title, switcherHost);

    const viewTitle = document.createElement("div");
    viewTitle.style.cssText = "padding:8px 12px;border-bottom:1px solid #e2e8f0;font-size:12px;color:#475569;background:#ffffff;";

    const content = document.createElement("div");
    Object.assign(content.style, {
      flex: "1 1 auto",
      minHeight: "0",
      position: "relative",
      overflow: "hidden",
      background: "#ffffff"
    });

    const footer = document.createElement("div");
    Object.assign(footer.style, {
      flex: "0 0 auto",
      display: "grid",
      gridTemplateColumns: "minmax(0, 1fr) auto auto",
      alignItems: "center",
      gap: "8px",
      padding: "10px 12px",
      borderTop: "1px solid #d7dde8",
      background: "#f8fafc"
    });

    const selectedLabel = document.createElement("div");
    selectedLabel.textContent = "No file selected.";
    selectedLabel.style.cssText = "min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#475569;font-size:12px;";
    const closeBtn = makePickerButton("Close");
    const selectBtn = makePickerButton("Select", true);
    footer.append(selectedLabel, closeBtn, selectBtn);

    box.append(header, viewTitle, content, footer);
    overlay.appendChild(box);
    document.body.appendChild(overlay);

    const updateSelectionDisplay = () => {
      selectedLabel.textContent = selectedPath
        ? selectedIsDirectory
          ? `Directory selected: ${selectedPath}`
          : `Selected: ${selectedPath}`
        : "No file selected.";
      setButtonDisabled(selectBtn, !selectedPath || selectedIsDirectory);
    };

    const selectCandidate = (path, isDirectory = false) => {
      selectedPath = normalizeNotebookPath(path || "");
      selectedIsDirectory = Boolean(isDirectory);
      updateSelectionDisplay();
      if (cy) {
        try {
          cy.nodes().removeClass("nv-link-picker-selected");
          const node = cy.getElementById(graphPickerNodeId(selectedPath, selectedIsDirectory));
          if (node && !node.empty()) node.addClass("nv-link-picker-selected");
        } catch (_) {
          // Selection styling is best effort for the embedded graph.
        }
      }
      content.querySelectorAll("[data-link-picker-path]").forEach((row) => {
        row.dataset.selected = normalizeNotebookPath(row.dataset.linkPickerPath || "") === selectedPath ? "true" : "false";
        row.style.background = row.dataset.selected === "true" ? "#dbeafe" : "#ffffff";
        row.style.borderColor = row.dataset.selected === "true" ? "#60a5fa" : "#d7dde8";
      });
    };

    const finish = (value = null) => {
      if (cy) {
        try { cy.destroy(); } catch (_) { /* ignore */ }
        cy = null;
      }
      window.removeEventListener("keydown", handleKeydown, true);
      overlay.remove();
      resolve(value ? normalizeNotebookPath(value) : null);
    };

    const renderEmptyState = (message) => {
      content.innerHTML = "";
      const empty = document.createElement("div");
      empty.textContent = message;
      empty.style.cssText = "padding:18px;color:#64748b;font-size:13px;";
      content.appendChild(empty);
    };

    const renderGraphView = () => {
      if (cy) {
        try { cy.destroy(); } catch (_) { /* ignore */ }
        cy = null;
      }
      activeView = "GraphManager";
      showManagerSubToolbar(activeView);
      viewTitle.textContent = "Graph Manager";
      content.innerHTML = "";

      const graphHost = document.createElement("div");
      graphHost.style.cssText = "position:absolute;inset:0;background:#ffffff;";
      content.appendChild(graphHost);

      if (typeof window.cytoscape !== "function") {
        renderEmptyState("Graph view is unavailable in this browser session.");
        return;
      }

      const graphData = buildPickerGraphElements(entries);
      cy = window.cytoscape({
        container: graphHost,
        elements: graphData.elements,
        boxSelectionEnabled: false,
        selectionType: "single",
        style: [
          { selector: "node", style: { label: "data(label)", width: 56, height: 56, "font-size": 10, "text-wrap": "wrap", "text-max-width": 90, "text-valign": "bottom", "text-halign": "center", "text-margin-y": 5, color: "#172033", "background-color": "#dbe7f5", "border-width": 1, "border-color": "#94a3b8" } },
          { selector: "node[type='directory']", style: { shape: "round-rectangle", "background-color": "#e5e7eb", "border-color": "#94a3b8" } },
          { selector: "node[type='file']", style: { shape: "ellipse", "background-color": "#dbeafe", "border-color": "#60a5fa" } },
          { selector: "node.nv-link-picker-selected", style: { "border-width": 4, "border-color": "#2563eb", "background-color": "#bfdbfe" } },
          { selector: "edge", style: { width: 1.4, "line-color": "#cbd5e1", "target-arrow-color": "#cbd5e1", "target-arrow-shape": "triangle", "curve-style": "bezier", opacity: 0.86 } }
        ],
        layout: { name: "breadthfirst", directed: true, spacingFactor: 1.08, padding: 24 }
      });

      cy.on("tap", "node", (evt) => {
        const node = evt.target;
        selectCandidate(node.data("fullPath") || "", node.data("type") === "directory");
      });
      cy.on("dblclick", "node", (evt) => {
        const node = evt.target;
        const path = normalizeNotebookPath(node.data("fullPath") || "");
        if (!path) return;
        if (node.data("type") === "directory") {
          activeDirectory = path;
          renderFileView();
        } else {
          finish(path);
        }
      });

      if (graphData.totalCount > graphData.visibleCount) {
        const note = document.createElement("div");
        note.textContent = `Showing ${graphData.visibleCount} of ${graphData.totalCount} notebook entries in graph view.`;
        note.style.cssText = "position:absolute;left:10px;bottom:10px;background:rgba(255,255,255,0.94);border:1px solid #cbd5e1;border-radius:6px;padding:5px 8px;color:#475569;font-size:11px;";
        content.appendChild(note);
      }

      window.setTimeout(() => {
        try { cy?.resize?.(); cy?.fit?.(undefined, 24); } catch (_) { /* ignore */ }
      }, 0);
    };

    const renderBreadcrumbs = (host) => {
      const crumbs = document.createElement("div");
      crumbs.style.cssText = "display:flex;align-items:center;gap:4px;flex-wrap:wrap;padding:8px 10px;border-bottom:1px solid #e2e8f0;background:#f8fafc;";

      const addCrumb = (label, path) => {
        const btn = makePickerButton(label);
        btn.style.minHeight = "26px";
        btn.style.padding = "3px 8px";
        btn.addEventListener("click", () => {
          activeDirectory = normalizeNotebookPath(path);
          renderFileView();
        });
        crumbs.appendChild(btn);
      };

      addCrumb("Notebook", "");
      let cumulative = "";
      activeDirectory.split("/").filter(Boolean).forEach((part) => {
        const sep = document.createElement("span");
        sep.textContent = "/";
        sep.style.color = "#94a3b8";
        crumbs.appendChild(sep);
        cumulative = cumulative ? `${cumulative}/${part}` : part;
        addCrumb(part, cumulative);
      });
      host.appendChild(crumbs);
    };

    function renderFileView() {
      if (cy) {
        try { cy.destroy(); } catch (_) { /* ignore */ }
        cy = null;
      }
      activeView = "FileManager";
      showManagerSubToolbar(activeView);
      viewTitle.textContent = "File Manager";
      content.innerHTML = "";

      const shell = document.createElement("div");
      shell.style.cssText = "height:100%;min-height:0;display:flex;flex-direction:column;background:#ffffff;";
      renderBreadcrumbs(shell);

      const list = document.createElement("div");
      list.style.cssText = "flex:1 1 auto;min-height:0;overflow:auto;padding:8px;display:flex;flex-direction:column;gap:4px;";
      shell.appendChild(list);
      content.appendChild(shell);

      const children = sortNotebookEntries(entries.filter((entry) => pickerPathParent(entry.path) === activeDirectory));
      if (activeDirectory) {
        const up = document.createElement("button");
        up.type = "button";
        up.textContent = "..";
        up.style.cssText = "display:flex;align-items:center;width:100%;min-height:28px;padding:4px 8px;border:1px solid #d7dde8;background:#ffffff;color:#172033;text-align:left;cursor:pointer;font:12px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;";
        up.addEventListener("click", () => {
          activeDirectory = pickerPathParent(activeDirectory);
          renderFileView();
        });
        list.appendChild(up);
      }

      if (!children.length) {
        const empty = document.createElement("div");
        empty.textContent = "No files in this directory.";
        empty.style.cssText = "padding:10px;color:#64748b;font-size:12px;";
        list.appendChild(empty);
      }

      children.forEach((entry) => {
        const row = document.createElement("button");
        row.type = "button";
        row.dataset.linkPickerPath = entry.path;
        row.dataset.isDirectory = String(entry.isDirectory);
        row.style.cssText = "display:grid;grid-template-columns:22px minmax(0,1fr);align-items:center;gap:8px;width:100%;min-height:30px;padding:4px 8px;border:1px solid #d7dde8;background:#ffffff;color:#172033;text-align:left;cursor:pointer;font:12px system-ui,sans-serif;";
        const icon = document.createElement("span");
        icon.textContent = entry.isDirectory ? "Dir" : "File";
        icon.style.cssText = "font-size:10px;color:#475569;";
        const label = document.createElement("span");
        label.textContent = entry.name;
        label.style.cssText = "min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;";
        row.append(icon, label);
        row.addEventListener("click", () => selectCandidate(entry.path, entry.isDirectory));
        row.addEventListener("dblclick", () => {
          if (entry.isDirectory) {
            activeDirectory = entry.path;
            renderFileView();
          } else {
            finish(entry.path);
          }
        });
        list.appendChild(row);
      });

      if (selectedPath) selectCandidate(selectedPath, selectedIsDirectory);
    }

    const setView = async (panelType) => {
      activeView = managerPanelType(panelType);
      navigationState.setLastFileSelectionPanelType?.(activeView);
      navigationState.setLastInfoPanelType?.(activeView);
      await renderPickerManagerSwitcher(switcherHost, activeView);
      if (activeView === "FileManager") renderFileView();
      else renderGraphView();
    };

    function handleKeydown(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        finish(null);
        return;
      }
      if (event.key === "Enter" && selectedPath && !selectedIsDirectory) {
        event.preventDefault();
        finish(selectedPath);
      }
    }

    overlay.addEventListener("nv-manager-panel-switch", (event) => {
      event.stopPropagation();
      setView(event.detail?.panelType || "GraphManager");
    });
    closeBtn.addEventListener("click", () => finish(null));
    selectBtn.addEventListener("click", () => {
      if (selectedPath && !selectedIsDirectory) finish(selectedPath);
    });
    window.addEventListener("keydown", handleKeydown, true);

    updateSelectionDisplay();
    setView("GraphManager");
  });
}

async function chooseInternalNotebookTarget() {
  showManagerSubToolbar("GraphManager");
  const entries = await listNotebookEntriesRecursively("");
  return showNotebookFileSelectionOverlay(entries);
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
    let targetPath = null;
    try {
      targetPath = await chooseInternalNotebookTarget();
    } catch (err) {
      console.error("insertLink: Failed to open internal file dialog:", err);
      alert("Failed to load Notebook files for internal link.");
      return;
    }
    if (!targetPath) return;
    edgeTarget = normalizeNotebookPath(targetPath);
    href = toRelativeNotebookHref(sourcePath, edgeTarget);
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
  }
}
