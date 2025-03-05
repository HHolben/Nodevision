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
        .filter(line => line !== '')  // Remove empty lines caused by multiple newlines
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
    
    // Now add the "Save changes" button to the dropdown.
    const dropdownContent = fileDropdown.querySelector('.dropdown-content');
    
    // Check if the Save changes item already exists (to avoid duplicates).
    if (!dropdownContent.querySelector('a[data-action="save-changes"]')) {
        const saveLink = document.createElement('a');
        saveLink.href = '#';
        saveLink.textContent = 'Save changes';
        saveLink.setAttribute('data-action', 'save-changes');
        saveLink.addEventListener('click', (e) => {
            e.preventDefault();
            // Call the exposed save function.
            window.saveWYSIWYGFile(filePath);
        });
        dropdownContent.appendChild(saveLink);
    }
}



(function () {
    // Determine active node and filePath as before.
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
    if (!filePath) {
        console.error('No activeNode provided');
        document.getElementById('errorMessage').textContent = 'Error: No activeNode provided.';
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

    // Function to load file contents remains unchanged.
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

    // Expose or define formatHtml as needed (omitted here for brevity).

    // Load the file contents.
    loadFileContents();

    // Update the toolbar with the "Save changes" button for WYSIWYG editing.
    updateWYSIWYGToolbar(filePath);

    console.log("WYSIWYG editing mode activated for:", filePath);
})();
