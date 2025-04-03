// InfoPanel.js

var iframe = document.getElementById('content-frame');

function updateInfoPanel(element) {
  const infoPanel = document.getElementById('element-info');
  if (!infoPanel) {
    console.error('Info panel element not found.');
    return;
  }
  
  let infoHTML = '';

  // Check if the element is a Cytoscape element by testing for the id() function.
  if (element && typeof element.id === 'function') {
    console.log("updating info panel for " + element.id());
    
    // If it is a node
    if (element.isNode && element.isNode()) {
      infoHTML = `<strong>Node:</strong> ${element.data('label')}<br>`;
      window.ActiveNode = element.id();
      infoHTML += `<strong>ID:</strong> ${window.ActiveNode}<br>`;


      // Check if this is a special "region" type node.
      if (element.data('type') === 'region') {
        infoHTML += `<strong>Type:</strong> Region<br>`;
        iframe.src = ''; // Clear the iframe for regions
        infoHTML += `<button id="expand-btn">Expand</button>`;
        if (element.isParent && element.isParent()) {
          infoHTML += `<button id="collapse-btn">Collapse</button>`;
        }
      } else {
        infoHTML += `<strong>Type:</strong> Node<br>`;
        // Load file content in the iframe based on the node's ID.
        const SelectedServerPath = `localhost:3000/Notebook`;
        iframe.src = `http://${SelectedServerPath}/${element.id()}`;
        iframe.onload = function() {
          const scale = 0.5; // Adjust the scale factor as needed
          const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
          const styleElement = iframeDoc.createElement('style');
          styleElement.innerHTML = `body { transform: scale(${scale}); transform-origin: 0 0; width: ${100 / scale}%; height: ${100 / scale}%; }`;
          iframeDoc.head.appendChild(styleElement);
        };
      }
    }
    // Else, if it's an edge element.
    else if (element.isEdge && element.isEdge()) {
      infoHTML = `<strong>Edge:</strong> ${element.id()}<br>`;
      infoHTML += `<strong>Source:</strong> ${element.source().id()}<br>`;
      infoHTML += `<strong>Target:</strong> ${element.target().id()}<br>`;
      infoHTML += `<strong>Type:</strong> ${element.data('type') || 'Edge'}<br>`;
      iframe.src = ''; // Clear the iframe for edges
    }
  } else {
    // If not a Cytoscape element, assume it's a file identifier from the file view.
    console.log("selected " + element);
    const SelectedServerPath = `localhost:3000/Notebook`;
    iframe.src = `http://${SelectedServerPath}/${element}`;
    window.ActiveNode = element;
    infoHTML = `<p>File: ${element}</p>`;
  }

  infoPanel.innerHTML = infoHTML;

  // Attach event listeners for region nodes if necessary.
  if (element && typeof element.id === 'function' && element.data('type') === 'region') {
    const expandBtn = document.getElementById('expand-btn');
    if (expandBtn) {
      expandBtn.addEventListener('click', () => {
        expandRegion(element);
      });
    }
    if (element.isParent && element.isParent()) {
      const collapseBtn = document.getElementById('collapse-btn');
      if (collapseBtn) {
        collapseBtn.addEventListener('click', () => {
          collapseRegion(element);
        });
      }
    }
  }
}
