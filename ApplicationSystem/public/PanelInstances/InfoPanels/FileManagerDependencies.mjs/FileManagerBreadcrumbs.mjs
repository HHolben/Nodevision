// Nodevision/ApplicationSystem/public/PanelInstances/InfoPanels/FileManagerDependencies.mjs/FileManagerBreadcrumbs.mjs
// This file defines browser-side File Manager Breadcrumbs logic for the Nodevision UI. It renders interface components and handles user interactions.
export function renderBreadcrumbs(state) {
  const pathElem = state.panelElem.querySelector("#fm-path");
  pathElem.innerHTML = "";

  const segments = state.currentPath.split("/").filter(Boolean);

  let cumulative = "";
  segments.forEach(seg => {
    cumulative += "/" + seg;
    const a = document.createElement("a");
    a.textContent = seg;
    a.href = "#";
    a.onclick = () => state.refresh(cumulative.slice(1));
    pathElem.appendChild(a);
    pathElem.append(" / ");
  });
}
