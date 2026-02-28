// Nodevision/public/PanelInstances/ViewPanels/ViewPDF.mjs
// Purpose: Render PDF files in a Nodevision view panel

export async function renderFile(filename, viewPanel, iframe, serverBase) {
  console.log("ViewPDF: initializing for", filename);

  if (!filename || !filename.toLowerCase().endsWith(".pdf")) {
    viewPanel.innerHTML = `<p>No PDF file selected.</p>`;
    return;
  }

  // Default server base if not provided
  serverBase = serverBase || "/Notebook";

  // Clear panel
  viewPanel.innerHTML = "";

  // Create outer container
  const container = document.createElement("div");
  container.style.width = "100%";
  container.style.height = "100%";
  container.style.overflow = "auto";
  viewPanel.appendChild(container);

  // Use existing iframe param or create a new one
  const pdfFrame = iframe || document.createElement("iframe");

  pdfFrame.src = `${serverBase}/${encodeURIComponent(filename)}`;
  pdfFrame.style.width = "100%";
  pdfFrame.style.height = "600px";
  pdfFrame.style.border = "1px solid #ccc";

  pdfFrame.onload = () => console.log("PDF loaded:", filename);
  pdfFrame.onerror = () => {
    pdfFrame.srcdoc = `<p style="color:red;">Error loading PDF: ${filename}</p>`;
  };

  container.appendChild(pdfFrame);
}
