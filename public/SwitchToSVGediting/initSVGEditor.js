// Nodevision/public/SwitchToSVGediting/initSVGEditor.js
(function() {
  // Determine active node and filePath
  let activeNode = window.ActiveNode;
  if (!activeNode) {
    const params = new URLSearchParams(window.location.search);
    activeNode = params.get('activeNode');
  }
  if (!activeNode) {
    console.error('No activeNode specified.');
    return;
  }

  const filePath = 'Notebook/' + activeNode;

  // Expose filePath globals for callbacks
  window.filePath = filePath;
  window.currentActiveFilePath = filePath;

  // Switch editing mode
  if (window.AppState && typeof window.AppState.setMode === 'function') {
    window.AppState.setMode('SVG Editing');
  } else {
    window.currentMode = 'SVG Editing';
  }

  // Inject SVG editor container into right-plane
  const container = document.getElementById('content-frame-container');
  if (!container) {
    console.error("Target container 'content-frame-container' not found.");
    return;
  }

  container.innerHTML = `
    <div id="ScrollableSVGEditor" style="width:100%; height:100%; overflow:auto;">
      <div style="padding: 10px; background: #f0f0f0; border-bottom: 1px solid #ccc;">
        <button id="svg-select-tool" class="svg-tool-btn active" title="Select Tool">Select</button>
        <button id="svg-save-btn" class="svg-tool-btn" title="Save SVG">Save</button>
        <button id="svg-clear-btn" class="svg-tool-btn" title="Clear Canvas">Clear</button>
        <span style="margin-left: 20px; font-weight: bold;">Selected: <span id="selected-info">None</span></span>
      </div>
      <svg id="svg-editor" width="100%" height="400" viewBox="0 0 800 400" style="border:1px solid #ccc; background: white; display: block;">
        <!-- SVG content will be loaded here -->
      </svg>
      <p id="svg-message" style="margin: 10px; color: #666;"></p>
      <p id="svg-error" style="color:red; margin: 10px;"></p>
    </div>
  `;
  
  // Add CSS for toolbar buttons
  const style = document.createElement('style');
  style.textContent = `
    .svg-tool-btn {
      background: #fff;
      border: 1px solid #ccc;
      padding: 5px 10px;
      margin-right: 5px;
      cursor: pointer;
      border-radius: 3px;
    }
    .svg-tool-btn:hover {
      background: #e9e9e9;
    }
    .svg-tool-btn.active {
      background: #007cba;
      color: white;
    }
    .svg-selected {
      stroke: #ff0000 !important;
      stroke-width: 2 !important;
      stroke-dasharray: 5,5 !important;
    }
  `;
  document.head.appendChild(style);

  const svgEditor = document.getElementById('svg-editor');

  // Load SVG file content safely
  window.loadFileContents(filePath, function(content) {
    try {
      loadSVGContent(svgEditor, content || '');
      initSVGInteractions();
    } catch (err) {
      console.error("Failed to load SVG content:", err);
      document.getElementById('svg-error').textContent = err.message;
    }
  });

  // Safe SVG content loading function
  function loadSVGContent(svgElement, content) {
    // Clear existing content
    while (svgElement.firstChild) {
      svgElement.removeChild(svgElement.firstChild);
    }
    
    if (!content.trim()) {
      return; // Empty content
    }
    
    try {
      // Parse SVG content safely
      const parser = new DOMParser();
      const doc = parser.parseFromString(content, 'image/svg+xml');
      
      // Check for parsing errors
      const errorElement = doc.querySelector('parsererror');
      if (errorElement) {
        console.warn('SVG parsing error:', errorElement.textContent);
        return;
      }
      
      // If the content is a full SVG document, extract its children
      const parsedSVG = doc.querySelector('svg');
      if (parsedSVG) {
        // Copy attributes from parsed SVG to our editor SVG
        const attrs = parsedSVG.attributes;
        for (let i = 0; i < attrs.length; i++) {
          const attr = attrs[i];
          if (attr.name !== 'id' && attr.name !== 'width' && attr.name !== 'height') {
            svgElement.setAttribute(attr.name, attr.value);
          }
        }
        
        // Move all child elements
        while (parsedSVG.firstChild) {
          svgElement.appendChild(parsedSVG.firstChild);
        }
      } else {
        // If not a full SVG, try to parse as SVG fragment
        const fragment = doc.documentElement;
        if (fragment && fragment.nodeName !== 'parsererror') {
          svgElement.appendChild(document.importNode(fragment, true));
        }
      }
    } catch (err) {
      console.error('Error parsing SVG content:', err);
      // Fallback: create a text element with error message
      const errorText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      errorText.setAttribute('x', '10');
      errorText.setAttribute('y', '30');
      errorText.setAttribute('fill', 'red');
      errorText.textContent = 'Error loading SVG: ' + err.message;
      svgElement.appendChild(errorText);
    }
  }

  // Initialize SVG interactions and event handlers
  function initSVGInteractions() {
    let selectedElement = null;
    let isDragging = false;
    let dragOffset = { x: 0, y: 0 };

    // Selection and interaction handling
    svgEditor.addEventListener('click', function(e) {
      if (window.currentSVGTool !== 'select') return;
      
      clearSelection();
      
      if (e.target !== svgEditor && e.target.tagName !== 'svg') {
        selectElement(e.target);
        e.stopPropagation();
      }
    });

    // Mouse down for dragging
    svgEditor.addEventListener('mousedown', function(e) {
      if (window.currentSVGTool === 'select' && selectedElement) {
        isDragging = true;
        const rect = svgEditor.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        
        if (selectedElement.tagName === 'rect') {
          const x = parseFloat(selectedElement.getAttribute('x') || 0);
          const y = parseFloat(selectedElement.getAttribute('y') || 0);
          dragOffset = { x: mouseX - x, y: mouseY - y };
        } else if (selectedElement.tagName === 'circle') {
          const cx = parseFloat(selectedElement.getAttribute('cx') || 0);
          const cy = parseFloat(selectedElement.getAttribute('cy') || 0);
          dragOffset = { x: mouseX - cx, y: mouseY - cy };
        }
        e.preventDefault();
      }
    });

    // Mouse move for dragging
    document.addEventListener('mousemove', function(e) {
      if (isDragging && selectedElement) {
        const rect = svgEditor.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        
        if (selectedElement.tagName === 'rect') {
          selectedElement.setAttribute('x', mouseX - dragOffset.x);
          selectedElement.setAttribute('y', mouseY - dragOffset.y);
        } else if (selectedElement.tagName === 'circle') {
          selectedElement.setAttribute('cx', mouseX - dragOffset.x);
          selectedElement.setAttribute('cy', mouseY - dragOffset.y);
        } else if (selectedElement.tagName === 'ellipse') {
          selectedElement.setAttribute('cx', mouseX - dragOffset.x);
          selectedElement.setAttribute('cy', mouseY - dragOffset.y);
        } else if (selectedElement.tagName === 'text') {
          selectedElement.setAttribute('x', mouseX - dragOffset.x);
          selectedElement.setAttribute('y', mouseY - dragOffset.y);
        }
      }
    });

    // Mouse up to stop dragging
    document.addEventListener('mouseup', function() {
      isDragging = false;
    });

    function selectElement(element) {
      selectedElement = element;
      window.selectedSVGElement = element;
      element.classList.add('svg-selected');
      updateSelectedInfo(element);
    }

    function clearSelection() {
      if (selectedElement) {
        selectedElement.classList.remove('svg-selected');
        selectedElement = null;
        window.selectedSVGElement = null;
        updateSelectedInfo(null);
      }
    }

    function updateSelectedInfo(element) {
      const info = document.getElementById('selected-info');
      if (element) {
        info.textContent = element.tagName.toUpperCase();
      } else {
        info.textContent = 'None';
      }
    }

    // Toolbar button handlers
    document.getElementById('svg-select-tool').addEventListener('click', () => {
      window.currentSVGTool = 'select';
      document.querySelectorAll('.svg-tool-btn').forEach(btn => btn.classList.remove('active'));
      document.getElementById('svg-select-tool').classList.add('active');
      document.getElementById('svg-message').textContent = 'Select tool active - click on shapes to select';
    });

    document.getElementById('svg-save-btn').addEventListener('click', () => {
      saveSVGToServer();
    });

    document.getElementById('svg-clear-btn').addEventListener('click', () => {
      if (confirm('Are you sure you want to clear the canvas?')) {
        svgEditor.innerHTML = '';
        clearSelection();
        document.getElementById('svg-message').textContent = 'Canvas cleared';
      }
    });

    // Initialize select tool as default
    window.currentSVGTool = 'select';
    document.getElementById('svg-message').textContent = 'SVG Editor ready - use toolbar to insert shapes';
  }

  // Enhanced save function that actually saves to server
  function saveSVGToServer() {
    const svgContent = svgEditor.outerHTML;
    
    fetch('/api/files/save', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        filePath: filePath,
        content: svgContent
      })
    })
    .then(response => response.json())
    .then(data => {
      if (data.success) {
        document.getElementById('svg-message').textContent = 'SVG saved successfully!';
      } else {
        document.getElementById('svg-error').textContent = 'Error saving SVG: ' + data.error;
      }
    })
    .catch(error => {
      console.error('Save error:', error);
      document.getElementById('svg-error').textContent = 'Network error while saving';
    });
  }

  // Initialize toolbar and insert callbacks for SVG
  if (window.initInsertCallbacks) {
    window.initInsertCallbacks(svgEditor);
  }

  console.log('Enhanced SVG editing initialized for:', filePath);
})();
