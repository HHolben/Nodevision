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

// Function to apply a style to the selected text or block
function applyStyle(style) {
    document.execCommand('formatBlock', false, style);
}

// Function to trigger the hidden file input
function triggerFileInput() {
    document.getElementById('fileUpload').click();  // Programmatically click the file input
}

// Function to handle image file upload
document.getElementById('fileUpload').addEventListener('change', function(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const img = document.createElement('img');
            img.src = e.target.result;
            img.alt = file.name;
            img.style.maxWidth = '100%';  // Optionally style the image
            document.getElementById('editor').appendChild(img);  // Insert the image into the editor
        };
        reader.readAsDataURL(file);
    }
});

// Load the file contents when the page is loaded
window.onload = function() {
    loadFileContents();
};
