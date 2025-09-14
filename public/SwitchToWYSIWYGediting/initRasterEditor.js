// FILE: initRasterEditor.js
// Initialize the raster image editor with canvas and controls

(function() {
  function initRasterEditor(originalImage) {
    console.log("Initializing raster editor");
    
    const container = document.getElementById('content-frame-container');
    if (!container) {
      console.error("Container not found");
      return;
    }
    
    // Create the raster editor interface
    const editorHTML = `
      <div id="raster-editor-container" style="width: 100%; height: 100%; display: flex; flex-direction: column; background: #f5f5f5;">
        
        <!-- Canvas Container -->
        <div id="canvas-container" style="flex: 1; display: flex; justify-content: center; align-items: center; overflow: auto; background: #e0e0e0;">
          <div id="canvas-wrapper" style="position: relative; background: white; box-shadow: 0 4px 8px rgba(0,0,0,0.1);">
            <canvas id="raster-canvas" style="display: block; cursor: crosshair;"></canvas>
            <canvas id="overlay-canvas" style="position: absolute; top: 0; left: 0; pointer-events: none;"></canvas>
          </div>
        </div>
        
        <!-- Status Bar -->
        <div id="raster-status" style="height: 30px; background: #333; color: white; display: flex; align-items: center; padding: 0 10px; font-size: 12px;">
          <span>Ready</span>
          <span style="margin-left: auto;" id="canvas-info"></span>
        </div>
      </div>
    `;
    
    container.innerHTML = editorHTML;
    
    // Initialize canvas
    const canvas = document.getElementById('raster-canvas');
    const overlayCanvas = document.getElementById('overlay-canvas');
    const ctx = canvas.getContext('2d');
    const overlayCtx = overlayCanvas.getContext('2d');
    
    // Set canvas dimensions to match image
    canvas.width = originalImage.width;
    canvas.height = originalImage.height;
    overlayCanvas.width = originalImage.width;
    overlayCanvas.height = originalImage.height;
    
    // Draw the original image
    ctx.drawImage(originalImage, 0, 0);
    
    // Update canvas info
    document.getElementById('canvas-info').textContent = `${originalImage.width} x ${originalImage.height}px`;
    
    // Store references globally for other modules
    window.rasterCanvas = canvas;
    window.rasterCtx = ctx;
    window.overlayCanvas = overlayCanvas;
    window.overlayCtx = overlayCtx;
    window.rasterEditor = {
      canvas: canvas,
      ctx: ctx,
      overlayCanvas: overlayCanvas,
      overlayCtx: overlayCtx,
      originalImage: originalImage,
      currentTool: 'brush',
      brushSize: 5,
      brushColor: '#000000',
      isDrawing: false
    };
    
    // Initialize drawing functionality
    if (typeof window.initRasterDrawing === 'function') {
      window.initRasterDrawing();
    }
    
    // Initialize toolbar
    if (typeof window.initRasterToolbar === 'function') {
      window.initRasterToolbar();
    }
    
    // Initialize layers system
    if (typeof window.initializeLayers === 'function') {
      window.initializeLayers();
    }
    
    console.log("Raster editor initialized successfully");
  }
  
  // Export function globally
  window.initRasterEditor = initRasterEditor;
})();