// Nodevision/public/SwitchToWYSIWYGediting.js
;(function() {
    // compute the directory this script lives in
    const currentScript = document.currentScript.src;
    const basePath = currentScript.replace(/SwitchToWYSIWYGediting\.js$/, 'SwitchToWYSIWYGediting/');
  
    const scripts = [
      'formatHtml.js',
      'saveWYSIWYGFile.js',
      'toolbar.js',
      'fileLoader.js',
      'tabHandler.js',
      'imageHandling.js',
      'clipboardHandler.js',
      'imageCropper.js',
      'editRasterToolbar.js',
      'initWYSIWYG.js'
    ];
  
    function loadNext(i) {
      if (i >= scripts.length) return;
      const src = basePath + scripts[i];
      const tag = document.createElement('script');
      tag.src = src;
      tag.defer = true;
      tag.onload  = () => loadNext(i + 1);
      tag.onerror = () => console.error('Failed to load', src);
      document.head.appendChild(tag);
    }
  
    loadNext(0);
  })();
  