// Nodevision/public/InfoODT.js

// Requires: JSZip (add to index.html if not already included)
// <script src="https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js"></script>

(function () {
  console.log("InfoODT.js loaded");

  async function InfoODT(filename, infoPanel, serverBase) {
    const iframe = document.getElementById("content-frame");
    if (!iframe) {
      console.error("No content-frame found for ODT viewer.");
      return;
    }

    const fileUrl = serverBase + "/" + filename;

    // show loading indicator
    const doc = iframe.contentDocument || iframe.contentWindow.document;
    doc.open();
    doc.write("<p>Loading ODT...</p>");
    doc.close();

    try {
      const response = await fetch(fileUrl);
      if (!response.ok) throw new Error(`Failed to fetch ${fileUrl}`);
      const buffer = await response.arrayBuffer();

      const zip = await JSZip.loadAsync(buffer);
      if (!zip.files["content.xml"]) {
        throw new Error("ODT missing content.xml");
      }

      const xmlText = await zip.files["content.xml"].async("text");
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlText, "text/xml");

      // Extract paragraphs
      const paragraphs = Array.from(xmlDoc.getElementsByTagName("text:p"));
      let html = paragraphs.map(p => `<p>${p.textContent}</p>`).join("");

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

      infoPanel.innerHTML = `<p><strong>ODT File:</strong> ${filename}</p>`;

    } catch (err) {
      console.error("Error rendering ODT:", err);
      doc.open();
      doc.write(`<p style="color:red;">Error loading ODT file.</p>`);
      doc.close();
    }
  }

  // Expose globally
  window.InfoODT = InfoODT;
})();
