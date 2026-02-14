//Nodevision/public/SwitchToCodeEditing.js// Nodevision/public/SwitchToCodeEditing.js
// Purpose: TODO: Add description of module purpose
(function () {
    // Determine active node and filePath
    let activeNode = window.ActiveNode;
    if (!activeNode) {
        const urlParams = new URLSearchParams(window.location.search);
        activeNode = urlParams.get('activeNode');
    }
    if (!activeNode) {
        console.error("No activeNode specified.");
        return;
    }
    const filePath = `Notebook/${activeNode}`;
    window.currentActiveFilePath = filePath;

    // Set the mode to Code Editing
    if (window.AppState && typeof window.AppState.setMode === 'function') {
        window.AppState.setMode('Code Editing');
    } else {
        window.currentMode = 'Code Editing';
    }

    // Populate the right panel with the code IDE environment.
    const contentElement = document.getElementById('element-info');
    if (!contentElement) {
        console.error("Right panel container 'element-info' not found.");
        return;
    }

    // Size the info panel to fill the viewport under the toolbar
    const toolbar = document.querySelector('.toolbar');
    const toolbarHeight = toolbar ? toolbar.offsetHeight : 0;
    const availableH = window.innerHeight - toolbarHeight;
    contentElement.style.height = availableH + 'px';
    contentElement.style.overflow = 'hidden';

    // Clear any existing content
    contentElement.innerHTML = '';

    // Create a container for Monaco Editor
    const editorContainer = document.createElement('div');
    editorContainer.id = 'monaco-editor';
    editorContainer.style.width = '100%';
    editorContainer.style.height = '100%';
    contentElement.appendChild(editorContainer);

    // Initialize Monaco Editor with content
    function initializeMonaco(content) {
        // RequireJS must already be loaded in index.html
        require.config({ paths: { 'vs': '/lib/monaco/vs' } });
        require(['vs/editor/editor.main'], function () {
            window.monacoEditor = monaco.editor.create(editorContainer, {
                value: content,
                language: 'javascript', // adjust by file type if needed
                theme: 'vs-dark',
                automaticLayout: true
            });
        });
    }

    // Fetch file contents and initialize editor
    function loadFileContents() {
        if (!filePath) return;

        fetch(`/api/fileCodeContent?path=${encodeURIComponent(filePath)}`)
            .then(response => {
                if (!response.ok) throw new Error('Network response was not ok');
                return response.json();
            })
            .then(data => {
                window.currentFileEncoding = data.encoding || 'utf8';
                window.currentFileBom = Boolean(data.bom);
                initializeMonaco(data.content);
            })
            .catch(error => {
                console.error('Error fetching file content:', error);
                initializeMonaco('// Error fetching file content: ' + error.message);
            });
    }

    loadFileContents();

    console.log("Code editing mode activated for:", filePath);
})();
