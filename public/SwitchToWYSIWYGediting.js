function formatHtml(html) {
    let indentLevel = 0;  // Start with no indentation
    const formatted = html
        .replace(/></g, '>\n<')  // Add a line break between tags
        .split('\n')  // Split into lines
        .map(line => {
            line = line.trim();  // Trim whitespace from each line
            
            // Decrease indent level for closing tags
            if (line.startsWith('</')) {
                indentLevel = Math.max(indentLevel - 2, 0);
            }

            // Apply the appropriate number of tabs for indentation
            const indentedLine = '\t'.repeat(indentLevel) + line;

            // Increase indent level for opening tags (except self-closing tags)
            if (line.startsWith('<') && !line.startsWith('</') && !line.endsWith('/>')) {
                indentLevel++;
            }

            return indentedLine;
        })
        .filter(line => line !== '')  // Remove empty lines
        .join('\n');  // Join the lines back together

    return formatted;  // Return the final formatted HTML
}



// Expose the save function on the window so the toolbar can access it.
window.saveWYSIWYGFile = function(filePath) {
    const editor = document.getElementById('editor');
    const rawContent = editor.innerHTML;
    const formattedContent = formatHtml(rawContent);

    fetch('/api/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: filePath, content: formattedContent })
    })
    .then(response => response.text())
    .then(data => {
        const saveMessage = document.getElementById('message');
        saveMessage.textContent = 'File saved successfully!';
        setTimeout(() => (saveMessage.textContent = ''), 3000);
    })
    .catch(error => {
        console.error('Error saving file content:', error);
        document.getElementById('errorMessage').textContent =
            'Error saving file content: ' + error.message;
    });
};

function updateWYSIWYGToolbar(filePath) {
    const toolbarContainer = document.querySelector('.toolbar');
    if (!toolbarContainer) {
        console.error('Toolbar container not found.');
        return;
    }

    // Look for an existing "File" dropdown; if not present, create one.
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
    

}

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

    let filePath = `Notebook/${activeNode}`;
    window.currentActiveFilePath = filePath;

    if (!filePath) {
        console.error('No activeNode provided');
        document.getElementById('errorMessage').textContent = 'Error: No activeNode provided.';
    }

    // Set the mode to WYSIWYG Editing using the centralized state manager.
    if (window.AppState && typeof window.AppState.setMode === 'function') {
        window.AppState.setMode('WYSIWYG Editing');
    } else {
        // Fallback to legacy global if AppState isn't defined.
        window.currentMode = 'WYSIWYG Editing';
    }

    // Define the right-plane container for the editor.
    const rightPlane = document.getElementById('content-frame-container');
    if (!rightPlane) {
        console.error("Target container (id 'content-frame-container') not found.");
        return;
    }

    // Define the editor HTML without the Save button.
    const editorHTML = `
        <div id="ScrollableElementStyles">
            <div id="editor" contenteditable="true"></div>
            <p id="message"></p>
            <p id="errorMessage" style="color: red;"></p>
        </div>
    `;
    rightPlane.innerHTML = editorHTML;

    // Function to load file contents.
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
                document.getElementById('editor').innerHTML = data.content;
                console.log('File content loaded:', data.content);
            })
            .catch(error => {
                console.error('Error fetching file content:', error);
                document.getElementById('errorMessage').textContent = 'Error fetching file content: ' + error.message;
            });
    }

    // Load the file contents.
    loadFileContents();

    // Update the toolbar with the "Save changes" button for WYSIWYG editing.
    updateWYSIWYGToolbar(filePath);

    console.log("WYSIWYG editing mode activated for:", filePath);
})();


function InsertTab()
{
    const Tab = `<span style="white-space: pre;">	</span>`;
    document.execCommand('insertHTML', false, Tab);
}

const inputField = document.getElementById('editor');

// Function to be called when the Tab key is pressed
function onTabKeyPressed(event) {
    if (event.key === "Tab") {
        event.preventDefault(); // Prevent the default tab behavior (focus change)
        InsertTab();
        // You can add any other functionality you want here
    }
}


        // Listen for the 'keydown' event (fires when a key is pressed down)
        inputField.addEventListener('keydown', onTabKeyPressed);


        
