// FILE: rasterToolbar.js
// Publisher-style toolbar for raster editing

(function() {
  function initRasterToolbar() {
    console.log("Initializing raster toolbar");
    
    // Remove any existing toolbars
    const existingToolbar = document.querySelector('.raster-toolbar');
    if (existingToolbar) {
      existingToolbar.remove();
    }
    
    // Create toolbar HTML
    const toolbarHTML = `
      <div class="raster-toolbar" style="
        position: fixed; 
        top: 60px; 
        left: 0; 
        right: 0; 
        height: 50px; 
        background: linear-gradient(to bottom, #f8f8f8, #e8e8e8); 
        border-bottom: 1px solid #ccc; 
        display: flex; 
        align-items: center; 
        padding: 0 10px; 
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        z-index: 1000;
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      ">
        
        <!-- File Operations -->
        <div class="toolbar-group" style="display: flex; align-items: center; margin-right: 20px;">
          <button id="save-raster-btn" class="toolbar-btn" style="margin-right: 5px;">💾 Save</button>
          <button id="revert-btn" class="toolbar-btn">↶ Revert</button>
        </div>
        
        <div class="toolbar-separator" style="width: 1px; height: 30px; background: #ccc; margin: 0 10px;"></div>
        
        <!-- Drawing Tools -->
        <div class="toolbar-group" style="display: flex; align-items: center; margin-right: 20px;">
          <button id="tool-brush" class="toolbar-btn tool-btn active" data-tool="brush">🖌️ Brush</button>
          <button id="tool-eraser" class="toolbar-btn tool-btn" data-tool="eraser">🧽 Eraser</button>
          <button id="tool-fill" class="toolbar-btn tool-btn" data-tool="fill">🪣 Fill</button>
          <button id="tool-eyedropper" class="toolbar-btn tool-btn" data-tool="eyedropper">💉 Eyedropper</button>
        </div>
        
        <div class="toolbar-separator" style="width: 1px; height: 30px; background: #ccc; margin: 0 10px;"></div>
        
        <!-- Brush Settings -->
        <div class="toolbar-group" style="display: flex; align-items: center; margin-right: 20px;">
          <label style="margin-right: 5px; font-size: 12px;">Size:</label>
          <input type="range" id="brush-size" min="1" max="50" value="5" style="width: 80px; margin-right: 10px;">
          <span id="size-display" style="font-size: 12px; min-width: 20px;">5</span>
        </div>
        
        <!-- Color Picker -->
        <div class="toolbar-group" style="display: flex; align-items: center; margin-right: 20px;">
          <label style="margin-right: 5px; font-size: 12px;">Color:</label>
          <input type="color" id="color-picker" value="#000000" style="width: 40px; height: 30px; border: 1px solid #ccc; cursor: pointer;">
        </div>
        
        <div class="toolbar-separator" style="width: 1px; height: 30px; background: #ccc; margin: 0 10px;"></div>
        
        <!-- Image Operations -->
        <div class="toolbar-group" style="display: flex; align-items: center;">
          <button id="clear-canvas" class="toolbar-btn">🗑️ Clear</button>
          <button id="resize-canvas" class="toolbar-btn">📐 Resize</button>
        </div>
        
      </div>
    `;
    
    // Add toolbar styles
    const style = document.createElement('style');
    style.textContent = `
      .toolbar-btn {
        background: linear-gradient(to bottom, #ffffff, #f0f0f0);
        border: 1px solid #ccc;
        border-radius: 3px;
        padding: 5px 10px;
        margin: 0 2px;
        cursor: pointer;
        font-size: 12px;
        transition: all 0.2s;
      }
      .toolbar-btn:hover {
        background: linear-gradient(to bottom, #f0f0f0, #e0e0e0);
        border-color: #999;
      }
      .toolbar-btn:active {
        background: linear-gradient(to bottom, #e0e0e0, #d0d0d0);
        box-shadow: inset 0 2px 4px rgba(0,0,0,0.1);
      }
      .toolbar-btn.active {
        background: linear-gradient(to bottom, #4CAF50, #45a049);
        color: white;
        border-color: #45a049;
      }
    `;
    document.head.appendChild(style);
    
    // Insert toolbar into page
    document.body.insertAdjacentHTML('afterbegin', toolbarHTML);
    
    // Adjust main container to account for toolbar
    const container = document.getElementById('content-frame-container');
    if (container) {
      container.style.marginTop = '50px';
    }
    
    // Bind toolbar events
    bindToolbarEvents();
  }
  
  function bindToolbarEvents() {
    // Save button
    document.getElementById('save-raster-btn').addEventListener('click', () => {
      if (window.filePath && typeof window.saveRasterImage === 'function') {
        window.saveRasterImage(window.filePath);
      }
    });
    
    // Revert button
    document.getElementById('revert-btn').addEventListener('click', () => {
      if (window.originalImage && window.rasterCtx) {
        window.rasterCtx.clearRect(0, 0, window.rasterCanvas.width, window.rasterCanvas.height);
        window.rasterCtx.drawImage(window.originalImage, 0, 0);
      }
    });
    
    // Tool selection
    document.querySelectorAll('.tool-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        // Remove active class from all tools
        document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
        // Add active class to clicked tool
        e.target.classList.add('active');
        
        // Update current tool
        const tool = e.target.dataset.tool;
        if (window.rasterEditor) {
          window.rasterEditor.currentTool = tool;
          
          // Update cursor based on tool
          if (window.rasterCanvas) {
            switch(tool) {
              case 'brush':
                window.rasterCanvas.style.cursor = 'crosshair';
                break;
              case 'eraser':
                window.rasterCanvas.style.cursor = 'grab';
                break;
              case 'fill':
                window.rasterCanvas.style.cursor = 'crosshair';
                break;
              case 'eyedropper':
                window.rasterCanvas.style.cursor = 'crosshair';
                break;
            }
          }
        }
        
        console.log('Selected tool:', tool);
      });
    });
    
    // Brush size slider
    document.getElementById('brush-size').addEventListener('input', (e) => {
      const size = e.target.value;
      document.getElementById('size-display').textContent = size;
      if (window.rasterEditor) {
        window.rasterEditor.brushSize = parseInt(size);
      }
    });
    
    // Color picker
    document.getElementById('color-picker').addEventListener('change', (e) => {
      if (window.rasterEditor) {
        window.rasterEditor.brushColor = e.target.value;
      }
    });
    
    // Clear canvas
    document.getElementById('clear-canvas').addEventListener('click', () => {
      if (confirm('Clear the entire canvas? This cannot be undone.')) {
        if (window.rasterCtx) {
          window.rasterCtx.clearRect(0, 0, window.rasterCanvas.width, window.rasterCanvas.height);
          // Fill with white background
          window.rasterCtx.fillStyle = '#ffffff';
          window.rasterCtx.fillRect(0, 0, window.rasterCanvas.width, window.rasterCanvas.height);
        }
      }
    });
    
    // Resize canvas
    document.getElementById('resize-canvas').addEventListener('click', () => {
      const newWidth = prompt('Enter new width:', window.rasterCanvas.width);
      const newHeight = prompt('Enter new height:', window.rasterCanvas.height);
      
      if (newWidth && newHeight && !isNaN(newWidth) && !isNaN(newHeight)) {
        // Store current canvas data
        const imageData = window.rasterCtx.getImageData(0, 0, window.rasterCanvas.width, window.rasterCanvas.height);
        
        // Resize canvas
        window.rasterCanvas.width = parseInt(newWidth);
        window.rasterCanvas.height = parseInt(newHeight);
        window.overlayCanvas.width = parseInt(newWidth);
        window.overlayCanvas.height = parseInt(newHeight);
        
        // Clear and fill with white
        window.rasterCtx.fillStyle = '#ffffff';
        window.rasterCtx.fillRect(0, 0, window.rasterCanvas.width, window.rasterCanvas.height);
        
        // Restore image data
        window.rasterCtx.putImageData(imageData, 0, 0);
        
        // Update canvas info
        document.getElementById('canvas-info').textContent = `${newWidth} x ${newHeight}px`;
      }
    });
  }
  
  // Export function globally
  window.initRasterToolbar = initRasterToolbar;
})();