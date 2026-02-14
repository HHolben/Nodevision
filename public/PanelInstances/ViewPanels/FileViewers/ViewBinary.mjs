// Nodevision/public/PanelInstances/ViewPanels/FileViewers/ViewBinary.mjs
// This file renders binary-file metadata and a direct download link when no structured preview is available.

export async function renderFile(filename, viewPanel, iframe, serverBase) {
  const url = `${serverBase}/${filename}`;
  viewPanel.innerHTML = "";

  try {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const blob = await response.blob();
    const size = blob.size.toLocaleString();

    const wrap = document.createElement("div");
    wrap.style.padding = "1rem";
    wrap.innerHTML = `
      <h3 style="margin:0 0 .5rem 0;">Binary Preview</h3>
      <p style="margin:.25rem 0;">File: <code>${filename}</code></p>
      <p style="margin:.25rem 0;">Size: <strong>${size}</strong> bytes</p>
      <p style="margin:.25rem 0;">No in-browser parser is available for this format.</p>
    `;

    const link = document.createElement("a");
    link.href = url;
    link.textContent = "Open or download file";
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    wrap.appendChild(link);

    viewPanel.appendChild(wrap);
  } catch (error) {
    viewPanel.innerHTML = `<p style="color:#b00020;">Failed to load binary file: ${error.message}</p>`;
  }
}
