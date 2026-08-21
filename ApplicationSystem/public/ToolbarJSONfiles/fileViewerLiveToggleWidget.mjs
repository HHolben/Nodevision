// Nodevision/ApplicationSystem/public/ToolbarJSONfiles/fileViewerLiveToggleWidget.mjs
// Compact FileView sub-toolbar toggle for rendering matching unsaved editor buffers.

import { setStatus } from "/StatusBar.mjs";

const STORAGE_KEY = "nodevision.fileView.liveViewerEnabled.v1";

function readEnabled() {
  if (typeof window.isLiveFileViewerEnabled === "function") {
    return Boolean(window.isLiveFileViewerEnabled());
  }
  try {
    return window.localStorage?.getItem?.(STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

function writeFallback(enabled) {
  try {
    window.localStorage?.setItem?.(STORAGE_KEY, enabled ? "true" : "false");
  } catch {
    // Runtime-only toggle is fine when storage is unavailable.
  }
}

function setEnabled(enabled) {
  if (typeof window.setLiveFileViewerEnabled === "function") {
    return window.setLiveFileViewerEnabled(Boolean(enabled));
  }
  writeFallback(Boolean(enabled));
  window.dispatchEvent?.(new CustomEvent("nodevision-live-file-viewer-state", {
    detail: { enabled: Boolean(enabled) },
  }));
  return Boolean(enabled);
}

function render(hostElement) {
  hostElement.replaceChildren();
  const label = document.createElement("label");
  label.dataset.nvLiveFileViewerToggle = "true";
  Object.assign(label.style, {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    height: "26px",
    padding: "0 8px",
    border: "1px solid #64748b",
    borderRadius: "4px",
    background: "#fff",
    color: "#111827",
    cursor: "pointer",
    font: "12px system-ui, sans-serif",
    whiteSpace: "nowrap",
  });

  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.checked = readEnabled();
  checkbox.setAttribute("aria-label", "Live File Viewer");
  checkbox.style.cssText = "width:14px;height:14px;accent-color:#2563eb;cursor:pointer;";

  const text = document.createElement("span");
  text.textContent = "Live File Viewer";

  label.append(checkbox, text);
  hostElement.appendChild(label);

  checkbox.addEventListener("change", () => {
    const enabled = setEnabled(checkbox.checked);
    checkbox.checked = enabled;
    setStatus(enabled ? "Live File Viewer enabled." : "Live File Viewer disabled.");
  });

  const sync = (event) => {
    if (!event?.detail || typeof event.detail.enabled === "undefined") return;
    checkbox.checked = Boolean(event.detail.enabled);
  };
  window.addEventListener("nodevision-live-file-viewer-state", sync);
  hostElement.__nvCleanupLiveFileViewerToggle = () => {
    window.removeEventListener("nodevision-live-file-viewer-state", sync);
  };
}

export function initToolbarWidget(hostElement) {
  if (!hostElement) return;
  if (typeof hostElement.__nvCleanupLiveFileViewerToggle === "function") {
    hostElement.__nvCleanupLiveFileViewerToggle();
  }
  render(hostElement);
}
