// Nodevision/public/SwitchToSVGediting/saveSVG.js
// Purpose: TODO: Add description of module purpose
console.log("saveSVG.js loaded");

function saveSVG(filePath) {
  console.log("Saving SVG file:", filePath);
  
  // First, check if we're using the new Publisher-style SVG editor
  const svgEditor = document.getElementById("svg-editor");
  if (svgEditor && window.currentSaveSVG) {
    console.log("Using Publisher-style save function");
    window.currentSaveSVG();
    return;
  }
  
  // Fall back to iframe-based approach for legacy support
  const iframe = document.getElementById("content-frame");
  if (!iframe) {
    console.error("No content frame found for saving");
    return;
  }

  const doc = iframe.contentDocument || iframe.contentWindow.document;
  const svg = doc.querySelector("svg");
  if (!svg) {
    console.warn("No SVG found to save");
    return;
  }

  // Convert SVG element to string
  const svgData = new XMLSerializer().serializeToString(svg);
  
  // Actually save to server using the API
  fetch('/api/save', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      path: filePath,
      content: svgData
    })
  })
  .then(response => response.json())
  .then(data => {
    if (data.success) {
      console.log('SVG saved successfully to:', filePath);
      // Show success message if possible
      const messageEl = document.getElementById('svg-message');
      if (messageEl) {
        messageEl.textContent = 'SVG saved successfully!';
        messageEl.style.color = 'green';
      }
    } else {
      console.error('Error saving SVG:', data.error);
      const errorEl = document.getElementById('svg-error');
      if (errorEl) {
        errorEl.textContent = 'Error saving SVG: ' + data.error;
      }
    }
  })
  .catch(error => {
    console.error('Save error:', error);
    const errorEl = document.getElementById('svg-error');
    if (errorEl) {
      errorEl.textContent = 'Network error while saving SVG';
    }
  });
}

// Expose globally
window.saveSVG = saveSVG;
