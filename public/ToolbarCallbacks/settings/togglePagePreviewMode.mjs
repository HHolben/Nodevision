// Nodevision/public/ToolbarCallbacks/settings/togglePagePreviewMode.mjs
// Toggle page preview mode and forward state to settings callbacks when available.
export default function togglePagePreviewMode() {
  window.NodevisionState = window.NodevisionState || {};
  const nextState = !Boolean(window.NodevisionState.pagePreviewModeEnabled);
  window.NodevisionState.pagePreviewModeEnabled = nextState;

  const cb = window.settingsCallbacks && window.settingsCallbacks.togglePagePreviewMode;
  if (typeof cb === 'function') {
    cb(nextState);
  } else {
    console.warn('togglePagePreviewMode callback not found on window.settingsCallbacks');
  }
}
