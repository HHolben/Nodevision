// FILE: loadRasterImage.js
// Load and display raster images for editing

(function() {
  function loadRasterImage(filePath) {
    console.log("Loading raster image:", filePath);
    
    // Set global file path for saving
    window.filePath = filePath;
    window.currentActiveFilePath = filePath;
    
    const container = document.getElementById('content-frame-container');
    if (!container) {
      console.error("Container 'content-frame-container' not found");
      return;
    }
    
    // Create the image loading UI (security fix: use DOM methods instead of innerHTML)
    const editorContainer = document.createElement('div');
    editorContainer.id = 'raster-editor-container';
    editorContainer.style.cssText = 'width: 100%; height: 100%; display: flex; flex-direction: column;';
    
    const loadingDiv = document.createElement('div');
    loadingDiv.id = 'raster-loading';
    loadingDiv.style.cssText = 'text-align: center; padding: 20px;';
    
    const loadingText = document.createElement('p');
    loadingText.textContent = `Loading image: ${filePath}`; // Safe: use textContent for user data
    
    loadingDiv.appendChild(loadingText);
    editorContainer.appendChild(loadingDiv);
    container.innerHTML = ''; // Clear container safely
    container.appendChild(editorContainer);
    
    // Load the image file
    const imagePath = `/Notebook/${filePath}`;
    const img = new Image();
    
    img.onload = function() {
      console.log("Image loaded successfully:", imagePath);
      // Store the original image for reference
      window.originalImage = img;
      window.originalImagePath = imagePath;
      
      // Trigger the raster editor initialization
      if (typeof window.initRasterEditor === 'function') {
        window.initRasterEditor(img);
      } else {
        console.error("initRasterEditor function not available");
      }
    };
    
    img.onerror = function() {
      console.error("Failed to load image:", imagePath);
      // Security fix: use DOM methods instead of innerHTML with user data
      const errorDiv = document.createElement('div');
      errorDiv.style.cssText = 'text-align: center; padding: 20px; color: red;';
      
      const errorTitle = document.createElement('h3');
      errorTitle.textContent = 'Error Loading Image';
      
      const errorMsg1 = document.createElement('p');
      errorMsg1.textContent = `Could not load: ${filePath}`; // Safe: use textContent
      
      const errorMsg2 = document.createElement('p');
      errorMsg2.textContent = 'Make sure the file exists and is a valid image format.';
      
      errorDiv.appendChild(errorTitle);
      errorDiv.appendChild(errorMsg1);
      errorDiv.appendChild(errorMsg2);
      
      container.innerHTML = '';
      container.appendChild(errorDiv);
    };
    
    img.src = imagePath;
  }
  
  // Auto-load image if filePath is available
  const params = new URLSearchParams(window.location.search);
  const filePath = params.get('path') || '';
  
  if (filePath) {
    loadRasterImage(filePath);
  }
  
  // Export function globally
  window.loadRasterImage = loadRasterImage;
})();