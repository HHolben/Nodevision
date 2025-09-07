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
      <svg id="svg-editor" width="100%" height="100%" style="border:1px solid #ccc;">
        <!-- SVG content will be loaded here -->
      </svg>
      <p id="svg-message"></p>
      <p id="svg-error" style="color:red;"></p>
    </div>
  `;

  const svgEditor = document.getElementById('svg-editor');

  // Load SVG file content
  window.loadFileContents(filePath, function(content) {
    try {
      svgEditor.innerHTML = content || '';
    } catch (err) {
      console.error("Failed to load SVG content:", err);
      document.getElementById('svg-error').textContent = err.message;
    }
  });

  // Initialize toolbar and insert callbacks for SVG
  if (window.initInsertCallbacks) {
    window.initInsertCallbacks(svgEditor);
  }

  console.log('SVG editing initialized for:', filePath);
})();
