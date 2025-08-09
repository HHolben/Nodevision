//Nodevision/public/SwitchToCodeEditing.js

(function () {
    // Determine active node and filePath.
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

    // Set the mode to Code Editing using the centralized state manager (if available)
    if (window.AppState && typeof window.AppState.setMode === 'function') {
        window.AppState.setMode('Code Editing');
    } else {
        window.currentMode = 'Code Editing';
    }

    // Populate the right panel with the code IDE environment.
    // In index.html the right panel has a container with id "element-info"
const contentElement = document.getElementById('element-info');
if (!contentElement) {
  console.error("Right panel container 'element-info' not found.");
  return;
}

// ── NEW: size the info panel to fill the viewport ───────────────────────
// assume your toolbar sits at the top; grab its height:
const toolbar = document.querySelector('.toolbar');
const toolbarHeight = toolbar ? toolbar.offsetHeight : 0;

// compute available height and apply it:
const availableH = window.innerHeight - toolbarHeight;
contentElement.style.height = availableH + 'px';
contentElement.style.overflow = 'hidden';
// ─────────────────────────────────────────────────────────────────────────

 // Clear any existing content.
contentElement.innerHTML = '';

    // Create a container for the Monaco Editor.
    const editorContainer = document.createElement('div');
    editorContainer.id = 'monaco-editor';
    // Ensure the editor takes up the full area of the container.
    editorContainer.style.width = '100%';
    editorContainer.style.height = '100%';
    contentElement.appendChild(editorContainer);

    // Function to initialize Monaco Editor with the given content.
    function initializeMonaco(content) {
        // Configure RequireJS to load Monaco from the CDN.
require.config({ paths: { 'vs': '/lib/monaco/vs' } });
        // Load the main module for the Monaco Editor.
        require(['vs/editor/editor.main'], function () {
            window.monacoEditor = monaco.editor.create(editorContainer, {
                value: content,
                language: 'javascript', // Change the language as needed.
                theme: 'vs-dark',       // Options include 'vs', 'vs-dark', etc.
                automaticLayout: true
            });
        });
    }

    // Function to fetch file contents.
    function loadFileContents() {
        if (!filePath) return;
        
        fetch(`/api/fileCodeContent?path=${encodeURIComponent(filePath)}`)
            .then(response => {
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                return response.json();
            })
            .then(data => {
                // Initialize Monaco with the fetched content.
                initializeMonaco(data.content);
            })
            .catch(error => {
                console.error('Error fetching file content:', error);
                // Fallback: initialize Monaco with an error message.
                initializeMonaco('// Error fetching file content: ' + error.message);
            });
    }

    // Load file contents (which in turn initializes Monaco).
    loadFileContents();

    // Update the toolbar with a "Save changes" button for code editing.
    function updateToolbar(filePath) {
        const toolbarContainer = document.querySelector('.toolbar');
        if (!toolbarContainer) {
            console.error("Toolbar container not found.");
            return;
        }
        // Look for an existing "File" dropdown; if not, create one.
        let fileDropdown = toolbarContainer.querySelector('.dropdown[data-category="File"]');
        if (!fileDropdown) {
            fileDropdown = document.createElement('div');
            fileDropdown.className = 'dropdown';
            fileDropdown.setAttribute('data-category', 'File');

            const fileButton = document.createElement('button');
            fileButton.className = 'dropbtn';
            fileButton.textContent = 'File';
            fileDropdown.appendChild(fileButton);

            const dropdownContent = document.createElement('div');
            dropdownContent.className = 'dropdown-content';
            fileDropdown.appendChild(dropdownContent);

            toolbarContainer.appendChild(fileDropdown);
        }
        // Add a "Save changes" button.
        const dropdownContent = fileDropdown.querySelector('.dropdown-content');
        if (!saveBtn) {
            saveBtn = document.createElement('button');
            saveBtn.id = 'save-code-btn';
            saveBtn.textContent = 'Save changes';
           
            dropdownContent.appendChild(saveBtn);
        }
    }

    updateToolbar(filePath);

    console.log("Code editing mode activated for:", filePath);
})();
