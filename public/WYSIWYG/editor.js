// Utility function to get query parameters
function getQueryParameter(name) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(name);
}

// Get the activeNode from the URL parameters
const activeNode = getQueryParameter('activeNode');
console.log('ActiveNode:', activeNode);

// Construct the file path based on the activeNode
let filePath = '';
if (activeNode) {
    filePath = `Notebook/${activeNode}`;
} else {
    console.error('No activeNode provided');
    document.getElementById('errorMessage').textContent = 'Error: No activeNode provided.';
}

// Function to load file contents
function loadFileContents() {
    if (!filePath) return;
    
    fetch(`/api/file?path=${encodeURIComponent(filePath)}`)
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

function formatHtml(html) {
    let indentLevel = 0;
    const formatted = html
        .replace(/></g, '>\n<')  // Add line break between tags
        .split('\n')  // Split into lines
        .map(line => {
            line = line.trim();  // Trim whitespace from each line
            
            // Decrease indent level for closing tags
            if (line.startsWith('</')) {
                indentLevel = Math.max(indentLevel - 1, 0);
            }

            // Apply tabs for indentation
            const indentedLine = '\t'.repeat(indentLevel) + line;

            // Increase indent level for opening tags (except self-closing tags)
            if (line.startsWith('<') && !line.startsWith('</') && !line.endsWith('/>')) {
                indentLevel++;
            }

            return indentedLine;
        })
        .filter(line => line !== '')  // Remove empty lines caused by multiple newlines
        .join('\n');  // Join the lines back together

    return formatted.trim();  // Trim to remove extra space
}

// Function to save file contents with formatted HTML
function saveFileContents() {
    const editor = document.getElementById('editor');
    const rawContent = editor.innerHTML;
    const formattedContent = formatHtml(rawContent);

    fetch('/api/save', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ path: filePath, content: formattedContent })
    })
    .then(response => response.text())
    .then(data => {
        const saveMessage = document.getElementById('message');
        saveMessage.textContent = 'File saved successfully!';
        setTimeout(() => saveMessage.textContent = '', 3000);  // Clear after 3 seconds
    })
    .catch(error => {
        console.error('Error saving file content:', error);
        document.getElementById('errorMessage').textContent = 'Error saving file content: ' + error.message;
    });
}

// Utility function to calculate relative paths between two locations
function getRelativePath(from, to) {
    const fromParts = from.split('/');
    const toParts = to.split('/');
    let commonLength = 0;

    // Find the common part
    while (commonLength < fromParts.length && commonLength < toParts.length && fromParts[commonLength] === toParts[commonLength]) {
        commonLength++;
    }

    const upLevels = fromParts.length - commonLength - 1;
    const downLevels = toParts.slice(commonLength);

    const relativePath = '../'.repeat(upLevels) + downLevels.join('/');
    return relativePath;
}

// Function to trigger the hidden file input
function triggerFileInput() {
    document.getElementById('fileUpload').click();  // Programmatically click the file input
}

// Function to handle image file selection and insertion with relative URL
document.getElementById('fileUpload').addEventListener('change', function(event) {
    const file = event.target.files[0];
    if (file) {
        // Assume we can get the full file path of the image file and the HTML file being edited
        const htmlFilePath = filePath;  // Path of the currently active HTML file (e.g., Notebook/activeNode)
        const imagePath = `Notebook/${file.name}`;  // Construct the image path based on the file's name

        // Get the relative path from the HTML file to the image file
        const relativeImagePath = getRelativePath(htmlFilePath, imagePath);
        console.log('Relative Image Path:', relativeImagePath);

        // Create the img tag with the correct relative path
        const imgTag = `<img src="${relativeImagePath}" alt="${file.name}" width="500" height="333">`;

        // Insert the image tag into the editor's content
        insertHtmlIntoEditor(imgTag);
    }
});

// Function to insert HTML into the editor
function insertHtmlIntoEditor(html) {
    const editor = document.getElementById('editor');
    editor.focus();  // Ensure the editor is focused

    if (window.getSelection) {
        const sel = window.getSelection();
        if (sel.getRangeAt && sel.rangeCount) {
            const range = sel.getRangeAt(0);
            range.deleteContents();

            // Create a DocumentFragment to insert the HTML content
            const frag = document.createDocumentFragment();
            const div = document.createElement('div');
            div.innerHTML = html;
            let node;
            let lastNode;
            while ((node = div.firstChild)) {
                lastNode = frag.appendChild(node);
            }

            range.insertNode(frag);

            // Set the cursor after the inserted content
            if (lastNode) {
                const newRange = document.createRange();
                newRange.setStartAfter(lastNode);
                newRange.collapse(true);
                sel.removeAllRanges();
                sel.addRange(newRange);
            }
        }
    }
}

// Load the file contents when the page is loaded
window.onload = function() {
    loadFileContents();
};
