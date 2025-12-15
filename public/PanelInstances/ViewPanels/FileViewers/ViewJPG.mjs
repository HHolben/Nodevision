// Nodevision/public/PanelInstances/ViewPanels/FileViewers/ViewJPG.mjs
// This file renders a viewing area for JPG/JPEG images.

/**
 * Renders a JPG/JPEG file in the given view panel.
 * @param {string} filename - The path to the JPG file (relative to the server base).
 * @param {HTMLElement} viewPanel - The DOM element where the image will be displayed.
 * @param {HTMLElement} iframe - Not used for JPG viewing.
 * @param {string} serverBase - Base URL of the server to fetch the file from.
 */
export async function renderFile(filename, viewPanel, iframe, serverBase) {
  try {
    const url = `${serverBase}/${filename}`;

    // Clear previous content
    viewPanel.innerHTML = '';
    viewPanel.style.background = ''; // JPGs are opaque

    // Create image element
    const img = document.createElement('img');
    img.alt = filename;
    img.src = `${url}?t=${Date.now()}`; // cache-busting

    img.style.width = '100%';
    img.style.height = '100%';
    img.style.objectFit = 'contain';
    img.style.display = 'block';
    img.style.margin = '0 auto';

    img.onload = () => {
      img.title = `${img.naturalWidth} × ${img.naturalHeight}`;
    };

    img.onerror = () => {
      viewPanel.innerHTML =
        '<p style="color:red;">Error loading JPG file.</p>';
    };

    viewPanel.appendChild(img);
  } catch (err) {
    console.error('Error loading JPG:', err);
    viewPanel.innerHTML =
      '<p style="color:red;">Error loading JPG file.</p>';
  }
}
