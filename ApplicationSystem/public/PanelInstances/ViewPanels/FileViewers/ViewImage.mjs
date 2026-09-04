// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/FileViewers/ViewImage.mjs
// This file renders image files inside the view panel with a contained responsive preview.

export async function renderFile(filename, viewPanel, iframe, serverBase) {
  viewPanel.dataset.nvZoomInlineFit = "scale-content";
  viewPanel.innerHTML = "";

  const img = document.createElement("img");
  img.src = `${serverBase}/${filename}?t=${Date.now()}`;
  img.alt = filename;
  viewPanel.style.display = "flex";
  viewPanel.style.alignItems = "center";
  viewPanel.style.justifyContent = "center";

  img.style.width = "auto";
  img.style.height = "auto";
  img.style.maxWidth = "100%";
  img.style.maxHeight = "100%";
  img.style.objectFit = "contain";
  img.style.display = "block";
  img.style.flex = "0 0 auto";
  if (String(filename).toLowerCase().endsWith(".png")) {
    // Keep pixel-art PNGs sharp when scaled in the viewer.
    img.style.imageRendering = "pixelated";
  }

  img.onerror = () => {
    viewPanel.innerHTML = `<p style="color:#b00020;">Unable to load image: ${filename}</p>`;
  };

  viewPanel.appendChild(img);
}
