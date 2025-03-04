// SwitchToWYSIWYGediting.js



(function () {
    // First, attempt to retrieve the activeNode from the global variable,
    // then fall back to the URL parameters.
    let activeNode = window.ActiveNode;
    if (!activeNode) {
        const urlParams = new URLSearchParams(window.location.search);
        activeNode = urlParams.get('activeNode');
    }

    if (!activeNode) {
        console.error("No activeNode specified.");
        return;
    }

    // Construct the file path based on the activeNode
let filePath = '';
if (activeNode) {
    filePath = `Notebook/${activeNode}`;
} else {
    console.error('No activeNode provided');
    document.getElementById('errorMessage').textContent = 'Error: No activeNode provided.';
}




    // Define the right-plane container where the editor will be inserted.
    const rightPlane = document.getElementById('content-frame-container');
    if (!rightPlane) {
        console.error("Target container (id 'content-frame-container') not found.");
        return;
    }

    // Define the editor HTML structure.
    const editorHTML = `
        <div id="ScrollableElementStyles">
            <div id="editor" contenteditable="true"></div>
            <button id="saveButton">Save</button>
            <p id="message"></p>
            <p id="errorMessage" style="color: red;"></p>
        </div>
    `;
    // Inject the editor HTML into the right plane.
    rightPlane.innerHTML = editorHTML;

    // Function to load the file contents into the editor.
// Function to load file contents
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

    // Function to format HTML before saving.
    function formatHtml(html) {
        let indentLevel = 0;
        return html
            .replace(/></g, '>\n<')
            .split('\n')
            .map(line => {
                line = line.trim();
                if (line.startsWith('</')) indentLevel = Math.max(indentLevel - 2, 0);
                const indentedLine = '\t'.repeat(indentLevel) + line;
                if (line.startsWith('<') && !line.startsWith('</') && !line.endsWith('/>')) indentLevel++;
                return indentedLine;
            })
            .filter(line => line !== '')
            .join('\n');
    }

    // Function to save the file contents.
    function saveFileContents(filePath) {
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
    }

    // Load file contents when switching to WYSIWYG mode.
    loadFileContents(activeNode);

    // Attach save button event listener.
    document.getElementById('saveButton').addEventListener('click', () => {
        console.log("saving: "+ filePath);
        saveFileContents(filePath);
    });

    console.log("WYSIWYG editing mode activated for:", filePath);
})();
