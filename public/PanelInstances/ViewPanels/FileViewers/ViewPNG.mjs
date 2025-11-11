//Nodevision/public/PanelInstances/ViewPanels/FileViewers/ViewPNG.mjs
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
    // Construct the full URL
    const url = `${serverBase}/${filename}`;

    // Clear any previous content
    viewPanel.innerHTML = '';

    // Create an image element
    const img = document.createElement('img');
    img.src = url;
    img.alt = filename;
    img.style.maxWidth = '100%';
    img.style.maxHeight = '100%';
    img.style.display = 'block';
    img.style.margin = '0 auto';

    // Append the image to the view panel
    viewPanel.appendChild(img);
  } catch (err) {
    console.error('Error loading PNG:', err);
    viewPanel.innerHTML = '<p style="color:red;">Error loading PNG file.</p>';
  }
}
