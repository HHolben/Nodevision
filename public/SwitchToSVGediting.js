// Nodevision/public/SwitchToSVGediting.js
// Purpose: TODO: Add description of module purpose
(function() {
    // compute the directory this script lives in
    const currentScript = document.currentScript.src;
    const basePath = currentScript.replace(/SwitchToSVGediting\.js$/, 'SwitchToSVGediting/');

    // Grab file extension from query params
    const params   = new URLSearchParams(window.location.search);
    const filePath = params.get('path') || '';
    const ext      = filePath.split('.').pop().toLowerCase();

    // ✅ Expose globally for saveSVG and shortcut
    window.filePath = filePath;

    // Map file types to their editor script bundles
    const scriptBundles = {
        svg: [
            'loadSVG.js',
            'initSVGEditor.js',
            'saveSVG.js'
        ]
    };

    // Fallback to SVG bundle if unsupported
    const fallbackScripts = scriptBundles.svg;

    // Determine which scripts to load
    const scripts = scriptBundles[ext] || fallbackScripts;

    console.log('SwitchToSVGediting:', { ext, scripts, filePath });

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

    // Initialize SVG editor context
    document.addEventListener('DOMContentLoaded', () => {
        // ✅ Allow both possible IDs: "svg-editor-root" or "svg-editor"
        const svgRoot = document.getElementById('svg-editor') 
                     || document.getElementById('svg-editor-root');

        if (!svgRoot) {
            console.error('SVG root element not found. Add <svg id="svg-editor"></svg> or <svg id="svg-editor-root"></svg> in the panel.');
            return;
        }

        window.SVGEditorContext = { svgRoot };
        window.selectSVGElement = (el) => {
            console.log('Selected SVG element:', el);
            // Optional: highlight or store selected element
        };

        console.log('SVG editor context initialized.');
    });

    // Keyboard shortcut: Ctrl+S / Cmd+S
    document.addEventListener('keydown', function(e) {
        const isMac = window.navigator.platform.match("Mac");
        if ((isMac ? e.metaKey : e.ctrlKey) && e.keyCode === 83) {
            e.preventDefault();
            console.log("Saving SVG:", window.filePath);
            if (typeof window.saveSVG === 'function' && window.filePath) {
                window.saveSVG(window.filePath);
            } else {
                console.error("saveSVG function or filePath not available.");
            }
        }
    }, false);

})();
