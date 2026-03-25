// Nodevision/ApplicationSystem/public/SwitchToSVGediting/initSVGEditor.js
// This file defines browser-side init SVGEditor logic for the Nodevision UI. It renders interface components and handles user interactions.
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
	    <div id="ScrollableSVGEditor" style="width:100%; height:100%; overflow:auto; display: flex; flex-direction: column;">
      <!-- Publisher-style Toolbar -->
      <div id="publisher-toolbar" style="padding: 10px; background: #f8f8f8; border-bottom: 1px solid #ccc; display: flex; align-items: center; flex-wrap: wrap;">
        <!-- Selection Tools -->
        <div class="tool-group">
          <button id="svg-select-tool" class="svg-tool-btn active" title="Select Tool">Select</button>
          <button id="svg-text-tool" class="svg-tool-btn" title="Text Tool">Text</button>
        </div>
        
        <!-- Object Actions -->
        <div class="tool-group">
          <button id="svg-copy-btn" class="svg-tool-btn" title="Copy">Copy</button>
          <button id="svg-paste-btn" class="svg-tool-btn" title="Paste">Paste</button>
          <button id="svg-duplicate-btn" class="svg-tool-btn" title="Duplicate">Duplicate</button>
          <button id="svg-delete-btn" class="svg-tool-btn" title="Delete">Delete</button>
        </div>
        
        <!-- Alignment Tools -->
        <div class="tool-group">
          <button id="align-left-btn" class="svg-tool-btn" title="Align Left">◄</button>
          <button id="align-center-btn" class="svg-tool-btn" title="Align Center">═</button>
          <button id="align-right-btn" class="svg-tool-btn" title="Align Right">►</button>
          <button id="align-top-btn" class="svg-tool-btn" title="Align Top">▲</button>
          <button id="align-middle-btn" class="svg-tool-btn" title="Align Middle">⬇</button>
          <button id="align-bottom-btn" class="svg-tool-btn" title="Align Bottom">▼</button>
        </div>
        
        <!-- Layer Controls -->
        <div class="tool-group">
          <button id="bring-front-btn" class="svg-tool-btn" title="Bring to Front">↑↑</button>
          <button id="send-back-btn" class="svg-tool-btn" title="Send to Back">↓↓</button>
        </div>
        
        <!-- File Actions -->
        <div class="tool-group">
          <button id="svg-save-btn" class="svg-tool-btn" title="Save SVG">Save</button>
          <button id="svg-clear-btn" class="svg-tool-btn" title="Clear Canvas">Clear</button>
        </div>

        <!-- Grid Toggle -->
        <div class="tool-group">
          <label><input type="checkbox" id="grid-toggle"> Show Grid</label>
          <label><input type="checkbox" id="snap-toggle" checked> Snap to Grid</label>
        </div>

        <span style="margin-left: 20px; font-weight: bold;">Selected: <span id="selected-info">None</span></span>
      </div>

	      <!-- Main Editor Area -->
	      <div style="display: flex; flex: 1; min-width: 0;">
	        <!-- Ruler and Canvas Area -->
	        <div id="svg-editor-main" style="flex: 1; position: relative; display: flex; flex-direction: column; min-width: 0;">
	          <!-- Ruler Row -->
	          <div id="ruler-row" style="display: flex; height: 24px; flex: 0 0 auto;">
	            <div id="ruler-corner"></div>
	            <div id="h-ruler"><canvas id="h-ruler-canvas"></canvas></div>
	          </div>
	          
	          <!-- Canvas Row -->
	          <div id="canvas-row" style="display: flex; flex: 1; min-height: 0;">
	            <div id="v-ruler"><canvas id="v-ruler-canvas"></canvas></div>
	            <div id="canvas-container" style="flex: 1; position: relative; overflow: auto; min-width: 0;">
	              <svg id="svg-editor" width="800" height="600" viewBox="0 0 800 600" style="border:1px solid #ccc; background: white; display: block; position: relative;">
	                <!-- Grid Pattern -->
	                <defs>
	                  <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
                    <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#e0e0e0" stroke-width="1"/>
                  </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#grid)" id="grid-overlay" style="display: none;" />
                <!-- SVG content will be loaded here -->
              </svg>
              
              <!-- Selection Handles -->
              <div id="selection-handles" style="position: absolute; display: none; pointer-events: none;">
                <div class="handle nw-resize" data-handle="nw"></div>
                <div class="handle n-resize" data-handle="n"></div>
                <div class="handle ne-resize" data-handle="ne"></div>
                <div class="handle e-resize" data-handle="e"></div>
                <div class="handle se-resize" data-handle="se"></div>
                <div class="handle s-resize" data-handle="s"></div>
                <div class="handle sw-resize" data-handle="sw"></div>
                <div class="handle w-resize" data-handle="w"></div>
	              </div>
	            </div>
	          </div>
	        </div>

        <!-- Property Panel -->
        <div id="property-panel" style="width: 250px; background: #f5f5f5; border-left: 1px solid #ccc; padding: 10px; overflow-y: auto;">
          <h3 style="margin-top: 0;">Properties</h3>
          <div id="property-content">
            <p>Select an object to view its properties.</p>
          </div>
        </div>
      </div>

      <!-- Status Bar -->
      <div id="status-bar" style="background: #f0f0f0; border-top: 1px solid #ccc; padding: 5px 10px; font-size: 12px;">
        <span id="svg-message" style="color: #666;">SVG Editor ready - use toolbar to insert shapes</span>
        <span id="svg-error" style="color:red; margin-left: 20px;"></span>
      </div>

      <!-- Context Menu -->
      <div id="context-menu" class="context-menu" style="display: none;">
        <div class="context-item" data-action="copy">Copy</div>
        <div class="context-item" data-action="paste">Paste</div>
        <div class="context-item" data-action="duplicate">Duplicate</div>
        <div class="context-item" data-action="delete">Delete</div>
        <hr>
        <div class="context-item" data-action="bring-front">Bring to Front</div>
        <div class="context-item" data-action="send-back">Send to Back</div>
        <hr>
        <div class="context-item" data-action="properties">Properties</div>
      </div>
    </div>
  `;
  
  // Add enhanced CSS for Publisher-like interface
  const style = document.createElement('style');
  style.textContent = `
    /* Toolbar Styling */
    .tool-group {
      display: flex;
      align-items: center;
      margin-right: 15px;
      padding-right: 15px;
      border-right: 1px solid #ddd;
    }
    .tool-group:last-child {
      border-right: none;
    }
    .svg-tool-btn {
      background: #fff;
      border: 1px solid #ccc;
      padding: 6px 12px;
      margin-right: 3px;
      cursor: pointer;
      border-radius: 3px;
      font-size: 12px;
      min-width: 35px;
      text-align: center;
    }
    .svg-tool-btn:hover {
      background: #e9e9e9;
      border-color: #999;
    }
    .svg-tool-btn.active {
      background: #0078d4;
      color: white;
      border-color: #106ebe;
    }
    
    /* Selection Styling */
    .svg-selected {
      stroke: #0078d4 !important;
      stroke-width: 2 !important;
      stroke-dasharray: 5,5 !important;
    }
    
    /* Selection Handles */
    .handle {
      position: absolute;
      width: 8px;
      height: 8px;
      background: #0078d4;
      border: 1px solid #fff;
      border-radius: 2px;
      pointer-events: all;
    }
    .handle:hover {
      background: #106ebe;
    }
    .nw-resize { top: -4px; left: -4px; cursor: nw-resize; }
    .n-resize { top: -4px; left: calc(50% - 4px); cursor: n-resize; }
    .ne-resize { top: -4px; right: -4px; cursor: ne-resize; }
    .e-resize { top: calc(50% - 4px); right: -4px; cursor: e-resize; }
    .se-resize { bottom: -4px; right: -4px; cursor: se-resize; }
    .s-resize { bottom: -4px; left: calc(50% - 4px); cursor: s-resize; }
    .sw-resize { bottom: -4px; left: -4px; cursor: sw-resize; }
    .w-resize { top: calc(50% - 4px); left: -4px; cursor: w-resize; }
    
    /* Context Menu */
    .context-menu {
      position: fixed;
      background: white;
      border: 1px solid #ccc;
      border-radius: 4px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.2);
      z-index: 1000;
      min-width: 150px;
    }
    .context-item {
      padding: 8px 16px;
      cursor: pointer;
      border-bottom: 1px solid #f0f0f0;
    }
    .context-item:hover {
      background: #f0f8ff;
    }
    .context-item:last-child {
      border-bottom: none;
    }
    
    /* Property Panel */
    #property-panel h3 {
      color: #333;
      border-bottom: 1px solid #ddd;
      padding-bottom: 5px;
    }
    .property-group {
      margin-bottom: 15px;
    }
    .property-group label {
      display: block;
      font-weight: bold;
      margin-bottom: 5px;
      color: #555;
    }
    .property-group input, .property-group select {
      width: 100%;
      padding: 5px;
      border: 1px solid #ccc;
      border-radius: 3px;
      font-size: 12px;
    }
    .property-group input[type="color"] {
      height: 30px;
      padding: 2px;
    }
    .property-row {
      display: flex;
      gap: 5px;
    }
    .property-row input {
      flex: 1;
    }
    
	    /* Rulers */
	    #ruler-row {
	      user-select: none;
	    }
	    #ruler-corner {
	      width: 28px;
	      background: linear-gradient(#f7f7f7, #ececec);
	      border-right: 1px solid #cfcfcf;
	      border-bottom: 1px solid #cfcfcf;
	      box-shadow: inset 0 -1px 0 rgba(255,255,255,0.6);
	      flex: 0 0 auto;
	    }
	    #h-ruler {
	      flex: 1 1 auto;
	      position: relative;
	      background: linear-gradient(#f7f7f7, #ececec);
	      border-bottom: 1px solid #cfcfcf;
	      overflow: hidden;
	      box-shadow: inset 0 -1px 0 rgba(255,255,255,0.6);
	      min-width: 0;
	    }
	    #v-ruler {
	      width: 28px;
	      position: relative;
	      background: linear-gradient(to right, #f7f7f7, #ececec);
	      border-right: 1px solid #cfcfcf;
	      overflow: hidden;
	      box-shadow: inset -1px 0 0 rgba(255,255,255,0.6);
	      flex: 0 0 auto;
	    }
	    #h-ruler-canvas,
	    #v-ruler-canvas {
	      width: 100%;
	      height: 100%;
	      display: block;
	    }
	    #canvas-container {
	      --svg-editor-height: 600px;
	    }
	    #svg-editor {
	      width: 100%;
	      height: var(--svg-editor-height);
	    }
    
    /* Checkboxes in toolbar */
    .tool-group label {
      margin: 0 10px;
      font-size: 12px;
      display: flex;
      align-items: center;
      gap: 5px;
    }
    .tool-group input[type="checkbox"] {
      margin: 0;
    }
  `;
  document.head.appendChild(style);

  const svgEditor = document.getElementById('svg-editor');

  // Implement loadFileContents function if not available globally
  if (typeof window.loadFileContents !== 'function') {
    window.loadFileContents = function(filePath, callback) {
      if (!filePath) return;
      
      fetch(`/api/fileCodeContent?path=${encodeURIComponent(filePath)}`)
        .then(response => {
          if (!response.ok) {
            throw new Error('Network response was not ok');
          }
          return response.json();
        })
        .then(data => {
          if (typeof callback === 'function') {
            callback(data.content || '');
          }
        })
        .catch(error => {
          console.error('Error fetching file content:', error);
          if (typeof callback === 'function') {
            callback('');
          }
        });
    };
  }

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

  // Initialize Publisher-like SVG interactions and event handlers
		  function initSVGInteractions() {
		    let selectedElement = null;
		    let isDragging = false;
		    let isResizing = false;
		    let dragOffset = { x: 0, y: 0 };
		    let dragMode = null; // 'attrs' | 'transform'
		    let dragCoordElement = null;
		    let dragStart = { x: 0, y: 0 };
		    let dragStartClient = { x: 0, y: 0 };
		    let dragBaseTransform = '';
		    let dragBaseMatrix = null;
		    let dragClientToCenter = { x: 0, y: 0 };
		    let dragClientToCenter0 = { x: 0, y: 0 };
		    let dragStartCenter = { x: 0, y: 0 };
		    let suppressNextClick = false;
		    let resizeHandle = null;
		    let resizeCoordElement = null;
		    let resizeStartMouse = { x: 0, y: 0 };
		    let resizeStartBox = null;
		    let clipboard = null;
		    let gridSize = 20;

    // Initialize rulers
    initRulers();
    
	    // Initialize grid toggle
	    const gridToggle = document.getElementById('grid-toggle');
	    const snapToggle = document.getElementById('snap-toggle');
	    const gridOverlay = document.getElementById('grid-overlay');

		    function clientToSvgCoords(clientX, clientY, coordElement = svgEditor) {
		      try {
		        const el = coordElement && typeof coordElement.getScreenCTM === 'function' ? coordElement : svgEditor;
		        const ctm = el.getScreenCTM();
		        if (!ctm) {
		          const rect = svgEditor.getBoundingClientRect();
		          return { x: clientX - rect.left, y: clientY - rect.top };
		        }
	        const inverse = ctm.inverse();
	        if (typeof DOMPoint === 'function') {
	          const svgPoint = new DOMPoint(clientX, clientY).matrixTransform(inverse);
	          return { x: svgPoint.x, y: svgPoint.y };
	        }
	        if (typeof svgEditor.createSVGPoint === 'function') {
	          const pt = svgEditor.createSVGPoint();
	          pt.x = clientX;
	          pt.y = clientY;
	          const svgPoint = pt.matrixTransform(inverse);
	          return { x: svgPoint.x, y: svgPoint.y };
	        }
	      } catch (err) {
	        // Fall through to bounding-rect math
	      }
		      const rect = svgEditor.getBoundingClientRect();
		      return { x: clientX - rect.left, y: clientY - rect.top };
		    }

			    function getDragCoordElement(element) {
			      if (!element) return svgEditor;
			      const parent = element.parentNode;
			      if (parent && typeof parent.getScreenCTM === 'function') return parent;
			      return svgEditor;
			    }

				    function getElementCenterInParentCoords(element, parentEl) {
				      if (!element) return { x: 0, y: 0 };

			      // Fast-path for untransformed basic geometry.
			      const tag = element.tagName;
			      const transformAttr = (element.getAttribute('transform') || '').trim();
			      const hasTransform = transformAttr && transformAttr.toLowerCase() !== 'none';
			      if (!hasTransform) {
			        if (tag === 'rect') {
			          const x = parseFloat(element.getAttribute('x') || 0);
			          const y = parseFloat(element.getAttribute('y') || 0);
			          const w = parseFloat(element.getAttribute('width') || 0);
			          const h = parseFloat(element.getAttribute('height') || 0);
			          return { x: x + w / 2, y: y + h / 2 };
			        }
			        if (tag === 'circle' || tag === 'ellipse') {
			          const cx = parseFloat(element.getAttribute('cx') || 0);
			          const cy = parseFloat(element.getAttribute('cy') || 0);
			          return { x: cx, y: cy };
			        }
			      }

			      // Generic: use the element's bbox center and map it into the parent's coordinate system.
			      try {
			        const bbox = element.getBBox();
			        const localCenter = new DOMPoint(bbox.x + bbox.width / 2, bbox.y + bbox.height / 2);
			        const elToScreen = element.getScreenCTM();
			        const parentToScreen = parentEl && typeof parentEl.getScreenCTM === 'function' ? parentEl.getScreenCTM() : null;
			        if (elToScreen && parentToScreen) {
			          const screenPt = localCenter.matrixTransform(elToScreen);
			          const parentPt = screenPt.matrixTransform(parentToScreen.inverse());
			          return { x: parentPt.x, y: parentPt.y };
			        }
			      } catch (err) {
			        // ignore
			      }
				      return { x: 0, y: 0 };
				    }

				    function getElementCenterInClientCoords(element) {
				      if (!element) return { x: 0, y: 0 };
				      const rect = element.getBoundingClientRect();
				      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
				    }

				    function toDomMatrix(m) {
				      if (!m) return null;
				      if (typeof DOMMatrix === 'function') {
				        // Some browsers already return DOMMatrix from getScreenCTM().
				        if (m instanceof DOMMatrix) return m;
				        if (typeof m.a === 'number') return new DOMMatrix([m.a, m.b, m.c, m.d, m.e, m.f]);
				      }
				      return null;
				    }

				    function getElementLocalToParentMatrix(element, parentEl) {
				      try {
				        const elToScreen = toDomMatrix(element && typeof element.getScreenCTM === 'function' ? element.getScreenCTM() : null);
				        const parentToScreen = toDomMatrix(parentEl && typeof parentEl.getScreenCTM === 'function' ? parentEl.getScreenCTM() : null);
				        if (!elToScreen || !parentToScreen) return null;
				        return parentToScreen.inverse().multiply(elToScreen);
				      } catch (err) {
				        return null;
				      }
				    }

				    function setTransformFromMatrix(element, matrix) {
				      if (!element || !matrix) return;
				      element.setAttribute('transform', `matrix(${matrix.a} ${matrix.b} ${matrix.c} ${matrix.d} ${matrix.e} ${matrix.f})`);
				    }
	    
	    gridToggle.addEventListener('change', () => {
	      gridOverlay.style.display = gridToggle.checked ? 'block' : 'none';
	    });

    // Selection and interaction handling
	    svgEditor.addEventListener('click', function(e) {
	      if (window.currentSVGTool !== 'select') return;
	      if (suppressNextClick) {
	        suppressNextClick = false;
	        return;
	      }
	      
	      hideContextMenu();
	      clearSelection();
      
      if (e.target !== svgEditor && e.target.tagName !== 'svg') {
        selectElement(e.target);
        e.stopPropagation();
      }
    });

    // Right-click context menu
    svgEditor.addEventListener('contextmenu', function(e) {
      e.preventDefault();
      if (selectedElement) {
        showContextMenu(e.pageX, e.pageY);
      }
    });

	    // Mouse down for dragging/resizing
			    svgEditor.addEventListener('mousedown', function(e) {
			      if (e.button !== 0) return;
			      if (window.currentSVGTool === 'select' && !e.target.classList.contains('handle')) {
			        if (isResizing) return;
			        const target =
			          (e.target && e.target !== svgEditor && e.target.tagName !== 'svg' && e.target.tagName !== 'SVG') ? e.target : null;
			        if (target && target !== selectedElement) {
			          clearSelection();
			          selectElement(target);
			        }
			        if (!selectedElement) return;
			        isDragging = true;
			        dragStartClient = { x: e.clientX, y: e.clientY };
			        suppressNextClick = false;
			        dragCoordElement = getDragCoordElement(selectedElement);
			        const { x: mouseX, y: mouseY } = clientToSvgCoords(e.clientX, e.clientY, dragCoordElement);

			        const transformAttr = (selectedElement.getAttribute('transform') || '').trim();
			        const hasTransform = transformAttr && transformAttr.toLowerCase() !== 'none';
			        const tag = selectedElement.tagName;
			        // Use attribute dragging only for simple, untransformed geometry.
			        // Text is handled via transform-drag to avoid origin/baseline drift.
			        dragMode = (!hasTransform && (tag === 'rect' || tag === 'circle' || tag === 'ellipse'))
			          ? 'attrs'
			          : 'transform';
			        dragBaseTransform = hasTransform ? transformAttr : '';
			        dragBaseMatrix = dragMode === 'transform' ? getElementLocalToParentMatrix(selectedElement, dragCoordElement) : null;
			        dragStart = { x: mouseX, y: mouseY };
			        dragStartCenter = getElementCenterInParentCoords(selectedElement, dragCoordElement);
			        const clientCenter = getElementCenterInClientCoords(selectedElement);
			        dragClientToCenter = { x: clientCenter.x - e.clientX, y: clientCenter.y - e.clientY };
			        dragClientToCenter0 = { x: dragClientToCenter.x, y: dragClientToCenter.y };
			        
			        if (dragMode === 'attrs') {
			          if (tag === 'rect') {
			            const x = parseFloat(selectedElement.getAttribute('x') || 0);
			            const y = parseFloat(selectedElement.getAttribute('y') || 0);
			            dragOffset = { x: mouseX - x, y: mouseY - y };
		          } else if (tag === 'circle') {
		            const cx = parseFloat(selectedElement.getAttribute('cx') || 0);
		            const cy = parseFloat(selectedElement.getAttribute('cy') || 0);
		            dragOffset = { x: mouseX - cx, y: mouseY - cy };
		          } else if (tag === 'ellipse') {
		            const cx = parseFloat(selectedElement.getAttribute('cx') || 0);
		            const cy = parseFloat(selectedElement.getAttribute('cy') || 0);
		            dragOffset = { x: mouseX - cx, y: mouseY - cy };
		          } else if (tag === 'text') {
		            const x = parseFloat(selectedElement.getAttribute('x') || 0);
		            const y = parseFloat(selectedElement.getAttribute('y') || 0);
		            dragOffset = { x: mouseX - x, y: mouseY - y };
		          }
		        }
		        e.preventDefault();
		      }
		    });

	    // Handle resizing
	    document.addEventListener('mousedown', function(e) {
	      if (e.target.classList.contains('handle')) {
	        if (!selectedElement) return;
	        isResizing = true;
	        isDragging = false;
	        dragMode = null;
	        dragCoordElement = null;
	        dragBaseTransform = '';
	        resizeHandle = e.target.dataset.handle || null;
	        resizeCoordElement = getDragCoordElement(selectedElement);
	        const { x: mouseX, y: mouseY } = clientToSvgCoords(e.clientX, e.clientY, resizeCoordElement);
	        resizeStartMouse = { x: mouseX, y: mouseY };

	        if (selectedElement.tagName === 'rect') {
	          resizeStartBox = {
	            type: 'rect',
	            x: parseFloat(selectedElement.getAttribute('x') || 0),
	            y: parseFloat(selectedElement.getAttribute('y') || 0),
	            width: parseFloat(selectedElement.getAttribute('width') || 0),
	            height: parseFloat(selectedElement.getAttribute('height') || 0)
	          };
	        } else if (selectedElement.tagName === 'circle') {
	          resizeStartBox = {
	            type: 'circle',
	            cx: parseFloat(selectedElement.getAttribute('cx') || 0),
	            cy: parseFloat(selectedElement.getAttribute('cy') || 0),
	            r: parseFloat(selectedElement.getAttribute('r') || 0)
	          };
	        } else if (selectedElement.tagName === 'ellipse') {
	          resizeStartBox = {
	            type: 'ellipse',
	            cx: parseFloat(selectedElement.getAttribute('cx') || 0),
	            cy: parseFloat(selectedElement.getAttribute('cy') || 0),
	            rx: parseFloat(selectedElement.getAttribute('rx') || 0),
	            ry: parseFloat(selectedElement.getAttribute('ry') || 0)
	          };
	        } else {
	          // Not supported yet.
	          isResizing = false;
	          resizeHandle = null;
	          resizeCoordElement = null;
	          resizeStartBox = null;
	          return;
	        }
	        e.preventDefault();
	      }
	    });

    // Mouse move for dragging and resizing
			    document.addEventListener('mousemove', function(e) {
			      if (isResizing && selectedElement && resizeHandle && resizeStartBox) {
			        const coordEl = resizeCoordElement || getDragCoordElement(selectedElement);
			        const { x: mouseX, y: mouseY } = clientToSvgCoords(e.clientX, e.clientY, coordEl);
			        const dx = mouseX - resizeStartMouse.x;
			        const dy = mouseY - resizeStartMouse.y;

			        const snapValue = (value) => snapToggle.checked ? (Math.round(value / gridSize) * gridSize) : value;
			        const clampSize = (value) => (Number.isFinite(value) ? Math.max(1, value) : 1);
			        const shift = !!e.shiftKey;

			        if (resizeStartBox.type === 'rect') {
			          const start = resizeStartBox;
			          const ratio = (start.height && start.width) ? (start.width / start.height) : 1;
			          let x = start.x;
			          let y = start.y;
			          let w = start.width;
			          let h = start.height;

			          const hasN = resizeHandle.includes('n');
			          const hasS = resizeHandle.includes('s');
			          const hasW = resizeHandle.includes('w');
			          const hasE = resizeHandle.includes('e');

			          if (hasE) w = start.width + dx;
			          if (hasS) h = start.height + dy;
			          if (hasW) {
			            x = start.x + dx;
			            w = start.width - dx;
			          }
			          if (hasN) {
			            y = start.y + dy;
			            h = start.height - dy;
			          }

			          w = clampSize(w);
			          h = clampSize(h);

			          if (shift && ratio > 0) {
			            // Constrain aspect ratio. For side handles, scale uniformly around center in the orthogonal axis.
			            if ((hasE || hasW) && !(hasN || hasS)) {
			              const targetW = w;
			              const targetH = clampSize(targetW / ratio);
			              y = start.y + (start.height - targetH) / 2;
			              h = targetH;
			            } else if ((hasN || hasS) && !(hasE || hasW)) {
			              const targetH = h;
			              const targetW = clampSize(targetH * ratio);
			              x = start.x + (start.width - targetW) / 2;
			              w = targetW;
			            } else {
			              // Corner handle: keep ratio by using dominant scale.
			              const scaleX = w / (start.width || 1);
			              const scaleY = h / (start.height || 1);
			              const scale = Math.abs(scaleX) > Math.abs(scaleY) ? scaleX : scaleY;
			              const targetW = clampSize((start.width || 1) * scale);
			              const targetH = clampSize((start.height || 1) * scale);

			              if (hasW) x = start.x + (start.width - targetW);
			              if (hasN) y = start.y + (start.height - targetH);
			              w = targetW;
			              h = targetH;
			            }
			          }

			          const nextX = snapValue(x);
			          const nextY = snapValue(y);
			          const nextW = clampSize(snapValue(w));
			          const nextH = clampSize(snapValue(h));

			          selectedElement.setAttribute('x', nextX);
			          selectedElement.setAttribute('y', nextY);
			          selectedElement.setAttribute('width', nextW);
			          selectedElement.setAttribute('height', nextH);
			        } else if (resizeStartBox.type === 'circle') {
			          const start = resizeStartBox;
			          const hasN = resizeHandle.includes('n');
			          const hasS = resizeHandle.includes('s');
			          const hasW = resizeHandle.includes('w');
			          const hasE = resizeHandle.includes('e');

			          // Derive radius from pointer distance to center (in parent coords), aligned to the active handle axes.
			          const distX = Math.abs(mouseX - start.cx);
			          const distY = Math.abs(mouseY - start.cy);
			          let r = (hasE || hasW) && (hasN || hasS) ? Math.max(distX, distY) : ((hasE || hasW) ? distX : distY);
			          r = clampSize(r);
			          if (snapToggle.checked) r = clampSize(snapValue(r));
			          selectedElement.setAttribute('r', r);
			        } else if (resizeStartBox.type === 'ellipse') {
			          const start = resizeStartBox;
			          let rx = start.rx;
			          let ry = start.ry;
			          const hasN = resizeHandle.includes('n');
			          const hasS = resizeHandle.includes('s');
			          const hasW = resizeHandle.includes('w');
			          const hasE = resizeHandle.includes('e');

			          if (hasE) rx = start.rx + dx;
			          if (hasW) rx = start.rx - dx;
			          if (hasS) ry = start.ry + dy;
			          if (hasN) ry = start.ry - dy;

			          rx = clampSize(rx);
			          ry = clampSize(ry);

			          if (shift) {
			            const ratio = (start.ry && start.rx) ? (start.rx / start.ry) : 1;
			            const scaleX = rx / (start.rx || 1);
			            const scaleY = ry / (start.ry || 1);
			            const scale = Math.abs(scaleX) > Math.abs(scaleY) ? scaleX : scaleY;
			            rx = clampSize((start.rx || 1) * scale);
			            ry = clampSize((start.ry || 1) * scale);
			            if (ratio > 0) {
			              // Maintain original ellipse ratio (already achieved by uniform scale).
			            }
			          }

			          if (snapToggle.checked) {
			            rx = clampSize(snapValue(rx));
			            ry = clampSize(snapValue(ry));
			          }
			          selectedElement.setAttribute('rx', rx);
			          selectedElement.setAttribute('ry', ry);
			        }

			        updateSelectionHandles();
			        return;
			      }

				        if (isDragging && selectedElement) {
				        if (!suppressNextClick) {
				          const dist = Math.hypot(e.clientX - dragStartClient.x, e.clientY - dragStartClient.y);
				          if (dist > 2) suppressNextClick = true;
				        }
				        const coordEl = dragCoordElement || getDragCoordElement(selectedElement);
				        const desiredCenterClientX = e.clientX + dragClientToCenter.x;
				        const desiredCenterClientY = e.clientY + dragClientToCenter.y;
				        const desiredCenter = clientToSvgCoords(desiredCenterClientX, desiredCenterClientY, coordEl);

				        if (dragMode === 'attrs') {
				          // Keep the mouse→center vector constant (in client/pixel space) by steering the element's
				          // center to the desired client-space center, converted into SVG parent coordinates.
				          const w = selectedElement.tagName === 'rect' ? parseFloat(selectedElement.getAttribute('width') || 0) : 0;
				          const h = selectedElement.tagName === 'rect' ? parseFloat(selectedElement.getAttribute('height') || 0) : 0;
				          let centerX = desiredCenter.x;
				          let centerY = desiredCenter.y;

				          let targetX = centerX;
				          let targetY = centerY;
				          if (selectedElement.tagName === 'rect') {
				            targetX = centerX - (w / 2);
				            targetY = centerY - (h / 2);
				          }

				          if (snapToggle.checked) {
				            targetX = Math.round(targetX / gridSize) * gridSize;
				            targetY = Math.round(targetY / gridSize) * gridSize;
				          }

				          if (selectedElement.tagName === 'rect') {
				            selectedElement.setAttribute('x', targetX);
				            selectedElement.setAttribute('y', targetY);
				          } else if (selectedElement.tagName === 'circle') {
				            const nextCx = snapToggle.checked ? Math.round(centerX / gridSize) * gridSize : centerX;
				            const nextCy = snapToggle.checked ? Math.round(centerY / gridSize) * gridSize : centerY;
				            selectedElement.setAttribute('cx', nextCx);
				            selectedElement.setAttribute('cy', nextCy);
				          } else if (selectedElement.tagName === 'ellipse') {
				            const nextCx = snapToggle.checked ? Math.round(centerX / gridSize) * gridSize : centerX;
				            const nextCy = snapToggle.checked ? Math.round(centerY / gridSize) * gridSize : centerY;
				            selectedElement.setAttribute('cx', nextCx);
				            selectedElement.setAttribute('cy', nextCy);
				          }

				          // Verification: ensure the mouse→center vector stays stable (or is intentionally updated when snapping).
				          const actualCenterClient = getElementCenterInClientCoords(selectedElement);
				          const currentVector = { x: actualCenterClient.x - e.clientX, y: actualCenterClient.y - e.clientY };
				          if (!snapToggle.checked) {
				            const errX = currentVector.x - dragClientToCenter0.x;
				            const errY = currentVector.y - dragClientToCenter0.y;
				            const err = Math.hypot(errX, errY);
				            if (err > 0.75) {
				              console.debug('[svg-drag] mouse→center drift', { err, errX, errY, currentVector, expected: dragClientToCenter0 });
				            }
				          } else {
				            // Maintain "grabbed" feel while snapping.
				            dragClientToCenter = currentVector;
				          }
				        } else {
				          // For elements with transforms (or non-attribute geometry like paths), translate in parent coords.
				          let dx = desiredCenter.x - dragStartCenter.x;
				          let dy = desiredCenter.y - dragStartCenter.y;
				          if (snapToggle.checked) {
				            dx = Math.round(dx / gridSize) * gridSize;
				            dy = Math.round(dy / gridSize) * gridSize;
				          }

				          if (dragBaseMatrix) {
				            const t = new DOMMatrix().translate(dx, dy);
				            const nextMatrix = t.multiply(dragBaseMatrix);
				            setTransformFromMatrix(selectedElement, nextMatrix);
				          } else {
				            // Fallback: attempt string-based translate composition.
				            const nextTransform = `translate(${dx} ${dy})` + (dragBaseTransform ? ' ' + dragBaseTransform : '');
				            selectedElement.setAttribute('transform', nextTransform);
				          }

				          const actualCenterClient = getElementCenterInClientCoords(selectedElement);
				          const currentVector = { x: actualCenterClient.x - e.clientX, y: actualCenterClient.y - e.clientY };
				          if (!snapToggle.checked) {
				            const errX = currentVector.x - dragClientToCenter0.x;
				            const errY = currentVector.y - dragClientToCenter0.y;
				            const err = Math.hypot(errX, errY);
				            if (err > 1.0) {
				              console.debug('[svg-drag] mouse→center drift', { err, errX, errY, currentVector, expected: dragClientToCenter0 });
				            }
				          } else {
				            dragClientToCenter = currentVector;
				          }
				        }
				        updateSelectionHandles();
				      }
				    });

    // Mouse up to stop dragging/resizing
		    document.addEventListener('mouseup', function() {
		      isDragging = false;
		      isResizing = false;
		      dragMode = null;
		      dragCoordElement = null;
		      dragBaseTransform = '';
		      dragBaseMatrix = null;
		      dragClientToCenter = { x: 0, y: 0 };
		      dragClientToCenter0 = { x: 0, y: 0 };
		      dragStartCenter = { x: 0, y: 0 };
		      resizeHandle = null;
		      resizeCoordElement = null;
		      resizeStartBox = null;
		    });

    // Hide context menu on click
    document.addEventListener('click', hideContextMenu);

    // Keyboard shortcuts
    document.addEventListener('keydown', function(e) {
      if (e.ctrlKey || e.metaKey) {
        switch(e.key) {
          case 'c':
            e.preventDefault();
            copyElement();
            break;
          case 'v':
            e.preventDefault();
            pasteElement();
            break;
          case 'd':
            e.preventDefault();
            duplicateElement();
            break;
          case 's':
            e.preventDefault();
            saveSVGToServer();
            break;
        }
      } else if (e.key === 'Delete' && selectedElement) {
        deleteElement();
      }
    });

	    function initRulers() {
	      const canvasContainer = document.getElementById('canvas-container');
	      const hCanvas = document.getElementById('h-ruler-canvas');
	      const vCanvas = document.getElementById('v-ruler-canvas');
	      if (!canvasContainer || !hCanvas || !vCanvas) return;

	      function getSvgViewportBox() {
	        const vb = svgEditor.viewBox && svgEditor.viewBox.baseVal ? svgEditor.viewBox.baseVal : null;
	        const vbWidth = vb && vb.width ? vb.width : parseFloat(svgEditor.getAttribute('width') || 800);
	        const vbHeight = vb && vb.height ? vb.height : parseFloat(svgEditor.getAttribute('height') || 600);
	        const vbX = vb ? vb.x : 0;
	        const vbY = vb ? vb.y : 0;
	        return {
	          x: Number.isFinite(vbX) ? vbX : 0,
	          y: Number.isFinite(vbY) ? vbY : 0,
	          width: Number.isFinite(vbWidth) && vbWidth > 0 ? vbWidth : 800,
	          height: Number.isFinite(vbHeight) && vbHeight > 0 ? vbHeight : 600
	        };
	      }

	      function getPixelsPerSvgUnit() {
	        const vb = getSvgViewportBox();
	        const svgRect = svgEditor.getBoundingClientRect();
	        if (!svgRect.width || !vb.width) return 1;
	        return svgRect.width / vb.width;
	      }

	      function chooseMinorStep(pixelsPerUnit) {
	        const targetPx = 8;
	        const steps = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000];
	        for (const step of steps) {
	          if (step * pixelsPerUnit >= targetPx) return step;
	        }
	        return steps[steps.length - 1];
	      }

	      function resizeSvgToFitWidth() {
	        const vb = getSvgViewportBox();
	        const widthPx = canvasContainer.clientWidth;
	        if (!widthPx || !vb.width || !vb.height) return;
	        const heightPx = Math.max(1, Math.round(widthPx * (vb.height / vb.width)));
	        canvasContainer.style.setProperty('--svg-editor-height', `${heightPx}px`);
	      }

	      function setupCanvas(canvasEl, cssWidth, cssHeight) {
	        const dpr = window.devicePixelRatio || 1;
	        const targetWidth = Math.max(1, Math.floor(cssWidth));
	        const targetHeight = Math.max(1, Math.floor(cssHeight));
	        if (canvasEl.width !== Math.floor(targetWidth * dpr) || canvasEl.height !== Math.floor(targetHeight * dpr)) {
	          canvasEl.width = Math.floor(targetWidth * dpr);
	          canvasEl.height = Math.floor(targetHeight * dpr);
	        }
	        const ctx = canvasEl.getContext('2d');
	        if (!ctx) return null;
	        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
	        return ctx;
	      }

	      function drawHorizontalRuler() {
	        const vb = getSvgViewportBox();
	        const pixelsPerUnit = getPixelsPerSvgUnit();
	        const svgRect = svgEditor.getBoundingClientRect();

	        const hRulerEl = document.getElementById('h-ruler');
	        const cssWidth = (hRulerEl && hRulerEl.clientWidth) ? hRulerEl.clientWidth : canvasContainer.clientWidth;
	        const cssHeight = (hRulerEl && hRulerEl.clientHeight) ? hRulerEl.clientHeight : 24;
	        const viewportPxWidth = Math.min(canvasContainer.clientWidth, svgRect.width || canvasContainer.clientWidth);
	        const visiblePxWidth = Math.min(cssWidth, viewportPxWidth);

	        const ctx = setupCanvas(hCanvas, cssWidth, cssHeight);
	        if (!ctx) return;

	        ctx.clearRect(0, 0, cssWidth, cssHeight);
	        ctx.fillStyle = '#f0f0f0';
	        ctx.fillRect(0, 0, cssWidth, cssHeight);

	        const startUser = vb.x + (canvasContainer.scrollLeft / pixelsPerUnit);
	        const visibleUserWidth = (visiblePxWidth / pixelsPerUnit);
	        const endUser = startUser + visibleUserWidth;

	        const minor = chooseMinorStep(pixelsPerUnit);
	        const majorEvery = 5;
	        const superEvery = 10;

	        let labelEvery = superEvery;
	        if (minor * pixelsPerUnit * labelEvery < 60) labelEvery *= 2;

	        const startIdx = Math.floor(startUser / minor);
	        const endIdx = Math.ceil(endUser / minor);

	        const baselineY = cssHeight - 0.5;
	        ctx.strokeStyle = 'rgba(0,0,0,0.28)';
	        ctx.lineWidth = 1;
	        ctx.beginPath();
	        ctx.moveTo(0, baselineY);
	        ctx.lineTo(cssWidth, baselineY);
	        ctx.stroke();

	        ctx.font = '10px system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
	        ctx.fillStyle = 'rgba(0,0,0,0.62)';
	        ctx.textBaseline = 'top';
	        ctx.textAlign = 'left';

	        for (let idx = startIdx; idx <= endIdx; idx++) {
	          const value = idx * minor;
	          const xPx = (value - startUser) * pixelsPerUnit;
	          const x = Math.round(xPx) + 0.5;
	          if (x < -1 || x > cssWidth + 1) continue;

	          const isSuper = (idx % superEvery) === 0;
	          const isMajor = (idx % majorEvery) === 0;
	          const tickH = isSuper ? 12 : (isMajor ? 8 : 5);
	          ctx.strokeStyle = isSuper ? 'rgba(0,0,0,0.40)' : (isMajor ? 'rgba(0,0,0,0.30)' : 'rgba(0,0,0,0.18)');
	          ctx.beginPath();
	          ctx.moveTo(x, cssHeight);
	          ctx.lineTo(x, cssHeight - tickH);
	          ctx.stroke();

	          if (idx % labelEvery === 0) {
	            const label = String(Math.round(value));
	            const textX = x + 2;
	            if (textX < cssWidth - 10) {
	              ctx.fillText(label, textX, 2);
	            }
	          }
	        }

	        // Dim unused area if SVG is shorter than container width for any reason
	        if (visiblePxWidth < cssWidth) {
	          ctx.fillStyle = 'rgba(255,255,255,0.55)';
	          ctx.fillRect(visiblePxWidth, 0, cssWidth - visiblePxWidth, cssHeight);
	        }
	      }

	      function drawVerticalRuler() {
	        const vb = getSvgViewportBox();
	        const pixelsPerUnit = getPixelsPerSvgUnit();
	        const svgRect = svgEditor.getBoundingClientRect();

	        const vRulerEl = document.getElementById('v-ruler');
	        const cssWidth = (vRulerEl && vRulerEl.clientWidth) ? vRulerEl.clientWidth : 28;
	        const cssHeight = (vRulerEl && vRulerEl.clientHeight) ? vRulerEl.clientHeight : canvasContainer.clientHeight;
	        const viewportPxHeight = Math.min(canvasContainer.clientHeight, svgRect.height || canvasContainer.clientHeight);
	        const visiblePxHeight = Math.min(cssHeight, viewportPxHeight);

	        const ctx = setupCanvas(vCanvas, cssWidth, cssHeight);
	        if (!ctx) return;

	        ctx.clearRect(0, 0, cssWidth, cssHeight);
	        ctx.fillStyle = '#f0f0f0';
	        ctx.fillRect(0, 0, cssWidth, cssHeight);

	        const startUser = vb.y + (canvasContainer.scrollTop / pixelsPerUnit);
	        const visibleUserHeight = (visiblePxHeight / pixelsPerUnit);
	        const endUser = startUser + visibleUserHeight;

	        const minor = chooseMinorStep(pixelsPerUnit);
	        const majorEvery = 5;
	        const superEvery = 10;

	        let labelEvery = superEvery;
	        if (minor * pixelsPerUnit * labelEvery < 60) labelEvery *= 2;

	        const startIdx = Math.floor(startUser / minor);
	        const endIdx = Math.ceil(endUser / minor);

	        const baselineX = cssWidth - 0.5;
	        ctx.strokeStyle = 'rgba(0,0,0,0.28)';
	        ctx.lineWidth = 1;
	        ctx.beginPath();
	        ctx.moveTo(baselineX, 0);
	        ctx.lineTo(baselineX, cssHeight);
	        ctx.stroke();

	        ctx.font = '10px system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
	        ctx.fillStyle = 'rgba(0,0,0,0.62)';
	        ctx.textBaseline = 'middle';
	        ctx.textAlign = 'left';

	        for (let idx = startIdx; idx <= endIdx; idx++) {
	          const value = idx * minor;
	          const yPx = (value - startUser) * pixelsPerUnit;
	          const y = Math.round(yPx) + 0.5;
	          if (y < -1 || y > cssHeight + 1) continue;

	          const isSuper = (idx % superEvery) === 0;
	          const isMajor = (idx % majorEvery) === 0;
	          const tickW = isSuper ? 12 : (isMajor ? 8 : 5);
	          ctx.strokeStyle = isSuper ? 'rgba(0,0,0,0.40)' : (isMajor ? 'rgba(0,0,0,0.30)' : 'rgba(0,0,0,0.18)');
	          ctx.beginPath();
	          ctx.moveTo(cssWidth, y);
	          ctx.lineTo(cssWidth - tickW, y);
	          ctx.stroke();

	          if (idx % labelEvery === 0) {
	            const label = String(Math.round(value));
	            if (y > 10 && y < cssHeight - 10) {
	              ctx.fillText(label, 2, y);
	            }
	          }
	        }

	        if (visiblePxHeight < cssHeight) {
	          ctx.fillStyle = 'rgba(255,255,255,0.55)';
	          ctx.fillRect(0, visiblePxHeight, cssWidth, cssHeight - visiblePxHeight);
	        }
	      }

	      let rafId = null;
	      function scheduleRedraw() {
	        if (rafId) return;
	        rafId = requestAnimationFrame(() => {
	          rafId = null;
	          resizeSvgToFitWidth();
	          drawHorizontalRuler();
	          drawVerticalRuler();
	        });
	      }

	      canvasContainer.addEventListener('scroll', scheduleRedraw, { passive: true });
	      window.addEventListener('resize', scheduleRedraw);

	      if (typeof ResizeObserver === 'function') {
	        const ro = new ResizeObserver(() => scheduleRedraw());
	        ro.observe(canvasContainer);
	      }

	      scheduleRedraw();
	    }

    function selectElement(element) {
      selectedElement = element;
      window.selectedSVGElement = element;
      element.classList.add('svg-selected');
      updateSelectedInfo(element);
      updateSelectionHandles();
      updatePropertyPanel(element);
    }

    function clearSelection() {
      if (selectedElement) {
        selectedElement.classList.remove('svg-selected');
        selectedElement = null;
        window.selectedSVGElement = null;
        updateSelectedInfo(null);
        hideSelectionHandles();
        updatePropertyPanel(null);
      }
    }

	    // Minimal API for extensions (e.g., insert tools).
	    window.NVSvgEditorApi = {
	      get svgRoot() { return svgEditor; },
	      selectElement,
	      clearSelection,
	      getSelectedElement: () => selectedElement,
	      setTool: (tool) => {
	        window.currentSVGTool = tool;
	        const selectBtn = document.getElementById('svg-select-tool');
	        const textBtn = document.getElementById('svg-text-tool');
	        if (selectBtn && textBtn) {
	          selectBtn.classList.toggle('active', tool === 'select');
	          textBtn.classList.toggle('active', tool === 'text');
	        }
	      },
	      setMessage: (text) => {
	        const el = document.getElementById('svg-message');
	        if (el) el.textContent = String(text || '');
	      }
	    };

    function updateSelectedInfo(element) {
      const info = document.getElementById('selected-info');
      if (element) {
        info.textContent = element.tagName.toUpperCase();
      } else {
        info.textContent = 'None';
      }
    }

    function updateSelectionHandles() {
      if (!selectedElement) return;
      
      const handles = document.getElementById('selection-handles');
      const rect = selectedElement.getBoundingClientRect();
      const svgRect = svgEditor.getBoundingClientRect();
      
      handles.style.left = (rect.left - svgRect.left - 4) + 'px';
      handles.style.top = (rect.top - svgRect.top - 4) + 'px';
      handles.style.width = (rect.width + 8) + 'px';
      handles.style.height = (rect.height + 8) + 'px';
      handles.style.display = 'block';
    }

    function hideSelectionHandles() {
      document.getElementById('selection-handles').style.display = 'none';
    }

    function showContextMenu(x, y) {
      const menu = document.getElementById('context-menu');
      menu.style.left = x + 'px';
      menu.style.top = y + 'px';
      menu.style.display = 'block';
    }

    function hideContextMenu() {
      document.getElementById('context-menu').style.display = 'none';
    }

    function copyElement() {
      if (selectedElement) {
        clipboard = selectedElement.cloneNode(true);
        document.getElementById('svg-message').textContent = 'Element copied';
      }
    }

    function pasteElement() {
      if (clipboard) {
        const clone = clipboard.cloneNode(true);
        // Offset the pasted element
        if (clone.tagName === 'rect') {
          const x = parseFloat(clone.getAttribute('x') || 0) + 20;
          const y = parseFloat(clone.getAttribute('y') || 0) + 20;
          clone.setAttribute('x', x);
          clone.setAttribute('y', y);
        } else if (clone.tagName === 'circle') {
          const cx = parseFloat(clone.getAttribute('cx') || 0) + 20;
          const cy = parseFloat(clone.getAttribute('cy') || 0) + 20;
          clone.setAttribute('cx', cx);
          clone.setAttribute('cy', cy);
        }
        svgEditor.appendChild(clone);
        selectElement(clone);
        document.getElementById('svg-message').textContent = 'Element pasted';
      }
    }

    function duplicateElement() {
      if (selectedElement) {
        copyElement();
        pasteElement();
      }
    }

    function deleteElement() {
      if (selectedElement && selectedElement.parentNode) {
        selectedElement.parentNode.removeChild(selectedElement);
        clearSelection();
        document.getElementById('svg-message').textContent = 'Element deleted';
      }
    }

    // Alignment functions
    function alignElements(alignment) {
      if (!selectedElement) return;
      
      const svgRect = svgEditor.getBBox ? svgEditor.getBBox() : { x: 0, y: 0, width: 800, height: 600 };
      
      switch(alignment) {
        case 'left':
          if (selectedElement.tagName === 'rect') {
            selectedElement.setAttribute('x', 0);
          } else if (selectedElement.tagName === 'circle' || selectedElement.tagName === 'ellipse') {
            selectedElement.setAttribute('cx', parseFloat(selectedElement.getAttribute('r') || selectedElement.getAttribute('rx') || 0));
          }
          break;
        case 'center':
          const centerX = svgRect.width / 2;
          if (selectedElement.tagName === 'rect') {
            const width = parseFloat(selectedElement.getAttribute('width') || 0);
            selectedElement.setAttribute('x', centerX - width / 2);
          } else if (selectedElement.tagName === 'circle' || selectedElement.tagName === 'ellipse') {
            selectedElement.setAttribute('cx', centerX);
          }
          break;
        case 'right':
          if (selectedElement.tagName === 'rect') {
            const width = parseFloat(selectedElement.getAttribute('width') || 0);
            selectedElement.setAttribute('x', svgRect.width - width);
          } else if (selectedElement.tagName === 'circle' || selectedElement.tagName === 'ellipse') {
            const r = parseFloat(selectedElement.getAttribute('r') || selectedElement.getAttribute('rx') || 0);
            selectedElement.setAttribute('cx', svgRect.width - r);
          } else if (selectedElement.tagName === 'text') {
            selectedElement.setAttribute('x', svgRect.width - 10);
          }
          break;
        case 'top':
          if (selectedElement.tagName === 'rect') {
            selectedElement.setAttribute('y', 0);
          } else if (selectedElement.tagName === 'circle' || selectedElement.tagName === 'ellipse') {
            const r = parseFloat(selectedElement.getAttribute('r') || selectedElement.getAttribute('ry') || 0);
            selectedElement.setAttribute('cy', r);
          } else if (selectedElement.tagName === 'text') {
            selectedElement.setAttribute('y', 20);
          }
          break;
        case 'middle':
          const centerY = svgRect.height / 2;
          if (selectedElement.tagName === 'rect') {
            const height = parseFloat(selectedElement.getAttribute('height') || 0);
            selectedElement.setAttribute('y', centerY - height / 2);
          } else if (selectedElement.tagName === 'circle' || selectedElement.tagName === 'ellipse') {
            selectedElement.setAttribute('cy', centerY);
          } else if (selectedElement.tagName === 'text') {
            selectedElement.setAttribute('y', centerY);
          }
          break;
        case 'bottom':
          if (selectedElement.tagName === 'rect') {
            const height = parseFloat(selectedElement.getAttribute('height') || 0);
            selectedElement.setAttribute('y', svgRect.height - height);
          } else if (selectedElement.tagName === 'circle' || selectedElement.tagName === 'ellipse') {
            const r = parseFloat(selectedElement.getAttribute('r') || selectedElement.getAttribute('ry') || 0);
            selectedElement.setAttribute('cy', svgRect.height - r);
          } else if (selectedElement.tagName === 'text') {
            selectedElement.setAttribute('y', svgRect.height - 10);
          }
          break;
      }
      updateSelectionHandles();
    }

    // Layer management
    function bringToFront() {
      if (selectedElement && selectedElement.parentNode) {
        selectedElement.parentNode.appendChild(selectedElement);
        document.getElementById('svg-message').textContent = 'Brought to front';
      }
    }

    function sendToBack() {
      if (selectedElement && selectedElement.parentNode) {
        const parent = selectedElement.parentNode;
        parent.insertBefore(selectedElement, parent.firstChild);
        document.getElementById('svg-message').textContent = 'Sent to back';
      }
    }

    function updatePropertyPanel(element) {
      const content = document.getElementById('property-content');
      
      if (!element) {
        content.innerHTML = '<p>Select an object to view its properties.</p>';
        return;
      }

      let html = '<div class="property-group">';
      html += `<label>Type:</label><input type="text" value="${element.tagName.toUpperCase()}" readonly>`;
      html += '</div>';

      // Common properties - always add fill and stroke options
      html += '<div class="property-group">';
      html += '<label>Fill Color:</label>';
      html += `<input type="color" id="fill-color" value="${element.getAttribute('fill') || '#000000'}">`;
      html += '</div>';

      html += '<div class="property-group">';
      html += '<label>Stroke Color:</label>';
      html += `<input type="color" id="stroke-color" value="${element.getAttribute('stroke') || '#000000'}">`;
      html += '</div>';

      html += '<div class="property-group">';
      html += '<label>Stroke Width:</label>';
      html += `<input type="number" id="stroke-width" value="${element.getAttribute('stroke-width') || 1}" min="0" step="0.5">`;
      html += '</div>';

      // Opacity control
      html += '<div class="property-group">';
      html += '<label>Opacity:</label>';
      html += `<input type="range" id="opacity" value="${parseFloat(element.getAttribute('opacity') || 1) * 100}" min="0" max="100" step="1">`;
      html += `<span id="opacity-value">${Math.round(parseFloat(element.getAttribute('opacity') || 1) * 100)}%</span>`;
      html += '</div>';

      // Shape-specific properties
      if (element.tagName === 'rect') {
        html += '<div class="property-group">';
        html += '<label>Position & Size:</label>';
        html += '<div class="property-row">';
        html += `<input type="number" id="rect-x" value="${element.getAttribute('x') || 0}" placeholder="X">`;
        html += `<input type="number" id="rect-y" value="${element.getAttribute('y') || 0}" placeholder="Y">`;
        html += '</div>';
        html += '<div class="property-row">';
        html += `<input type="number" id="rect-width" value="${element.getAttribute('width') || 0}" placeholder="Width">`;
        html += `<input type="number" id="rect-height" value="${element.getAttribute('height') || 0}" placeholder="Height">`;
        html += '</div>';
        html += '</div>';
      } else if (element.tagName === 'circle') {
        html += '<div class="property-group">';
        html += '<label>Position & Size:</label>';
        html += '<div class="property-row">';
        html += `<input type="number" id="circle-cx" value="${element.getAttribute('cx') || 0}" placeholder="Center X">`;
        html += `<input type="number" id="circle-cy" value="${element.getAttribute('cy') || 0}" placeholder="Center Y">`;
        html += '</div>';
        html += `<input type="number" id="circle-r" value="${element.getAttribute('r') || 0}" placeholder="Radius">`;
        html += '</div>';
      } else if (element.tagName === 'ellipse') {
        html += '<div class="property-group">';
        html += '<label>Position & Size:</label>';
        html += '<div class="property-row">';
        html += `<input type="number" id="ellipse-cx" value="${element.getAttribute('cx') || 0}" placeholder="Center X">`;
        html += `<input type="number" id="ellipse-cy" value="${element.getAttribute('cy') || 0}" placeholder="Center Y">`;
        html += '</div>';
        html += '<div class="property-row">';
        html += `<input type="number" id="ellipse-rx" value="${element.getAttribute('rx') || 0}" placeholder="Radius X">`;
        html += `<input type="number" id="ellipse-ry" value="${element.getAttribute('ry') || 0}" placeholder="Radius Y">`;
        html += '</div>';
        html += '</div>';
      } else if (element.tagName === 'text') {
        html += '<div class="property-group">';
        html += '<label>Text:</label>';
        html += `<input type="text" id="text-content" value="${element.textContent || ''}">`;
        html += '</div>';
        html += '<div class="property-group">';
        html += '<label>Font:</label>';
        html += `<input type="text" id="font-family" value="${element.getAttribute('font-family') || 'Arial'}">`;
        html += `<input type="number" id="font-size" value="${element.getAttribute('font-size') || 16}" min="8" max="200">`;
        html += '</div>';
        html += '<div class="property-group">';
        html += '<label>Text Alignment:</label>';
        html += '<select id="text-anchor">';
        html += `<option value="start" ${element.getAttribute('text-anchor') === 'start' ? 'selected' : ''}>Left</option>`;
        html += `<option value="middle" ${element.getAttribute('text-anchor') === 'middle' ? 'selected' : ''}>Center</option>`;
        html += `<option value="end" ${element.getAttribute('text-anchor') === 'end' ? 'selected' : ''}>Right</option>`;
        html += '</select>';
        html += '</div>';
      }

      content.innerHTML = html;

      // Add event listeners for property changes
      addPropertyListeners(element);
    }

    function addPropertyListeners(element) {
      // Color inputs
      const fillColor = document.getElementById('fill-color');
      const strokeColor = document.getElementById('stroke-color');
      const strokeWidth = document.getElementById('stroke-width');
      const opacity = document.getElementById('opacity');
      
      if (fillColor) {
        fillColor.addEventListener('input', () => {
          element.setAttribute('fill', fillColor.value);
        });
      }
      
      if (strokeColor) {
        strokeColor.addEventListener('input', () => {
          element.setAttribute('stroke', strokeColor.value);
        });
      }
      
      if (strokeWidth) {
        strokeWidth.addEventListener('input', () => {
          element.setAttribute('stroke-width', strokeWidth.value);
        });
      }

      if (opacity) {
        opacity.addEventListener('input', () => {
          const opacityValue = parseFloat(opacity.value) / 100;
          element.setAttribute('opacity', opacityValue);
          document.getElementById('opacity-value').textContent = opacity.value + '%';
        });
      }

      // Shape-specific listeners
      if (element.tagName === 'rect') {
        ['x', 'y', 'width', 'height'].forEach(attr => {
          const input = document.getElementById(`rect-${attr}`);
          if (input) {
            input.addEventListener('input', () => {
              element.setAttribute(attr, input.value);
              updateSelectionHandles();
            });
          }
        });
      } else if (element.tagName === 'circle') {
        ['cx', 'cy', 'r'].forEach(attr => {
          const input = document.getElementById(`circle-${attr}`);
          if (input) {
            input.addEventListener('input', () => {
              element.setAttribute(attr, input.value);
              updateSelectionHandles();
            });
          }
        });
      } else if (element.tagName === 'ellipse') {
        ['cx', 'cy', 'rx', 'ry'].forEach(attr => {
          const input = document.getElementById(`ellipse-${attr}`);
          if (input) {
            input.addEventListener('input', () => {
              element.setAttribute(attr, input.value);
              updateSelectionHandles();
            });
          }
        });
      } else if (element.tagName === 'text') {
        const textContent = document.getElementById('text-content');
        const fontFamily = document.getElementById('font-family');
        const fontSize = document.getElementById('font-size');
        const textAnchor = document.getElementById('text-anchor');
        
        if (textContent) {
          textContent.addEventListener('input', () => {
            element.textContent = textContent.value;
          });
        }
        
        if (fontFamily) {
          fontFamily.addEventListener('input', () => {
            element.setAttribute('font-family', fontFamily.value);
          });
        }
        
        if (fontSize) {
          fontSize.addEventListener('input', () => {
            element.setAttribute('font-size', fontSize.value);
          });
        }

        if (textAnchor) {
          textAnchor.addEventListener('change', () => {
            element.setAttribute('text-anchor', textAnchor.value);
          });
        }
      }
    }

    // Toolbar event handlers
    document.getElementById('svg-select-tool').addEventListener('click', () => {
      window.currentSVGTool = 'select';
      document.querySelectorAll('.svg-tool-btn').forEach(btn => btn.classList.remove('active'));
      document.getElementById('svg-select-tool').classList.add('active');
      document.getElementById('svg-message').textContent = 'Select tool active - click on shapes to select';
    });

    document.getElementById('svg-text-tool').addEventListener('click', () => {
      window.currentSVGTool = 'text';
      document.querySelectorAll('.svg-tool-btn').forEach(btn => btn.classList.remove('active'));
      document.getElementById('svg-text-tool').classList.add('active');
      document.getElementById('svg-message').textContent = 'Text tool active - click to add text';
    });

    // Object action buttons
    document.getElementById('svg-copy-btn').addEventListener('click', copyElement);
    document.getElementById('svg-paste-btn').addEventListener('click', pasteElement);
    document.getElementById('svg-duplicate-btn').addEventListener('click', duplicateElement);
    document.getElementById('svg-delete-btn').addEventListener('click', deleteElement);

    // Alignment buttons
    document.getElementById('align-left-btn').addEventListener('click', () => alignElements('left'));
    document.getElementById('align-center-btn').addEventListener('click', () => alignElements('center'));
    document.getElementById('align-right-btn').addEventListener('click', () => alignElements('right'));
    document.getElementById('align-top-btn').addEventListener('click', () => alignElements('top'));
    document.getElementById('align-middle-btn').addEventListener('click', () => alignElements('middle'));
    document.getElementById('align-bottom-btn').addEventListener('click', () => alignElements('bottom'));

    // Layer buttons
    document.getElementById('bring-front-btn').addEventListener('click', bringToFront);
    document.getElementById('send-back-btn').addEventListener('click', sendToBack);

    // File action buttons
    document.getElementById('svg-save-btn').addEventListener('click', () => {
      saveSVGToServer();
    });

    document.getElementById('svg-clear-btn').addEventListener('click', () => {
      if (confirm('Are you sure you want to clear the canvas?')) {
        // Keep grid and defs, remove other elements
        const elements = Array.from(svgEditor.children);
        elements.forEach(el => {
          if (el.tagName !== 'defs' && el.id !== 'grid-overlay') {
            el.remove();
          }
        });
        clearSelection();
        document.getElementById('svg-message').textContent = 'Canvas cleared';
      }
    });

    // Context menu handlers
    document.getElementById('context-menu').addEventListener('click', (e) => {
      const action = e.target.dataset.action;
      if (action) {
        switch(action) {
          case 'copy': copyElement(); break;
          case 'paste': pasteElement(); break;
          case 'duplicate': duplicateElement(); break;
          case 'delete': deleteElement(); break;
          case 'bring-front': bringToFront(); break;
          case 'send-back': sendToBack(); break;
        }
        hideContextMenu();
      }
    });

    // Initialize select tool as default
    window.currentSVGTool = 'select';
    document.getElementById('svg-message').textContent = 'Publisher-style SVG Editor ready - use toolbar to insert shapes';
  }

  // Enhanced save function that actually saves to server
  function saveSVGToServer() {
    const svgContent = svgEditor.outerHTML;
    console.log('Attempting to save SVG to:', filePath);
    console.log('SVG content length:', svgContent.length);
    
    fetch('/api/save', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        path: filePath,
        content: svgContent
      })
    })
    .then(response => {
      console.log('Save response status:', response.status);
      console.log('Save response headers:', response.headers);
      return response.json().catch(err => {
        console.error('Failed to parse JSON response:', err);
        return { error: 'Invalid response format' };
      });
    })
    .then(data => {
      console.log('Save response data:', data);
      if (data.success) {
        document.getElementById('svg-message').textContent = 'SVG saved successfully!';
      } else {
        document.getElementById('svg-error').textContent = 'Error saving SVG: ' + (data.error || 'Unknown error');
      }
    })
    .catch(error => {
      console.error('Save error:', error);
      console.error('Full error details:', JSON.stringify(error));
      console.error('Error stack:', error.stack);
      document.getElementById('svg-error').textContent = 'Network error while saving: ' + error.message;
    });
  }

  // Initialize toolbar and insert callbacks for SVG
  if (window.initInsertCallbacks) {
    window.initInsertCallbacks(svgEditor);
  }

  // Hide the InfoSVG preview when entering editing mode
  const infoPanel = document.getElementById('element-info');
  if (infoPanel) {
    // Clear any existing InfoSVG iframe
    const existingIframe = infoPanel.querySelector('iframe');
    if (existingIframe) {
      infoPanel.innerHTML = '';
    }
  }

  // Expose save function globally for shortcuts and toolbar
  window.currentSaveSVG = saveSVGToServer;

  console.log('Enhanced SVG editing initialized for:', filePath);
})();
