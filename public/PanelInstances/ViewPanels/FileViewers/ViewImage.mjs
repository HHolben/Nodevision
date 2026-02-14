// Nodevision/public/PanelInstances/ViewPanels/FileViewers/ViewImage.mjs
// This file renders image files inside the view panel with a contained responsive preview.

export async function renderFile(filename, viewPanel, iframe, serverBase) {
  viewPanel.innerHTML = "";

  const img = document.createElement("img");
  img.src = `${serverBase}/${filename}?t=${Date.now()}`;
  img.alt = filename;
  img.style.width = "100%";
  img.style.height = "100%";
  img.style.objectFit = "contain";
  img.style.display = "block";

  img.onerror = () => {
    viewPanel.innerHTML = `<p style="color:#b00020;">Unable to load image: ${filename}</p>`;
  };

  viewPanel.appendChild(img);
}
