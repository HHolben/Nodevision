// Nodevision/ApplicationSystem/public/ToolbarJSONfiles/recentFilesDropdown.mjs
// This file renders the main-toolbar Recents dropdown by reading recently edited Notebook files from the shared recents manifest.

import {
  filePathToNotebookHref,
  getRecentEditedFileEntries,
  openRecentFile,
} from "/RecentFiles.mjs";
import { loadRecentManifestEntries } from "/RecentFilesManifestClient.mjs";

let closeHandlerBound = false;

function escapeHTML(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function editedTimeLabel(editedAt) {
  if (!Number.isFinite(editedAt) || editedAt <= 0) return "Recently edited";
  const seconds = Math.max(0, Math.floor((Date.now() - editedAt) / 1000));
  if (seconds < 60) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function displayName(path) {
  const parts = String(path || "").split("/").filter(Boolean);
  return parts[parts.length - 1] || path;
}

function renderRows(dropdownEl) {
  const entries = getRecentEditedFileEntries();
  if (!entries.length) {
    dropdownEl.innerHTML = '<div style="padding:10px;color:#666;font-size:12px;">No recently edited files yet.</div>';
    return;
  }

  dropdownEl.innerHTML = entries.map((entry) => {
    const href = filePathToNotebookHref(entry.path) || "#";
    return `
      <a class="toolbar-recents-row" href="${escapeHTML(href)}" data-path="${escapeHTML(entry.path)}" style="display:block;padding:7px 9px;border-bottom:1px solid #eee;text-decoration:none;color:#222;">
        <strong style="display:block;font-size:12px;line-height:1.25;">${escapeHTML(displayName(entry.path))}</strong>
        <span style="display:block;font-size:11px;line-height:1.3;color:#666;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHTML(entry.path)}</span>
        <span style="display:block;font-size:11px;line-height:1.3;color:#777;">${escapeHTML(editedTimeLabel(entry.editedAt))}</span>
      </a>
    `;
  }).join("");
}

function closeDropdown(buttonEl, dropdownEl) {
  dropdownEl.style.display = "none";
  buttonEl?.setAttribute?.("aria-expanded", "false");
}

function openDropdown(buttonEl, dropdownEl, searchResultsEl) {
  renderRows(dropdownEl);
  loadRecentManifestEntries().then(() => {
    if (dropdownEl.style.display === "block") renderRows(dropdownEl);
  });
  if (searchResultsEl) searchResultsEl.style.display = "none";
  dropdownEl.style.display = "block";
  buttonEl?.setAttribute?.("aria-expanded", "true");
}

function toggleDropdown(buttonEl, dropdownEl, searchResultsEl) {
  if (dropdownEl.style.display === "block") {
    closeDropdown(buttonEl, dropdownEl);
  } else {
    openDropdown(buttonEl, dropdownEl, searchResultsEl);
  }
}

function bindGlobalCloseHandler() {
  if (closeHandlerBound) return;
  document.addEventListener("click", (event) => {
    document.querySelectorAll("#toolbar-recents-dropdown").forEach((dropdownEl) => {
      const container = dropdownEl.closest("#toolbar-file-search");
      if (container && !container.contains(event.target)) {
        closeDropdown(container.querySelector("#toolbar-recents-btn"), dropdownEl);
      }
    });
  });
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    document.querySelectorAll("#toolbar-recents-dropdown").forEach((dropdownEl) => {
      const container = dropdownEl.closest("#toolbar-file-search");
      closeDropdown(container?.querySelector("#toolbar-recents-btn"), dropdownEl);
    });
  });
  closeHandlerBound = true;
}

export function initRecentFilesDropdown(root) {
  if (!root || root.dataset.recentFilesBound === "true") return;
  const buttonEl = root.querySelector("#toolbar-recents-btn");
  const dropdownEl = root.querySelector("#toolbar-recents-dropdown");
  if (!buttonEl || !dropdownEl) return;

  root.dataset.recentFilesBound = "true";
  const searchResultsEl = root.querySelector("#toolbar-file-search-results");
  buttonEl.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    toggleDropdown(buttonEl, dropdownEl, searchResultsEl);
  });

  dropdownEl.addEventListener("click", (event) => {
    const link = event.target.closest(".toolbar-recents-row");
    if (!link) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button === 1) return;
    event.preventDefault();
    if (openRecentFile(link.dataset.path)) closeDropdown(buttonEl, dropdownEl);
  });

  const closeForSearch = () => closeDropdown(buttonEl, dropdownEl);
  root.querySelector("#toolbar-file-search-btn")?.addEventListener("click", closeForSearch);
  root.querySelector("#toolbar-file-search-input")?.addEventListener("focus", closeForSearch);
  root.querySelector("#toolbar-file-search-scope")?.addEventListener("focus", closeForSearch);

  window.addEventListener("nodevision-recents-changed", () => {
    if (dropdownEl.style.display === "block") renderRows(dropdownEl);
  });
  loadRecentManifestEntries().then(() => renderRows(dropdownEl));
  bindGlobalCloseHandler();
}
