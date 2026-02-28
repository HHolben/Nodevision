// Nodevision/public/ToolbarCallbacks/settings/toggleViewMode.mjs
// Toggle graph/file view mode and forward state to settings callbacks when available.
export default function toggleViewMode() {
  window.NodevisionState = window.NodevisionState || {};
  const nextState = !Boolean(window.NodevisionState.viewModeEnabled);
  window.NodevisionState.viewModeEnabled = nextState;

  const cb = window.settingsCallbacks && window.settingsCallbacks.toggleViewMode;
  if (typeof cb === 'function') {
    cb(nextState);
  } else {
    console.warn('toggleViewMode callback not found on window.settingsCallbacks');
  }
}
