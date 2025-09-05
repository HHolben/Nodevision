// Nodevision/public/InfoPDF.js

(function () {
  /**
   * Render a PDF file inside an info panel using an iframe.
   * @param {string} filename - PDF file path relative to serverBase
   * @param {HTMLElement} infoPanel - Container to render the PDF
   * @param {string} serverBase - Optional base URL
   */
  function renderPDF(filename, infoPanel, serverBase = '') {
    infoPanel.innerHTML = '';

    const url = `${serverBase}/${filename}`;

    const iframe = document.createElement('iframe');
    iframe.src = url;
    iframe.style.width = '100%';
    iframe.style.height = '500px';
    iframe.style.border = '1px solid #ccc';

    infoPanel.appendChild(iframe);
  }

  // Expose globally
  window.renderPDF = renderPDF;
})();
