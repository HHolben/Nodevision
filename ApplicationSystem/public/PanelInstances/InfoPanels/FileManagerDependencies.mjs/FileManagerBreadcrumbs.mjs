// Nodevision/ApplicationSystem/public/PanelInstances/InfoPanels/FileManagerDependencies.mjs/FileManagerBreadcrumbs.mjs
// This file defines browser-side File Manager Breadcrumbs logic for the Nodevision UI. It renders interface components and handles user interactions.
function normalizePath(value = "") {
  let text = String(value || "").split(String.fromCharCode(92)).join("/").trim();
  while (text.startsWith("/")) text = text.slice(1);
  while (text.includes("//")) text = text.replaceAll("//", "/");
  return text;
}

export function renderBreadcrumbs(state) {
  const pathElem = state.panelElem.querySelector("#fm-path");
  if (!pathElem) return;
  pathElem.innerHTML = "";

  const addCrumb = (label, path) => {
    const link = document.createElement("a");
    link.href = "#";
    link.textContent = label;
    link.addEventListener("click", (event) => {
      event.preventDefault();
      state.refresh?.(path);
    });
    pathElem.appendChild(link);
  };

  addCrumb("Notebook", "");
  let cumulative = "";
  normalizePath(state.currentPath).split("/").filter(Boolean).forEach((segment) => {
    pathElem.appendChild(document.createTextNode(" / "));
    cumulative = cumulative ? `${cumulative}/${segment}` : segment;
    addCrumb(segment, cumulative);
  });
}
