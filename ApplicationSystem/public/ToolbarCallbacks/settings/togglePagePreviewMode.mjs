// Nodevision/ApplicationSystem/public/ToolbarCallbacks/settings/togglePagePreviewMode.mjs
// This file defines browser-side toggle Page Preview Mode logic for the Nodevision UI. It renders interface components and handles user interactions.
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
