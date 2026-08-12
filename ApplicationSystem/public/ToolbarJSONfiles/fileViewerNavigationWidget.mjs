// Nodevision/ApplicationSystem/public/ToolbarJSONfiles/fileViewerNavigationWidget.mjs
// This sub-toolbar widget gives FileView small history, refresh, and HTML/PHP page navigation controls that reuse the existing FileView selection path.

import { fetchDirectoryContents } from "/PanelInstances/InfoPanels/FileManagerDependencies.mjs/FileManagerAPI.mjs";
import {
  dispatchRecentSelection,
  revealRecentFileInNavigator,
} from "/RecentFileNavigation.mjs";
import {
  findAdjacentNotebookPage,
  normalizeNotebookPagePath,
} from "/FileViewNavigation/NotebookPageTraversal.mjs";
import {
  commitFileViewHistoryMove,
  getFileViewHistoryState,
  getFileViewHistoryTarget,
  readCurrentFileViewPath,
  recordFileViewVisit,
  startFileViewVisitTracking,
  syncFileViewVisitHistory,
} from "/FileViewNavigation/FileViewVisitHistory.mjs";

function button(label, action, title = label) {
  const el = document.createElement("button");
  el.type = "button";
  el.textContent = label;
  el.dataset.nvFileViewNavAction = action;
  el.title = title;
  el.setAttribute("aria-label", title);
  Object.assign(el.style, {
    height: "26px",
    minWidth: "32px",
    padding: "0 8px",
    border: "1px solid #64748b",
    borderRadius: "4px",
    background: "#fff",
    color: "#111827",
    cursor: "pointer",
    font: "12px system-ui, sans-serif",
  });
  return el;
}

function render(hostElement) {
  hostElement.replaceChildren();
  const wrap = document.createElement("div");
  wrap.dataset.nvFileViewNavigation = "true";
  Object.assign(wrap.style, {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    flexWrap: "wrap",
    whiteSpace: "nowrap",
  });
  wrap.append(
    button("<", "back", "Back"),
    button("^ Previous page", "previous-page", "Previous page"),
    button("Refresh", "refresh", "Refresh current file"),
    button(">", "forward", "Forward"),
    button("v Next page", "next-page", "Next page"),
  );
  const status = document.createElement("span");
  status.dataset.nvFileViewNavStatus = "true";
  Object.assign(status.style, { color: "#475569", font: "12px system-ui, sans-serif", minWidth: "160px" });
  wrap.appendChild(status);
  hostElement.appendChild(wrap);
}

function setStatus(hostElement, text = "") {
  const status = hostElement.querySelector("[data-nv-file-view-nav-status]");
  if (status) status.textContent = text;
}

function setBusy(hostElement, busy) {
  hostElement.querySelectorAll("button[data-nv-file-view-nav-action]").forEach((btn) => {
    btn.disabled = Boolean(busy);
    btn.style.opacity = busy ? "0.62" : "1";
  });
}

function syncButtons(hostElement) {
  syncFileViewVisitHistory();
  const state = getFileViewHistoryState();
  const back = hostElement.querySelector('[data-nv-file-view-nav-action="back"]');
  const forward = hostElement.querySelector('[data-nv-file-view-nav-action="forward"]');
  if (back) back.disabled = !state.canGoBack;
  if (forward) forward.disabled = !state.canGoForward;
}

function publishFileViewSelection(path) {
  dispatchRecentSelection(window, path);
  revealRecentFileInNavigator(window, path).catch((err) => {
    console.warn("[FileViewNavigation] Failed to reveal navigated file:", err);
  });
}

function requestFileViewPath(pathValue, onAccepted = () => {}) {
  const path = normalizeNotebookPagePath(pathValue);
  if (!path) return false;
  const accepted = (selectedPath = path) => {
    const clean = normalizeNotebookPagePath(selectedPath || path);
    onAccepted(clean);
    publishFileViewSelection(clean);
    if (!window._selectedFileProxyInstalled && typeof window.updateViewPanel === "function") {
      window.updateViewPanel(clean, { force: true }).catch((err) => console.warn("[FileViewNavigation] Render failed:", err));
    }
  };
  if (typeof window.requestNodevisionFileSelection === "function") {
    window.requestNodevisionFileSelection(path, { isDirectory: false, onSelected: accepted });
    return true;
  }
  window.NodevisionState = window.NodevisionState || {};
  window.NodevisionState.selectedFile = path;
  window.NodevisionState.selectedFileIsDirectory = false;
  window.selectedFilePath = path;
  window.currentActiveFilePath = path;
  accepted(path);
  return true;
}

async function goHistory(hostElement, direction) {
  syncFileViewVisitHistory();
  const target = getFileViewHistoryTarget(direction);
  if (!target) {
    setStatus(hostElement, direction === "forward" ? "No forward file." : "No previous file.");
    return;
  }
  requestFileViewPath(target, (path) => {
    commitFileViewHistoryMove(direction, path);
    setStatus(hostElement, path);
    syncButtons(hostElement);
  });
}

async function goPage(hostElement, direction) {
  const current = readCurrentFileViewPath();
  if (!current) {
    setStatus(hostElement, "No current file.");
    return;
  }
  setBusy(hostElement, true);
  try {
    const target = await findAdjacentNotebookPage(current, direction, fetchDirectoryContents);
    if (!target) {
      setStatus(hostElement, direction === "previous" ? "No previous page." : "No next page.");
      return;
    }
    requestFileViewPath(target, (path) => {
      recordFileViewVisit(path);
      setStatus(hostElement, path);
      syncButtons(hostElement);
    });
  } catch (err) {
    console.warn("[FileViewNavigation] Page navigation failed:", err);
    setStatus(hostElement, err?.message || "Navigation failed.");
  } finally {
    setBusy(hostElement, false);
    syncButtons(hostElement);
  }
}

async function refreshFileView(hostElement) {
  const current = readCurrentFileViewPath();
  if (!current || typeof window.updateViewPanel !== "function") {
    setStatus(hostElement, "No FileView refresh target.");
    return;
  }
  await window.updateViewPanel(current, { force: true });
  recordFileViewVisit(current, { replace: true });
  setStatus(hostElement, "Refreshed " + current);
  syncButtons(hostElement);
}

function bind(hostElement) {
  hostElement.addEventListener("click", (event) => {
    const action = event.target?.closest?.("button[data-nv-file-view-nav-action]")?.dataset?.nvFileViewNavAction;
    if (!action) return;
    if (action === "back" || action === "forward") goHistory(hostElement, action);
    if (action === "previous-page") goPage(hostElement, "previous");
    if (action === "next-page") goPage(hostElement, "next");
    if (action === "refresh") refreshFileView(hostElement).catch((err) => setStatus(hostElement, err?.message || "Refresh failed."));
  });
}

export function initToolbarWidget(hostElement) {
  if (!hostElement || hostElement.dataset.nvFileViewNavigationBound === "true") return;
  hostElement.dataset.nvFileViewNavigationBound = "true";
  startFileViewVisitTracking();
  render(hostElement);
  bind(hostElement);
  syncButtons(hostElement);
}
