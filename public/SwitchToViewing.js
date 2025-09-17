// FILE: SwitchToViewing.js
// Purpose: TODO: Add description of module purpose
(function(){
    // Return to default view mode
    const container = document.getElementById('content-frame-container');
    if (!container) {
      console.error("Target container 'content-frame-container' not found.");
      return;
    }
  
    // Switch app state back to default view
    if (window.AppState && typeof window.AppState.setMode === 'function') {
      window.AppState.setMode('Default View');
    } else {
      window.currentMode = 'Default View';
    }
  
    // Clean up WYSIWYG toolbars and editor
    const saveBtn = document.getElementById('save-wysiwyg-btn');
    saveBtn && saveBtn.remove();
    const editRasterToolbar = document.getElementById('edit-raster-sub-toolbar');
    editRasterToolbar && editRasterToolbar.remove();
  
    // Destroy editor if present
    const editor = document.getElementById('editor');
    if (editor) {
      editor.removeEventListener('keydown', window.enableTabInsert);
      window.initImageHandling && container.removeEventListener('click', window.initImageHandling);
      editor.remove();
    }
  
    // Use InfoPanel.js to render default view
    // Assumes updateInfoPanel is globally available
    if (typeof window.updateInfoPanel === 'function') {
      window.updateInfoPanel(window.currentActiveFilePath);
    } else {
      console.warn('updateInfoPanel not available; falling back to direct fetch');
      const viewUrl = '/api/viewContent?path=' + encodeURIComponent(window.currentActiveFilePath);
      fetch(viewUrl)
        .then(res => res.text())
        .then(html => { container.innerHTML = html; })
        .catch(err => console.error('Error loading view content:', err));
    }
  
    console.log('Returned to default view for:', window.currentActiveFilePath);
  })();
  