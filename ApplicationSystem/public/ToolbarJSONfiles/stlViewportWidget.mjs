// Nodevision/ApplicationSystem/public/ToolbarJSONfiles/stlViewportWidget.mjs
// Compact View toolbar widget for STL viewport options.

function getActiveStlViewer() {
  const viewer = window.__nvStlViewerApi;
  if (!viewer || typeof viewer.setFloorGridVisible !== "function") return null;
  if (typeof viewer.getFloorGridVisible !== "function") return null;
  return viewer;
}

function setUnavailable(hostElement) {
  hostElement.innerHTML = `
    <span style="display:flex;align-items:center;height:28px;padding:0 8px;font:12px system-ui, -apple-system, Segoe UI, sans-serif;color:#64748b;white-space:nowrap;">
      No active STL viewport
    </span>
  `;
}

export function initToolbarWidget(hostElement) {
  if (!hostElement) return;

  const viewer = getActiveStlViewer();
  if (!viewer) {
    setUnavailable(hostElement);
    return;
  }

  hostElement.innerHTML = `
    <label style="display:flex;align-items:center;gap:6px;height:28px;padding:0 8px;font:12px system-ui, -apple-system, Segoe UI, sans-serif;color:#1f2937;white-space:nowrap;">
      <input data-nv-stl-floor-grid type="checkbox" style="width:16px;height:16px;margin:0;" />
      <span>Floor grid</span>
    </label>
  `;

  const checkbox = hostElement.querySelector("[data-nv-stl-floor-grid]");
  if (!checkbox) return;

  const syncFromViewer = () => {
    const activeViewer = getActiveStlViewer();
    checkbox.disabled = !activeViewer;
    checkbox.checked = activeViewer ? activeViewer.getFloorGridVisible() : false;
  };

  checkbox.addEventListener("change", () => {
    const activeViewer = getActiveStlViewer();
    if (!activeViewer) {
      syncFromViewer();
      return;
    }
    activeViewer.setFloorGridVisible(checkbox.checked);
  });

  if (window.__nvStlViewportWidgetListener) {
    window.removeEventListener("nv-stl-viewer-grid-changed", window.__nvStlViewportWidgetListener);
  }
  window.__nvStlViewportWidgetListener = syncFromViewer;
  window.addEventListener("nv-stl-viewer-grid-changed", syncFromViewer);

  syncFromViewer();
}
