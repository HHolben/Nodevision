// Nodevision/ApplicationSystem/public/ToolbarCallbacks/toolbarCallbacks.js
// This file defines browser-side toolbar Callbacks logic for the Nodevision UI. It renders interface components and handles user interactions.
// toolbarCallbacks.js
// Purpose: TODO: Add description of module purpose
// All callbacks are available via window after their respective files load

window.toolbarCallbacks = {
  ...window.fileCallbacks,
  ...window.editCallbacks,
  ...window.settingsCallbacks,
  ...window.insertCallbacks
};
