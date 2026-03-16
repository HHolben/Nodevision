// Nodevision/ApplicationSystem/public/PanelInstances/InfoPanels/GraphManagerDependencies/NormalizePath.mjs
// This file defines browser-side Normalize Path logic for the Nodevision UI. It renders interface components and handles user interactions.
export function normalizePath(path) {
    console.log("Normalizing path "+path);
    if (!path) return "";
    // Remove leading slash and replace multiple slashes with one
    return path.replace(/^\/+/, "").replace(/\/+/g, "/");
}