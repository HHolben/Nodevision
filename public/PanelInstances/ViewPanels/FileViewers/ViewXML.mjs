// Nodevision/public/PanelInstances/ViewPanels/FileViewers/ViewXML.mjs
// This file fetches XML-like text and renders it in a formatted preformatted block.

export async function renderFile(filename, viewPanel, iframe, serverBase) {
  const url = `${serverBase}/${filename}`;
  viewPanel.innerHTML = "";

  try {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const text = await response.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(text, "application/xml");
    const parserError = doc.querySelector("parsererror");

    const pre = document.createElement("pre");
    pre.style.margin = "0";
    pre.style.padding = "1rem";
    pre.style.whiteSpace = "pre-wrap";
    pre.textContent = text;
    viewPanel.appendChild(pre);

    if (parserError) {
      const warning = document.createElement("p");
      warning.style.color = "#b45309";
      warning.style.padding = "0 1rem 1rem 1rem";
      warning.textContent = "XML parser reported a syntax warning while rendering.";
      viewPanel.appendChild(warning);
    }
  } catch (error) {
    viewPanel.innerHTML = `<p style="color:#b00020;">Failed to render XML: ${error.message}</p>`;
  }
}
