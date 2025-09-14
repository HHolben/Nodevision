// Nodevision/public/SwitchToRasterEditing.js
(function() {
    // Compute the directory this script lives in
    const currentScript = document.currentScript.src;
    const basePath = currentScript.replace(/SwitchToRasterEditing\.js$/, 'SwitchToWYSIWYGediting/');

    // Grab file extension from query params
    const params = new URLSearchParams(window.location.search);
    const filePath = params.get('path') || '';
    const ext = filePath.split('.').pop().toLowerCase();

    // ✅ Expose globally for save and shortcuts
    window.filePath = filePath;

    // Map file types to their raster editor script bundles
    const scriptBundles = {
        png: [
            'loadRasterImage.js',
            'rasterToolbar.js',
            'rasterDrawing.js',
            'initRasterEditor.js',
            'saveRasterImage.js'
        ],
        jpg: [
            'loadRasterImage.js',
            'rasterToolbar.js',
            'rasterDrawing.js',
            'initRasterEditor.js',
            'saveRasterImage.js'
        ],
        jpeg: [
            'loadRasterImage.js',
            'rasterToolbar.js',
            'rasterDrawing.js',
            'initRasterEditor.js',
            'saveRasterImage.js'
        ],
        gif: [
            'loadRasterImage.js',
            'rasterToolbar.js',
            'rasterDrawing.js',
            'initRasterEditor.js',
            'saveRasterImage.js'
        ],
        bmp: [
            'loadRasterImage.js',
            'rasterToolbar.js',
            'rasterDrawing.js',
            'initRasterEditor.js',
            'saveRasterImage.js'
        ],
        webp: [
            'loadRasterImage.js',
            'rasterToolbar.js',
            'rasterDrawing.js',
            'initRasterEditor.js',
            'saveRasterImage.js'
        ]
    };

    // Use PNG bundle as fallback for unknown raster formats
    const fallbackScripts = scriptBundles.png;

    // Determine which scripts to load
    const scripts = scriptBundles[ext] || fallbackScripts;

    console.log('SwitchToRasterEditing:', { ext, scripts, filePath });

    function loadNext(i) {
        if (i >= scripts.length) return;
        const src = basePath + scripts[i];
        const tag = document.createElement('script');
        tag.src = src;
        tag.defer = true;
        tag.onload = () => loadNext(i + 1);
        tag.onerror = () => console.error('Failed to load raster script:', src);
        document.head.appendChild(tag);
    }

    loadNext(0);

    // Set up keyboard shortcuts for raster editing
    document.addEventListener("keydown", function(e) {
        if ((window.navigator.platform.match("Mac") ? e.metaKey : e.ctrlKey) && e.keyCode == 83) {
            e.preventDefault();
            // Process the save for raster editing
            console.log("Saving raster image:", window.filePath);
            if (typeof window.saveRasterImage === 'function') {
                window.saveRasterImage(window.filePath);
            } else {
                console.warn("saveRasterImage function not available yet");
            }
        }
    }, false);
})();