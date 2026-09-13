// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/FileViewers/ViewPNG.mjs
// This file renders PNG images in the File Viewer and exposes viewer-only commands for deriving new files from the displayed raster. The vectorization command leaves the PNG unchanged and delegates conversion work to reusable raster vectorization modules.

import { openPngVectorizationOverlay } from "/RasterVectorization/RasterVectorizationLauncher.mjs";

function viewerUrl(serverBase, filename) {
  return String(serverBase || "/Notebook").replace(/\/+$/, "") + "/" + String(filename || "").replace(/^\/+/, "");
}

function styleImage(img) {
  img.style.width = "auto";
  img.style.height = "auto";
  img.style.maxWidth = "100%";
  img.style.maxHeight = "100%";
  img.style.objectFit = "contain";
  img.style.display = "block";
  img.style.flex = "0 0 auto";
  img.style.imageRendering = "pixelated";
}

function createToolbar(filename, serverBase) {
  const bar = document.createElement("div");
  Object.assign(bar.style, { position: "absolute", top: "8px", right: "8px", zIndex: "3", display: "flex", gap: "6px" });
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = "Vectorize";
  button.title = "Create a new SVG from this PNG";
  Object.assign(button.style, { border: "1px solid #64748b", borderRadius: "5px", background: "#fff", color: "#111827", padding: "6px 9px", cursor: "pointer" });
  button.addEventListener("click", async () => {
    button.disabled = true;
    button.textContent = "Loading...";
    try {
      await openPngVectorizationOverlay(filename, { serverBase });
    } finally {
      button.disabled = false;
      button.textContent = "Vectorize";
    }
  });
  bar.appendChild(button);
  return bar;
}

export async function renderFile(filename, viewPanel, iframe, serverBase) {
  viewPanel.dataset.nvZoomInlineFit = "scale-content";
  try {
    const url = viewerUrl(serverBase, filename);
    viewPanel.innerHTML = "";
    viewPanel.style.background = "repeating-conic-gradient(#ccc 0% 25%, #eee 0% 50%) 50% / 20px 20px";
    Object.assign(viewPanel.style, { display: "flex", alignItems: "center", justifyContent: "center", position: "relative" });
    const img = document.createElement("img");
    img.alt = filename;
    img.src = url + "?t=" + Date.now();
    styleImage(img);
    img.onload = () => { img.title = (img.naturalWidth || 0) + " x " + (img.naturalHeight || 0); };
    img.onerror = () => { viewPanel.innerHTML = '<p style="color:red;">Error loading PNG file.</p>'; };
    viewPanel.append(img, createToolbar(filename, serverBase));
  } catch (err) {
    console.error("Error loading PNG:", err);
    viewPanel.innerHTML = '<p style="color:red;">Error loading PNG file.</p>';
  }
}
