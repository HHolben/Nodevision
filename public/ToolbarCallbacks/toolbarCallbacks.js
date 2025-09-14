// toolbarCallbacks.js
// All callbacks are available via window after their respective files load

window.toolbarCallbacks = {
  ...window.fileCallbacks,
  ...window.editCallbacks,
  ...window.settingsCallbacks,
  ...window.insertCallbacks
};
