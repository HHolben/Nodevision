// Nodevision/public/InfoSVG.js

function InfoSVG(filename, infoPanel, serverBase) {
  console.log("InfoSVG: rendering " + filename);

  // Clear the panel
  infoPanel.innerHTML = '';

  // Create iframe to display the SVG
  const iframe = document.createElement('iframe');
  iframe.src = serverBase + '/' + filename;
  iframe.width = '100%';
  iframe.height = '600px';
  iframe.style.border = '1px solid #ccc';
  iframe.style.background = 'white';

  infoPanel.appendChild(iframe);
}

// Expose globally
window.InfoSVG = InfoSVG;
