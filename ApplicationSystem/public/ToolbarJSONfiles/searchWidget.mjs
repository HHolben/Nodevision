// Nodevision/ApplicationSystem/public/ToolbarJSONfiles/searchWidget.mjs
// This file defines browser-side search Widget logic for the Nodevision UI. It renders interface components and handles user interactions.

import { getNodevisionNavigationState } from "/NodevisionNavigationState.mjs";
import { normalizeNotebookRelativePath } from "/utils/notebookPath.mjs";

let isGlobalCloseHandlerBound = false;
const navigationState = getNodevisionNavigationState();

function escapeHTML(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatResult(result) {
  const badge = result.kind === "directory" ? "DIR" : "FILE";
  const match = result.match === "active content" ? "active content" : (result.match === "content" ? "content" : "name");
  const snippet = result.snippet ? `<div style=\"font-size:12px;color:#555;white-space:normal;\">${escapeHTML(result.snippet)}</div>` : "";

  return `
    <div class=\"toolbar-search-row\" data-path=\"${escapeHTML(result.path)}\" data-kind=\"${escapeHTML(result.kind)}\" style=\"padding:6px 8px;border-bottom:1px solid #eee;cursor:pointer;\"> 
      <div style=\"display:flex;justify-content:space-between;gap:8px;\"> 
        <strong style=\"font-size:12px;color:#333;\">${escapeHTML(result.path)}</strong>
        <span style=\"font-size:11px;color:#666;\">${badge} • ${match}</span>
      </div>
      ${snippet}
    </div>
  `;
}

function hideResults(resultsEl) {
  resultsEl.style.display = "none";
  resultsEl.innerHTML = "";
}

function normalizePath(pathValue) {
  return normalizeNotebookRelativePath(pathValue || "").replace(/\/+$/, "");
}

function dirname(pathValue) {
  const cleanPath = normalizePath(pathValue);
  if (!cleanPath.includes("/")) return "";
  return cleanPath.slice(0, cleanPath.lastIndexOf("/"));
}

function uniqueValues(values = []) {
  return [...new Set(values.filter(Boolean))];
}

function collectActiveContentPaths() {
  const candidates = [
    ...Array.from(document.querySelectorAll(".panel-cell[data-current-file-path]"))
      .map((cell) => cell.dataset.currentFilePath),
    window.__nvCodeEditorActivePath,
    window.currentActiveFilePath,
    window.NodevisionState?.activeEditorFilePath,
    window.NodevisionState?.selectedFile,
  ];

  return uniqueValues(candidates.map(normalizePath))
    .filter((path) => path && path.includes("."));
}

function snippetAround(content, query) {
  const text = String(content || "");
  const lower = text.toLowerCase();
  const q = String(query || "").toLowerCase();
  const idx = lower.indexOf(q);
  if (idx === -1) return "";
  const start = Math.max(0, idx - 60);
  const end = Math.min(text.length, idx + q.length + 60);
  return text.slice(start, end).replace(/\s+/g, " ").trim();
}

async function searchActiveContents(query, limit = 100) {
  const paths = collectActiveContentPaths();
  const results = [];

  for (const path of paths) {
    if (results.length >= limit) break;

    try {
      const url = "/api/fileCodeContent?path=" + encodeURIComponent(path);
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) continue;
      const payload = await res.json();
      const content = String(payload?.content || "");
      if (!content.toLowerCase().includes(query.toLowerCase())) continue;

      results.push({
        kind: "file",
        match: "active content",
        path,
        snippet: snippetAround(content, query),
      });
    } catch (err) {
      console.warn(`[searchWidget] Active content search skipped ${path}:`, err);
    }
  }

  return { results, activePathCount: paths.length };
}

function getInfoPanelTypeCandidate() {
  const panelType = window.NodevisionState?.activePanelType;
  return panelType === "FileManager" || panelType === "GraphManager" ? panelType : null;
}

async function openPathInPanel(panelType, path, { isDirectory = false } = {}) {
  if (panelType === "FileManager") {
    if (typeof window.revealPathInFileManager === "function") {
      const revealed = await window.revealPathInFileManager(path, { isDirectory });
      if (revealed) return true;
    }
    if (isDirectory && typeof window.openDirectoryInFileManager === "function") {
      await window.openDirectoryInFileManager(path);
      return true;
    }
    return false;
  }

  if (panelType === "GraphManager") {
    if (typeof window.revealPathInGraphManager === "function") {
      const revealed = await window.revealPathInGraphManager(path, { isDirectory });
      if (revealed) return true;
    }
    if (isDirectory && typeof window.openDirectoryInGraphManager === "function") {
      await window.openDirectoryInGraphManager(path);
      return true;
    }
    return false;
  }

  return false;
}

async function openPathInPreferredInfoPanel(path, { isDirectory = false } = {}) {
  const panelCandidates = uniqueValues([
    navigationState.getLastInfoPanelType(),
    getInfoPanelTypeCandidate(),
    "FileManager",
    "GraphManager",
  ]);

  for (const panelType of panelCandidates) {
    try {
      const opened = await openPathInPanel(panelType, path, { isDirectory });
      if (opened) {
        return true;
      }
    } catch (err) {
      console.warn(`[searchWidget] Failed to reveal path in ${panelType}:`, err);
    }
  }

  return false;
}

function openFileInView(path) {
  window.selectedFilePath = path;
  document.dispatchEvent(new CustomEvent("fileSelected", { detail: { filePath: path } }));
}

async function runSearch(inputEl, scopeEl, resultsEl) {
  const q = (inputEl.value || "").trim();
  if (!q) {
    hideResults(resultsEl);
    return;
  }

  const scope = scopeEl.value || "all";
  resultsEl.style.display = "block";
  resultsEl.innerHTML = `<div style=\"padding:8px;color:#666;\">Searching...</div>`;

  try {
    if (scope === "activeContent") {
      const { results, activePathCount } = await searchActiveContents(q, 100);
      if (activePathCount === 0) {
        resultsEl.innerHTML = `<div style=\"padding:8px;color:#666;\">No open file viewers or editors with files were found.</div>`;
        return;
      }
      if (results.length === 0) {
        resultsEl.innerHTML = `<div style=\"padding:8px;color:#666;\">No matches found in ` + activePathCount + ` active file(s).</div>`;
        return;
      }
      const rows = results.map(formatResult).join("");
      resultsEl.innerHTML = `
        <div style=\"padding:6px 8px;background:#f8f8f8;border-bottom:1px solid #ddd;font-size:12px;color:#555;\">` + results.length + ` active result(s) across ` + activePathCount + ` file(s)</div>
        ` + rows + `
      `;
      return;
    }

    const params = new URLSearchParams({
      q,
      scope,
      limit: "100",
    });
    const searchRoot = navigationState.getSearchRoot();
    if (searchRoot) {
      params.set("root", searchRoot);
    }

    const url = `/api/search?${params.toString()}`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
      throw new Error(`Search failed (${res.status})`);
    }

    const payload = await res.json();
    const results = Array.isArray(payload.results) ? payload.results : [];

    if (results.length === 0) {
      resultsEl.innerHTML = `<div style=\"padding:8px;color:#666;\">No matches found.</div>`;
      return;
    }

    const rows = results.map(formatResult).join("");
    resultsEl.innerHTML = `
      <div style=\"padding:6px 8px;background:#f8f8f8;border-bottom:1px solid #ddd;font-size:12px;color:#555;\">${results.length} result(s)</div>
      ${rows}
    `;
  } catch (err) {
    console.error("[searchWidget]", err);
    resultsEl.innerHTML = `<div style=\"padding:8px;color:#b00020;\">${escapeHTML(err.message || "Search error")}</div>`;
  }
}

function bindResultClicks(root, resultsEl) {
  resultsEl.addEventListener("click", async (event) => {
    const row = event.target.closest(".toolbar-search-row");
    if (!row || !root.contains(resultsEl)) return;

    const path = normalizePath(row.dataset.path);
    if (!path) return;

    const isDirectory = row.dataset.kind === "directory";
    if (isDirectory) {
      const opened = await openPathInPreferredInfoPanel(path, { isDirectory: true });
      if (!opened) {
        openFileInView(path);
      }
    } else {
      openFileInView(path);
      await openPathInPreferredInfoPanel(dirname(path), { isDirectory: true });
    }

    hideResults(resultsEl);
  });
}

export function initToolbarWidget(root) {
  if (!root || root.dataset.searchWidgetBound === "true") return;

  const inputEl = root.querySelector("#toolbar-file-search-input");
  const scopeEl = root.querySelector("#toolbar-file-search-scope");
  const buttonEl = root.querySelector("#toolbar-file-search-btn");
  const resultsEl = root.querySelector("#toolbar-file-search-results");

  if (!inputEl || !scopeEl || !buttonEl || !resultsEl) return;

  root.dataset.searchWidgetBound = "true";

  if (!scopeEl.querySelector('option[value="activeContent"]')) {
    const option = document.createElement("option");
    option.value = "activeContent";
    option.textContent = "Active Contents";
    scopeEl.appendChild(option);
  }

  buttonEl.addEventListener("click", () => runSearch(inputEl, scopeEl, resultsEl));
  inputEl.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      runSearch(inputEl, scopeEl, resultsEl);
    }
  });

  bindResultClicks(root, resultsEl);

  if (!isGlobalCloseHandlerBound) {
    document.addEventListener("click", (event) => {
      document.querySelectorAll("#toolbar-file-search-results").forEach((el) => {
        const container = el.closest("#toolbar-file-search");
        if (container && !container.contains(event.target)) {
          hideResults(el);
        }
      });
    });
    isGlobalCloseHandlerBound = true;
  }
}
