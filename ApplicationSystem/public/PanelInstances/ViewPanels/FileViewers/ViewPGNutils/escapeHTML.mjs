// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/FileViewers/ViewPGNutils/escapeHTML.mjs
// This file defines browser-side escape HTML logic for the Nodevision UI. It renders interface components and handles user interactions.
export function escapeHTML(str = "") {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
