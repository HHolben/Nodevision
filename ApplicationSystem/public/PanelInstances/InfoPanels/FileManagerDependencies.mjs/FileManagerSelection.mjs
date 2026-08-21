// Nodevision/ApplicationSystem/public/PanelInstances/InfoPanels/FileManagerDependencies.mjs/FileManagerSelection.mjs
// This file defines browser-side File Manager Selection logic for the Nodevision UI. It renders interface components and handles user interactions.
export function attachSelectionHandlers(state, link) {
  link.addEventListener("click", e => {
    e.preventDefault();
    const selectedPath = link.dataset.fullPath || "";
    const selectedIsDirectory = link.dataset.isDirectory === "true";
    state.selectedPath = selectedPath;
    state.selectedIsDirectory = selectedIsDirectory;

    state.panelElem
      .querySelectorAll(".selected")
      .forEach(el => el.classList.remove("selected"));

    link.classList.add("selected");
    if (typeof state.onSelectionChange === "function") {
      state.onSelectionChange({
        path: selectedPath,
        isDirectory: selectedIsDirectory,
        element: link,
      });
    }
  });
}
