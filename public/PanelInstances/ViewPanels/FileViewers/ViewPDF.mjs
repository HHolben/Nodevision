// Nodevision/public/PanelInstances/ViewPanels/ViewPDF.mjs
// Purpose: Render PDF files in a Nodevision view panel

export async function setupPanel(panel, instanceVars = {}) {
  const filePath = window.selectedFilePath || instanceVars.filePath || '';
  const serverBase = '/Notebook';

  console.log('ViewPDF: initializing for', filePath);

  if (!filePath.toLowerCase().endsWith('.pdf')) {
    panel.innerHTML = `<p>No PDF file selected.</p>`;
    return;
  }

  // Clear panel
  panel.innerHTML = '';

  // Create container
  const container = document.createElement('div');
  container.style.width = '100%';
  container.style.height = '100%';
  container.style.overflow = 'auto';
  panel.appendChild(container);

  // Create iframe
  const iframe = document.createElement('iframe');
  iframe.src = `${serverBase}/${encodeURIComponent(filePath)}`;
  iframe.style.width = '100%';
  iframe.style.height = '600px';
  iframe.style.border = '1px solid #ccc';
  iframe.onload = () => console.log('PDF loaded:', filePath);
  iframe.onerror = () => {
    iframe.srcdoc = `<p style="color:red;">Error loading PDF: ${filePath}</p>`;
  };

  container.appendChild(iframe);
}
