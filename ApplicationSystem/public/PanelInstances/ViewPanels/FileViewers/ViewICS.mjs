// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/FileViewers/ViewICS.mjs
// This file defines browser-side View ICS logic for the Nodevision UI.
// It routes .ics files into the dedicated ICS weekly calendar viewer.

export const wantsIframe = true;

function joinPath(base, file) {
  const cleanBase = String(base || "").replace(/\/+$/, "");
  const cleanFile = String(file || "").replace(/^\/+/, "");
  if (!cleanBase) {
    return `/${cleanFile}`;
  }
  if (!cleanFile) {
    return cleanBase;
  }
  return `${cleanBase}/${cleanFile}`;
}

export async function renderFile(filename, viewPanel, iframe, serverBase) {
  if (!filename) {
    viewPanel.innerHTML = `<p style="color:red;">No ICS file selected.</p>`;
    return;
  }

  if (!viewPanel.contains(iframe)) {
    viewPanel.innerHTML = "";
    viewPanel.appendChild(iframe);
  }

  Object.assign(iframe.style, {
    width: "100%",
    height: "100%",
    border: "none",
    display: "block"
  });

  const base = serverBase || "/Notebook";
  const fullPath = filename.startsWith("/")
    ? filename
    : joinPath(base, filename);

  const viewerPath = `/InfoPanels/ICSViewer/ICSViewer.html?file=${encodeURIComponent(fullPath)}`;
  iframe.src = viewerPath;
}
