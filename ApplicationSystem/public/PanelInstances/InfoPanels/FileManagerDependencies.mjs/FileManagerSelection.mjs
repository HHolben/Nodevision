// Nodevision/ApplicationSystem/public/PanelInstances/InfoPanels/FileManagerDependencies.mjs/FileManagerSelection.mjs
// This file defines browser-side File Manager Selection logic for the Nodevision UI. It renders interface components and handles user interactions.
export function attachSelectionHandlers(state, link) {
  link.addEventListener("click", e => {
    e.preventDefault();
    state.selectedPath = link.dataset.fullPath;

    state.panelElem
      .querySelectorAll(".selected")
      .forEach(el => el.classList.remove("selected"));

    link.classList.add("selected");
  });
}
