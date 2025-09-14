//Nodevision/public/SwitchToWYSIWYGediting.js
(function() {
  // compute the directory this script lives in
  const currentScript = document.currentScript.src;
  const basePath = currentScript.replace(/SwitchToWYSIWYGediting\.js$/, 'SwitchToWYSIWYGediting/');

  // Grab file extension from query params
  const params   = new URLSearchParams(window.location.search);
  const filePath = params.get('path') || '';
  const ext      = filePath.split('.').pop().toLowerCase();

  // Map file types to their editor script bundles
  const scriptBundles = {
    html: [
      'saveWYSIWYGFile.js',
      'toolbar.js',
      'fileLoader.js',
      'tabHandler.js',
      'imageHandling.js',
      'clipboardHandler.js',
      'imageCropper.js',
      'editRasterToolbar.js',
      'initWYSIWYG.js'
    ],
    // Raster image editing bundle
    png: [
      'loadRasterImage.js',
      'initRasterEditor.js',
      'saveRasterImage.js',
      'rasterToolbar.js',
      'rasterDrawing.js'
    ],
    jpg: [
      'loadRasterImage.js',
      'initRasterEditor.js',
      'saveRasterImage.js',
      'rasterToolbar.js',
      'rasterDrawing.js'
    ],
    jpeg: [
      'loadRasterImage.js',
      'initRasterEditor.js',
      'saveRasterImage.js',
      'rasterToolbar.js',
      'rasterDrawing.js'
    ],
    gif: [
      'loadRasterImage.js',
      'initRasterEditor.js',
      'saveRasterImage.js',
      'rasterToolbar.js',
      'rasterDrawing.js'
    ],
    bmp: [
      'loadRasterImage.js',
      'initRasterEditor.js',
      'saveRasterImage.js',
      'rasterToolbar.js',
      'rasterDrawing.js'
    ],
    webp: [
      'loadRasterImage.js',
      'initRasterEditor.js',
      'saveRasterImage.js',
      'rasterToolbar.js',
      'rasterDrawing.js'
    ],
    md: [
      'loadMarkdown.js',
      'saveMarkdown.js',
      'initMarkdownEditor.js'
    ],
    json: [
      'loadJSON.js',
      'saveJSON.js',
      'initJSONEditor.js'
    ],
    csv: [
      'loadCSV.js',
      'saveCSV.js',
      'initCSVEditor.js'
    ]
    // add other types if needed
  };

  // Fallback to HTML bundle for unsupported file types
  const fallbackScripts = scriptBundles.html;

  // Determine which scripts to load
  const scripts = scriptBundles[ext] || fallbackScripts;

  // Debug: see what we're loading
  console.log('SwitchToWYSIWYGediting:', { ext, scripts });

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
  

//This uses code from: https://michilehr.de/overwrite-cmds-and-ctrls-in-javascript/
  document.addEventListener("keydown", function(e) {
  if ((window.navigator.platform.match("Mac") ? e.metaKey : e.ctrlKey)  && e.keyCode == 83) {
    e.preventDefault();
    // Process the event here (such as click on submit button)
    console.log("Saving" + window.filePath);
    
    // Guard check: prevent ReferenceError for raster images
    if (typeof saveWYSIWYGFile === 'function') {
      saveWYSIWYGFile(window.filePath);
    } else if (typeof saveRasterImage === 'function' && window.rasterCanvas) {
      // For raster image editing, use the raster save function
      saveRasterImage(window.filePath);
    } else {
      console.warn('No appropriate save function available for current editor mode');
    }
  }
}, false);
})();




