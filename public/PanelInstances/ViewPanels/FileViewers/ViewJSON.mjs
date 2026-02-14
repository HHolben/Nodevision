// Nodevision/public/PanelInstances/ViewPanels/FileViewers/ViewJSON.mjs
// This file fetches JSON resources and renders them as formatted, readable text.

export async function renderFile(filename, viewPanel, iframe, serverBase) {
  const url = `${serverBase}/${filename}`;
  viewPanel.innerHTML = "";

  try {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();
    const pre = document.createElement("pre");
    pre.style.margin = "0";
    pre.style.padding = "1rem";
    pre.style.whiteSpace = "pre-wrap";
    pre.style.wordBreak = "break-word";
    pre.textContent = JSON.stringify(data, null, 2);
    viewPanel.appendChild(pre);
  } catch (error) {
    viewPanel.innerHTML = `<p style="color:#b00020;">Failed to render JSON: ${error.message}</p>`;
  }
}
