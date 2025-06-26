
// FILE: initWYSIWYG.js
(function(){
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
    window.AppState.setMode('WYSIWYG Editing');
  } else {
    window.currentMode = 'WYSIWYG Editing';
  }

  // Inject editor container into right-plane
  const container = document.getElementById('content-frame-container');
  if (!container) {
    console.error("Target container 'content-frame-container' not found.");
    return;
  }

  container.innerHTML = '' +
    '<div id="ScrollableElementStyles">' +
    '  <div id="editor" contenteditable="true" word-wrap: break-word; width:"50%""></div>' +
    '  <p id="message"></p>' +
    '  <p id="errorMessage" style="color:red;"></p>' +
    '</div>';

  // Grab editor reference
  const editor = document.getElementById('editor');

  // Load file contents then initialize features
  window.loadFileContents(filePath, function() {
    window.enableTabInsert(editor);
    window.initImageHandling(editor);
    window.initClipboardHandlers();
  });

  // Update toolbar and add raster controls
  window.updateWYSIWYGToolbar(filePath);
  window.addEditRasterToolbarItem();

  console.log('WYSIWYG editing initialized for:', filePath);





})();
