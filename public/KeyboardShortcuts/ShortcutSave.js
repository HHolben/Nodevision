(function() {
    // Global shortcut handler
    document.addEventListener("keydown", function(e) {
        const isMac = window.navigator.platform.toUpperCase().indexOf('MAC') >= 0;
        const ctrlOrCmd = isMac ? e.metaKey : e.ctrlKey;

        // Ctrl+S / Cmd+S
        if (ctrlOrCmd && e.key.toLowerCase() === 's') {
            e.preventDefault();

            // Prefer a unified save function if present
            if (typeof window.saveCurrentFile === 'function') {
                window.saveCurrentFile();
            }
            // Or fallback to mode-specific save
            else if (typeof window.saveCodeFile === 'function' && window.currentActiveFilePath) {
                window.saveCodeFile(window.currentActiveFilePath);
            }
            else if (typeof window.saveWYSIWYGFile === 'function' && window.filePath) {
                window.saveWYSIWYGFile(window.filePath);
            }
            else {
                console.warn("No save function found for current mode.");
            }
        }
    }, false);
})();
