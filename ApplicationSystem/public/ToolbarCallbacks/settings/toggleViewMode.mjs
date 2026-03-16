// Nodevision/ApplicationSystem/public/ToolbarCallbacks/settings/toggleViewMode.mjs
// This file defines browser-side toggle View Mode logic for the Nodevision UI. It renders interface components and handles user interactions.
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
