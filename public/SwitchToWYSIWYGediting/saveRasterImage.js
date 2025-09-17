// FILE: saveRasterImage.js
// Purpose: TODO: Add description of module purpose
// Save edited raster images

(function() {
  function saveRasterImage(filePath) {
    console.log("Saving raster image:", filePath);
    
    if (!window.rasterCanvas) {
      console.error("No raster canvas found to save");
      return;
    }
    
    // Detect original format from filename extension
    const fileExt = filePath.split('.').pop().toLowerCase();
    let mimeType = 'image/png'; // default fallback
    let quality = 1.0; // default quality
    let actualFilePath = filePath; // may be modified for unsupported formats
    let formatConverted = false;
    
    // Handle unsupported formats that Canvas cannot encode to
    if (fileExt === 'gif' || fileExt === 'bmp') {
      // Convert unsupported formats to PNG
      actualFilePath = filePath.replace(/\.(gif|bmp)$/i, '.png');
      mimeType = 'image/png';
      formatConverted = true;
      console.log(`Converting ${fileExt.toUpperCase()} to PNG: ${filePath} -> ${actualFilePath}`);
      
      // Notify user about format conversion
      const statusEl = document.getElementById('raster-status');
      if (statusEl) {
        statusEl.querySelector('span').textContent = `Converting ${fileExt.toUpperCase()} to PNG...`;
      }
    } else {
      // Handle supported formats
      switch (fileExt) {
        case 'jpg':
        case 'jpeg':
          mimeType = 'image/jpeg';
          quality = 0.9; // JPEG compression quality
          break;
        case 'webp':
          mimeType = 'image/webp';
          quality = 0.9;
          break;
        case 'png':
        default:
          mimeType = 'image/png';
          break;
      }
    }
    
    // Get the canvas data preserving original format
    const canvas = window.rasterCanvas;
    const dataURL = canvas.toDataURL(mimeType, quality);
    
    // Convert base64 to blob
    const base64Data = dataURL.split(',')[1];
    
    // Create form data for upload
    const formData = new FormData();
    
    // Convert base64 to blob
    const byteCharacters = atob(base64Data);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: mimeType });
    
    formData.append('file', blob, actualFilePath);
    
    // Update status
    const statusEl = document.getElementById('raster-status');
    if (statusEl && !formatConverted) {
      statusEl.querySelector('span').textContent = 'Saving...';
    }
    
    // Save using the correct save API endpoint with base64 data
    fetch('/api/save', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        path: actualFilePath,
        content: base64Data,
        encoding: 'base64',
        mimeType: mimeType
      })
    })
    .then(response => response.json())
    .then(data => {
      console.log('Image saved successfully:', data);
      if (statusEl) {
        if (formatConverted) {
          statusEl.querySelector('span').textContent = `Converted to PNG and saved successfully`;
          // Update the current file path in the window to reflect the new filename
          window.filePath = actualFilePath;
          // Also update the page title if it shows the filename
          if (document.title.includes(filePath.split('/').pop())) {
            document.title = document.title.replace(filePath.split('/').pop(), actualFilePath.split('/').pop());
          }
        } else {
          statusEl.querySelector('span').textContent = 'Saved successfully';
        }
        setTimeout(() => {
          statusEl.querySelector('span').textContent = 'Ready';
        }, 3000); // Give more time to read the conversion message
      }
    })
    .catch(error => {
      console.error('Error saving image:', error);
      if (statusEl) {
        if (formatConverted) {
          statusEl.querySelector('span').textContent = 'Conversion to PNG failed';
        } else {
          statusEl.querySelector('span').textContent = 'Save failed';
        }
        setTimeout(() => {
          statusEl.querySelector('span').textContent = 'Ready';
        }, 2000);
      }
    });
  }
  
  // Export function globally
  window.saveRasterImage = saveRasterImage;
})();