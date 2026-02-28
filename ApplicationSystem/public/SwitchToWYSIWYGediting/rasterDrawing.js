// FILE: rasterDrawing.js
// Purpose: TODO: Add description of module purpose
// Canvas drawing functionality for raster editing

(function() {
  function initRasterDrawing() {
    console.log("Initializing raster drawing functionality");
    
    if (!window.rasterCanvas || !window.rasterEditor) {
      console.error("Canvas or editor not initialized");
      return;
    }
    
    const canvas = window.rasterCanvas;
    const ctx = window.rasterCtx;
    const editor = window.rasterEditor;
    
    let isDrawing = false;
    let lastX = 0;
    let lastY = 0;
    
    // Get mouse/touch coordinates relative to canvas
    function getCoordinates(e) {
      const rect = canvas.getBoundingClientRect();
      const clientX = e.clientX || (e.touches && e.touches[0].clientX);
      const clientY = e.clientY || (e.touches && e.touches[0].clientY);
      
      return {
        x: (clientX - rect.left) * (canvas.width / rect.width),
        y: (clientY - rect.top) * (canvas.height / rect.height)
      };
    }
    
    // Brush drawing function
    function drawBrush(x, y) {
      ctx.globalCompositeOperation = 'source-over';
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.lineWidth = editor.brushSize;
      ctx.strokeStyle = editor.brushColor;
      
      if (!isDrawing) {
        ctx.beginPath();
        ctx.moveTo(x, y);
        lastX = x;
        lastY = y;
        return;
      }
      
      ctx.beginPath();
      ctx.moveTo(lastX, lastY);
      ctx.lineTo(x, y);
      ctx.stroke();
      
      lastX = x;
      lastY = y;
    }
    
    // Eraser function
    function drawEraser(x, y) {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.lineWidth = editor.brushSize;
      
      if (!isDrawing) {
        ctx.beginPath();
        ctx.moveTo(x, y);
        lastX = x;
        lastY = y;
        return;
      }
      
      ctx.beginPath();
      ctx.moveTo(lastX, lastY);
      ctx.lineTo(x, y);
      ctx.stroke();
      
      lastX = x;
      lastY = y;
    }
    
    // Flood fill function
    function floodFill(startX, startY, fillColor) {
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      const width = canvas.width;
      const height = canvas.height;
      
      // Convert fill color to RGB
      const fillRGB = hexToRgb(fillColor);
      if (!fillRGB) return;
      
      const startIndex = (startY * width + startX) * 4;
      const startR = data[startIndex];
      const startG = data[startIndex + 1];
      const startB = data[startIndex + 2];
      
      // Don't fill if the color is the same
      if (startR === fillRGB.r && startG === fillRGB.g && startB === fillRGB.b) {
        return;
      }
      
      const stack = [[startX, startY]];
      
      while (stack.length > 0) {
        const [x, y] = stack.pop();
        
        if (x < 0 || x >= width || y < 0 || y >= height) continue;
        
        const index = (y * width + x) * 4;
        const r = data[index];
        const g = data[index + 1];
        const b = data[index + 2];
        
        if (r !== startR || g !== startG || b !== startB) continue;
        
        data[index] = fillRGB.r;
        data[index + 1] = fillRGB.g;
        data[index + 2] = fillRGB.b;
        data[index + 3] = 255;
        
        stack.push([x + 1, y]);
        stack.push([x - 1, y]);
        stack.push([x, y + 1]);
        stack.push([x, y - 1]);
      }
      
      ctx.putImageData(imageData, 0, 0);
    }
    
    // Eyedropper function
    function eyedropper(x, y) {
      const imageData = ctx.getImageData(x, y, 1, 1);
      const data = imageData.data;
      const r = data[0];
      const g = data[1];
      const b = data[2];
      
      const hexColor = '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
      
      // Update color picker
      const colorPicker = document.getElementById('color-picker');
      if (colorPicker) {
        colorPicker.value = hexColor;
        editor.brushColor = hexColor;
      }
    }
    
    // Helper function to convert hex to RGB
    function hexToRgb(hex) {
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
      } : null;
    }
    
    // Mouse event handlers
    function handleMouseDown(e) {
      e.preventDefault();
      const coords = getCoordinates(e);
      
      // Fixed switch statement - removed duplicate cases and ensured proper structure
      switch (editor.currentTool) {
        case 'brush':
          isDrawing = true;
          drawBrush(coords.x, coords.y);
          break;
        
        case 'eraser':
          isDrawing = true;
          drawEraser(coords.x, coords.y);
          break;
        
        case 'fill':
          floodFill(Math.floor(coords.x), Math.floor(coords.y), editor.brushColor);
          break;
        
        case 'eyedropper':
          eyedropper(Math.floor(coords.x), Math.floor(coords.y));
          break;
        
        default:
          // Handle unknown tool types gracefully
          console.warn('Unknown tool type:', editor.currentTool);
          break;
      }
    }
    
    function handleMouseMove(e) {
      e.preventDefault();
      if (!isDrawing) return;
      
      const coords = getCoordinates(e);
      
      switch (editor.currentTool) {
        case 'brush':
          drawBrush(coords.x, coords.y);
          break;
        case 'eraser':
          drawEraser(coords.x, coords.y);
          break;
      }
    }
    
    function handleMouseUp(e) {
      e.preventDefault();
      isDrawing = false;
      ctx.globalCompositeOperation = 'source-over';
    }
    
    // Bind mouse events
    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('mouseout', handleMouseUp);
    
    // Bind touch events for mobile
    canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const touch = e.touches[0];
      const mouseEvent = new MouseEvent('mousedown', {
        clientX: touch.clientX,
        clientY: touch.clientY
      });
      canvas.dispatchEvent(mouseEvent);
    });
    
    canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      const touch = e.touches[0];
      const mouseEvent = new MouseEvent('mousemove', {
        clientX: touch.clientX,
        clientY: touch.clientY
      });
      canvas.dispatchEvent(mouseEvent);
    });
    
    canvas.addEventListener('touchend', (e) => {
      e.preventDefault();
      const mouseEvent = new MouseEvent('mouseup', {});
      canvas.dispatchEvent(mouseEvent);
    });
    
    console.log("Raster drawing functionality initialized");
  }
  
  // Export function globally
  window.initRasterDrawing = initRasterDrawing;
})();