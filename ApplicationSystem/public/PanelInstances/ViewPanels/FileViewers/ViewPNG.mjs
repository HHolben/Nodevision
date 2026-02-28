//Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/FileViewers/ViewPNG.mjs
//This file renders a viewing area for png images.

/**
 * Renders a PNG file in the given view panel.
 * @param {string} filename - The path to the PNG file (relative to the server base).
 * @param {HTMLElement} viewPanel - The DOM element where the image will be displayed.
 * @param {HTMLElement} iframe - Not used for PNG viewing.
 * @param {string} serverBase - Base URL of the server to fetch the file from.
 */
export async function renderFile(filename, viewPanel, iframe, serverBase) {
  try {
    const url = `${serverBase}/${filename}`;

    viewPanel.innerHTML = '';
    viewPanel.style.background = `
      repeating-conic-gradient(#ccc 0% 25%, #eee 0% 50%)
      50% / 20px 20px
    `;

    const img = document.createElement('img');
    img.alt = filename;
    img.src = `${url}?t=${Date.now()}`;

    img.style.width = '100%';
    img.style.height = '100%';
    img.style.objectFit = 'contain';
    img.style.display = 'block';
    img.style.margin = '0 auto';
    // Keep scaled pixel art sharp (disable interpolation/blur).
    img.style.imageRendering = 'pixelated';

    img.onload = () => {
      img.title = `${img.naturalWidth} × ${img.naturalHeight}`;
    };

    img.onerror = () => {
      viewPanel.innerHTML =
        '<p style="color:red;">Error loading PNG file.</p>';
    };

    viewPanel.appendChild(img);
  } catch (err) {
    console.error('Error loading PNG:', err);
    viewPanel.innerHTML =
      '<p style="color:red;">Error loading PNG file.</p>';
  }
}
