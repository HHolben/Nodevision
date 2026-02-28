// Nodevision/public/PanelInstances/ViewPanels/ViewODT.mjs
// Purpose: Display .odt (OpenDocument Text) files inside a panel using JSZip to extract content.xml

import JSZip from "../../../lib/jszip/jszip.min.js";

export async function renderFile(filename, viewPanel, serverBase) {

  console.log("ViewODT: rendering", filename);

  // Clear the panel and create iframe
  viewPanel.innerHTML = "";
  const iframe = document.createElement("iframe");
  iframe.width = "100%";
  iframe.height = "600px";
  iframe.style.border = "1px solid #ccc";
  iframe.style.background = "white";
  viewPanel.appendChild(iframe);

  const fileUrl = `${serverBase}/${filename}`;
  const doc = iframe.contentDocument || iframe.contentWindow.document;
  doc.open();
  doc.write("<p>Loading ODT...</p>");
  doc.close();

  try {
    const response = await fetch(fileUrl);
    if (!response.ok) throw new Error(`Failed to fetch ${fileUrl}`);
    const buffer = await response.arrayBuffer();

    const zip = await JSZip.loadAsync(buffer);
    if (!zip.files["content.xml"]) throw new Error("ODT missing content.xml");

    const xmlText = await zip.files["content.xml"].async("text");
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, "text/xml");

    // Extract paragraphs
    const paragraphs = Array.from(xmlDoc.getElementsByTagName("text:p"));
    const html = paragraphs.map(p => `<p>${p.textContent}</p>`).join("");

    doc.open();
    doc.write(`
      <html>
      <head>
        <style>
          body { font-family: sans-serif; padding: 1rem; line-height: 1.5; }
          p { margin-bottom: 0.75rem; }
        </style>
      </head>
      <body>
        ${html}
      </body>
      </html>
    `);
    doc.close();

    console.log(`ViewODT: successfully rendered ${filename}`);
  } catch (err) {
    console.error("Error rendering ODT:", err);
    doc.open();
    doc.write(`<p style="color:red;">Error loading ODT file.</p>`);
    doc.close();
  }
}
