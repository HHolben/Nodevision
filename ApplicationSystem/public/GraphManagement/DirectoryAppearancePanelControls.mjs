// Nodevision/ApplicationSystem/public/GraphManagement/DirectoryAppearancePanelControls.mjs
// Inline fill/outline controls for File Manager and Graph Manager directory selections.

import { createHexColorControl } from "/Controls/HexColorControl.mjs";
import {
  DIRECTORY_APPEARANCE_CHANGED_EVENT,
  normalizeDirectoryMetadataPath,
  normalizeHexColor,
  readDirectoryAppearance,
  saveDirectoryAppearance,
} from "/GraphManagement/DirectoryAppearanceClient.mjs";

const DEFAULT_FILL = "#E8D7B5";
const DEFAULT_OUTLINE = "#7A5C32";

function ensureStyles() {
  if (document.getElementById("nv-directory-appearance-panel-controls-styles")) return;
  const style = document.createElement("style");
  style.id = "nv-directory-appearance-panel-controls-styles";
  style.textContent = `
    .nv-directory-appearance-panel-controls {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 6px;
      padding: 6px 8px;
      border-top: 1px solid rgba(148, 163, 184, 0.45);
      border-bottom: 1px solid rgba(148, 163, 184, 0.45);
      background: rgba(248, 250, 252, 0.92);
      color: #172033;
      font: 12px system-ui, -apple-system, Segoe UI, sans-serif;
      box-sizing: border-box;
    }
    .nv-directory-appearance-panel-controls strong,
    .nv-directory-appearance-panel-controls label {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      white-space: nowrap;
      font-weight: 600;
    }
    .nv-directory-appearance-panel-controls input[type="color"] {
      width: 28px;
      height: 22px;
      padding: 0;
      border: 1px solid #8a8f98;
      border-radius: 4px;
      background: transparent;
    }
    .nv-directory-appearance-panel-controls input[type="text"] {
      width: 82px;
      height: 22px;
      box-sizing: border-box;
      border: 1px solid #8a8f98;
      border-radius: 4px;
      padding: 2px 6px;
      background: #fff;
      color: #111827;
      font: 12px ui-monospace, SFMono-Regular, Menlo, monospace;
    }
    .nv-directory-appearance-panel-controls button {
      height: 22px;
      border: 1px solid #6b7280;
      border-radius: 4px;
      background: #f3f4f6;
      color: #111827;
      cursor: pointer;
      font: inherit;
      padding: 2px 7px;
    }
    .nv-directory-appearance-panel-path {
      max-width: min(240px, 42vw);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .nv-directory-appearance-panel-status {
      color: #4b5563;
      min-width: 78px;
    }
  `;
  document.head.appendChild(style);
}

function cleanSelectionEntries(entries = []) {
  return (Array.isArray(entries) ? entries : [])
    .map((entry) => ({
      path: normalizeDirectoryMetadataPath(entry?.path || ""),
      isDirectory: Boolean(entry?.isDirectory),
    }))
    .filter((entry) => entry.isDirectory);
}

function selectedDirectoryPath(owner = "") {
  const state = window.NodevisionState || {};
  const ownerName = String(owner || "").trim();
  const ownerMatches = !ownerName || !state.selectedFilesOwner || state.selectedFilesOwner === ownerName;
  const entries = ownerMatches ? cleanSelectionEntries(state.selectedFiles) : [];
  const primary = entries[entries.length - 1];
  if (primary) return primary.path;
  if (ownerMatches && state.selectedFileIsDirectory === true) {
    return normalizeDirectoryMetadataPath(state.selectedFile || window.selectedFilePath || "");
  }
  return null;
}

function setEnabled(mount, enabled) {
  mount.querySelectorAll("input, button").forEach((element) => {
    element.disabled = !enabled;
  });
}

function setStatus(mount, message = "", error = false) {
  const status = mount.querySelector("[data-directory-appearance-status]");
  if (!status) return;
  status.textContent = message;
  status.style.color = error ? "#b91c1c" : "";
}

export function mountDirectoryAppearanceControls(mount, { owner = "", title = "Directory Colors" } = {}) {
  if (!mount) return () => {};
  ensureStyles();
  mount.__nvDirectoryAppearancePanelCleanup?.();

  let currentPath = null;
  let currentAppearance = {};

  mount.innerHTML = "";
  mount.className = "nv-directory-appearance-panel-controls";

  const titleEl = document.createElement("strong");
  titleEl.textContent = title;
  const pathEl = document.createElement("span");
  pathEl.className = "nv-directory-appearance-panel-path";
  pathEl.textContent = "No directory selected";

  const reset = document.createElement("button");
  reset.type = "button";
  reset.textContent = "Reset";

  const status = document.createElement("span");
  status.dataset.directoryAppearanceStatus = "true";
  status.className = "nv-directory-appearance-panel-status";

  const fillControl = createHexColorControl({
    label: "Fill",
    fallback: DEFAULT_FILL,
    resetLabel: "Reset Fill",
    onCommit: (value) => commitColor("fillColor", value),
  });
  const outlineControl = createHexColorControl({
    label: "Outline",
    fallback: DEFAULT_OUTLINE,
    resetLabel: "Reset Outline",
    onCommit: (value) => commitColor("outlineColor", value),
  });

  mount.append(titleEl, pathEl, fillControl.element, outlineControl.element, reset, status);

  function sync() {
    pathEl.textContent = currentPath === "" ? "Notebook" : (currentPath || "No directory selected");
    fillControl.setValue(currentAppearance.fillColor || "");
    outlineControl.setValue(currentAppearance.outlineColor || "");
  }

  async function loadSelection() {
    currentPath = selectedDirectoryPath(owner);
    if (currentPath === null) {
      currentAppearance = {};
      sync();
      setEnabled(mount, false);
      setStatus(mount, "Select a directory.");
      return;
    }
    setEnabled(mount, true);
    currentAppearance = await readDirectoryAppearance(currentPath);
    sync();
    setStatus(mount, "Ready.");
  }

  async function commit(nextAppearance) {
    if (currentPath === null) return;
    try {
      setEnabled(mount, false);
      setStatus(mount, "Saving...");
      currentAppearance = await saveDirectoryAppearance(currentPath, nextAppearance);
      sync();
      setStatus(mount, "Saved.");
    } catch (err) {
      setStatus(mount, err?.message || "Save failed.", true);
    } finally {
      setEnabled(mount, true);
    }
  }

  async function commitColor(key, value) {
    const normalized = normalizeHexColor(value);
    if (String(value || "").trim() && !normalized) {
      setStatus(mount, "Invalid color.", true);
      return;
    }
    const next = { ...currentAppearance };
    if (normalized) next[key] = normalized;
    else delete next[key];
    await commit(next);
  }

  const onSelectionChanged = () => {
    loadSelection().catch((err) => setStatus(mount, err?.message || "Load failed.", true));
  };
  const onAppearanceChanged = (event) => {
    const changedPath = normalizeDirectoryMetadataPath(event?.detail?.path || "");
    if (currentPath !== null && changedPath === currentPath) onSelectionChanged();
  };
  reset.addEventListener("click", () => commit({}));
  window.addEventListener("nodevision-file-selection-set-changed", onSelectionChanged);
  window.addEventListener(DIRECTORY_APPEARANCE_CHANGED_EVENT, onAppearanceChanged);

  mount.__nvDirectoryAppearancePanelCleanup = () => {
    window.removeEventListener("nodevision-file-selection-set-changed", onSelectionChanged);
    window.removeEventListener(DIRECTORY_APPEARANCE_CHANGED_EVENT, onAppearanceChanged);
    mount.__nvDirectoryAppearancePanelCleanup = null;
  };

  onSelectionChanged();
  return mount.__nvDirectoryAppearancePanelCleanup;
}
