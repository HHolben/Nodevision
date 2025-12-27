// Nodevision/public/PanelInstances/ViewPanels/FileViewers/ViewASC.mjs
// Generic ASCII (.asc) file viewer

export async function renderFile(panelElem, filePath, panelVars = {}) {
  panelElem.innerHTML = `
    <div class="asc-viewer">
      <pre class="asc-content">Loading...</pre>
    </div>
  `;

  const pre = panelElem.querySelector(".asc-content");

  try {
    const response = await fetch(filePath);
    if (!response.ok) {
      throw new Error(`Failed to load file: ${response.status}`);
    }

    const text = await response.text();
    pre.textContent = text;
  } catch (err) {
    console.error("ASC Viewer error:", err);
    pre.textContent = `Error loading ASCII file.\n\n${err.message}`;
  }
}
