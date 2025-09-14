// Nodevision/public/InfoPanel.js
var iframe = document.getElementById('content-frame');

function updateInfoPanel(element) {
  var infoPanel = document.getElementById('element-info');
  if (!infoPanel) {
    console.error('Info panel element not found.');
    return;
  }
  
  var serverBase = 'http://localhost:3000/Notebook';
  var infoHTML = '';

  // Cytoscape element
  if (element && typeof element.id === 'function') {
    console.log('updating info panel for ' + element.id());
    infoPanel.innerHTML = '';
    iframe.src = '';

    if (element.isNode && element.isNode()) {
      infoHTML = '<strong>Node:</strong> ' + element.data('label') + '<br>';
      window.ActiveNode = element.id();
      infoHTML += '<strong>ID:</strong> ' + window.ActiveNode + '<br>';
      
      if (element.data('type') === 'region') {
        infoHTML += '<strong>Type:</strong> Region<br>';
        infoHTML += '<button id="expand-btn">Expand</button>';
        if (element.isParent && element.isParent()) {
          infoHTML += '<button id="collapse-btn">Collapse</button>';
        }
        infoPanel.innerHTML = infoHTML;
        attachRegionButtons(element);
        return;
      }
      
      // node file
      var filename = element.id();
      var lower = filename.toLowerCase();
      if (lower.endsWith('.csv')) {
        renderCSV(filename, infoPanel, serverBase);
        return;
      } else if (lower.endsWith('.scad')) {
        renderSCAD(filename, infoPanel, serverBase);
        return;
      } else {
        infoHTML += '<strong>Type:</strong> Node<br>';
        infoPanel.innerHTML = infoHTML;
        renderHTML(filename, iframe, serverBase, 0.5);
        return;
      }
    }
    else if (element.isEdge && element.isEdge()) {
      infoHTML = '<strong>Edge:</strong> ' + element.id() + '<br>';
      infoHTML += '<strong>Source:</strong> ' + element.source().id() + '<br>';
      infoHTML += '<strong>Target:</strong> ' + element.target().id() + '<br>';
      infoHTML += '<strong>Type:</strong> ' + (element.data('type') || 'Edge') + '<br>';
      infoPanel.innerHTML = infoHTML;
      return;
    }
  }

  // plain file selected via fileView
  console.log('selected ' + element);
  var filename = element;
  window.ActiveNode = filename;
  iframe.src = '';
  var lower = filename.toLowerCase();

  if (lower.endsWith('.css')) {
    window.InfoCSS(filename, infoPanel, serverBase);
    return;
  }else if (lower.endsWith('.csv')) {
    renderCSV(filename, infoPanel, serverBase);
    return;
  } else if (lower.endsWith('.wav') || lower.endsWith('.wave.csv')) {
    renderWAV(filename, infoPanel, serverBase);
    return;
  }
  else if (lower.endsWith('.pdf')) {
    renderPDF(filename, infoPanel, serverBase);
    return;
    }
else if (lower.endsWith('.scad')) {
    renderSCAD(filename, infoPanel, serverBase);
    return;
  } else if (lower.endsWith('.stl')) {
    renderSTL(filename, infoPanel, serverBase);
    return;
      } else if (lower.endsWith('.svg')) {
    window.InfoSVG(filename, infoPanel, serverBase);
    return;
    } else if (lower.endsWith('.png') || lower.endsWith('.jpg') || lower.endsWith('.jpeg') || lower.endsWith('.gif') || lower.endsWith('.bmp') || lower.endsWith('.webp')) {
    renderRasterImage(filename, infoPanel, serverBase);
    return;
    } else if (lower.endsWith('.xml')) {
    window.renderQTI(filename, infoPanel, serverBase);
    return;
      } else if (lower.endsWith('.kml')) {
    renderKML(filename, infoPanel, serverBase);
    return;
  } else if (lower.endsWith('.mp3')) {
    window.InfoMP3(filename, infoPanel, serverBase);
    return;
  } else if (lower.endsWith('.mp4')) {
    window.InfoMP4(filename, infoPanel, serverBase);
    return;
  } else if (lower.endsWith('.odt')) {
    window.InfoODT(filename, infoPanel, serverBase);
    return;
  } else if (lower.endsWith('.ttf')) {
    window.getFontInfo(filename, infoPanel, serverBase);
    return;
  } else if (lower.endsWith('.mid')) {
    window.renderMIDI(filename, infoPanel, serverBase);
    return;
      } else if (lower.endsWith('.td.json')) {
    window.InfoThingDescription(filename, infoPanel, serverBase);
    return;
    } else {
    infoPanel.innerHTML = '<p>File: ' + filename + '</p>';
    renderHTML(filename, iframe, serverBase, 0.5);
    return;
  }
}

function attachRegionButtons(element) {
  var exp = document.getElementById('expand-btn');
  if (exp) exp.addEventListener('click', function() { expandRegion(element); });
  var col = document.getElementById('collapse-btn');
  if (col) col.addEventListener('click', function() { collapseRegion(element); });
}

// Render raster images with edit option (SECURITY FIX: use DOM APIs instead of innerHTML)
function renderRasterImage(filename, infoPanel, serverBase) {
  const imagePath = `/Notebook/${filename}`;
  
  // Clear the info panel safely
  infoPanel.innerHTML = '';
  
  // Create container using DOM APIs for security
  const container = document.createElement('div');
  container.style.padding = '10px';
  
  // Create title
  const title = document.createElement('h3');
  title.textContent = 'Raster Image';
  
  // Create file info
  const fileInfo = document.createElement('p');
  const fileLabel = document.createElement('strong');
  fileLabel.textContent = 'File: ';
  fileInfo.appendChild(fileLabel);
  fileInfo.appendChild(document.createTextNode(filename)); // Safe: use createTextNode for user data
  
  // Create image container
  const imageContainer = document.createElement('div');
  imageContainer.style.margin = '10px 0';
  
  // Create image element
  const img = document.createElement('img');
  img.src = imagePath;
  img.style.cssText = 'max-width: 100%; height: auto; border: 1px solid #ccc;';
  
  // Create error fallback
  const errorDiv = document.createElement('div');
  errorDiv.style.cssText = 'display: none; padding: 20px; background: #f5f5f5; border: 1px solid #ccc; text-align: center;';
  
  const errorMsg1 = document.createElement('p');
  errorMsg1.textContent = 'Image preview not available';
  
  const errorMsg2 = document.createElement('p');
  errorMsg2.style.cssText = 'font-size: 12px; color: #666;';
  errorMsg2.textContent = filename; // Safe: use textContent for user data
  
  errorDiv.appendChild(errorMsg1);
  errorDiv.appendChild(errorMsg2);
  
  // Handle image load error
  img.onerror = function() {
    img.style.display = 'none';
    errorDiv.style.display = 'block';
  };
  
  imageContainer.appendChild(img);
  imageContainer.appendChild(errorDiv);
  
  // Create button container
  const buttonContainer = document.createElement('div');
  buttonContainer.style.marginTop = '10px';
  
  // Create edit button
  const editBtn = document.createElement('button');
  editBtn.id = 'edit-raster-btn';
  editBtn.style.cssText = 'background: #4CAF50; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; margin-right: 5px;';
  editBtn.textContent = '✏️ Edit Image';
  
  // Create view button
  const viewBtn = document.createElement('button');
  viewBtn.id = 'view-raster-btn';
  viewBtn.style.cssText = 'background: #2196F3; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer;';
  viewBtn.textContent = '👁️ View Full Size';
  
  buttonContainer.appendChild(editBtn);
  buttonContainer.appendChild(viewBtn);
  
  // Assemble the complete interface
  container.appendChild(title);
  container.appendChild(fileInfo);
  container.appendChild(imageContainer);
  container.appendChild(buttonContainer);
  infoPanel.appendChild(container);
  
  // Bind edit button (FIX: Load scripts in-place without navigation)
  editBtn.addEventListener('click', () => {
    console.log('Switching to raster editing mode for:', filename);
    
    // Update URL without navigation to preserve scripts
    const editUrl = `?path=${encodeURIComponent(filename)}`;
    window.history.pushState({ editing: filename }, '', editUrl);
    
    // Set global file path for the raster editor
    window.filePath = filename;
    
    // Load the raster editing script in-place
    const script = document.createElement('script');
    script.src = 'SwitchToRasterEditing.js';
    script.defer = true;
    script.onload = () => {
      console.log('Raster editing scripts loaded successfully');
    };
    script.onerror = () => {
      console.error('Failed to load raster editing scripts');
    };
    document.head.appendChild(script);
  });
  
  // Bind view button
  viewBtn.addEventListener('click', () => {
    window.open(imagePath, '_blank');
  });
}

// expose globally
window.renderCSV = renderCSV;
window.renderHTML = renderHTML;
window.renderSCAD = renderSCAD;
window.renderKML = renderKML;
window.renderRasterImage = renderRasterImage;
window.updateInfoPanel = updateInfoPanel;
