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

// Function to convert CSV to HTML table
function csvToEditableTable(csvString) {
    const rows = csvString.split('\n');
    let tableHTML = '<table border="1">';  // Create a table with borders

    rows.forEach(row => {
        const columns = row.split(',');
        tableHTML += '<tr>';  // Start a new row
        columns.forEach(column => {
            // Initially, each cell will be a text input for the user to edit
            tableHTML += `<td><input type="text" value="${column.trim()}" /></td>`;
        });
        tableHTML += '</tr>';  // End the row
    });

    tableHTML += '</table>';
    return tableHTML;
}

// Function to insert the table into the editor
function insertEditableTable() {
    const editor = document.getElementById('editor');
    const csvString = "A,B,C\nD,E,F\nG,H,I";  // Example CSV data for the table
    
    // Generate the HTML for an editable table
    const tableHTML = csvToEditableTable(csvString);
    
    const range = window.getSelection().getRangeAt(0);
    const tableNode = document.createElement('div');
    tableNode.innerHTML = tableHTML;
    range.insertNode(tableNode);

    // Move the cursor after the table
    range.setStartAfter(tableNode);
    range.setEndAfter(tableNode);
    window.getSelection().removeAllRanges();
    window.getSelection().addRange(range);
}

// Add event listener for table insertion
document.getElementById('insertTable').addEventListener('click', insertEditableTable);


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

// Function to handle image file selection and insertion with different relative URLs
document.getElementById('fileUpload').addEventListener('change', function(event) {
    const file = event.target.files[0];
    if (file) {
        // Assume the image is uploaded to a directory accessible from localhost:8000
        const imagePath = `Notebook/${file.name}`;  // Construct the image path based on the file's name
        
        // Get the relative path for the editor and the final webpage
        const editorRelativePath = getRelativePath(filePath, `./${file.name}`);
        const finalWebpageRelativePath = getRelativePath(filePath, imagePath);

        // Construct the URL for the editor (localhost:8000)
        const editorUrl = `http://localhost:8000/${editorRelativePath}`;
        console.log('Editor URL:', editorUrl);
        
        // Create the img tag with the CSS class for styling
        const imgTag = `<img src="${editorUrl}" alt="${file.name}" class="editor-img">`;

        // Insert the image tag into the editor's content
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
                div.innerHTML = imgTag;
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

        // Optionally, you could also save the final webpage relative path for future reference
        console.log('Final Webpage Relative Image Path:', finalWebpageRelativePath);
    }
});function uploadImage(file) {
    const formData = new FormData();
    formData.append('image', file);

    return fetch('/upload-image', {
        method: 'POST',
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            const filePath = data.filePath; // Use the file path returned by the server
            const linkTag = `<a href="${filePath}" target="_blank">View Uploaded Image</a>`;
            //document.getElementById('editor').innerHTML += linkTag;
            console.log('Image uploaded and link inserted successfully:', data.message);
        } else {
            document.getElementById('errorMessage').textContent = `Error uploading image: ${data.message}`;
            console.error('Error uploading image:', data.message);
        }
    })
    .catch(error => {
        document.getElementById('errorMessage').textContent = `Upload failed: ${error}`;
        console.error('Error uploading image:', error);
    });
}



document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('insertMusicSheet').addEventListener('click', function() {
        insertMusicSheet();
    });

    document.getElementById('addNoteButton').addEventListener('click', function() {
        addNoteToMusicSheet();
    });

    document.getElementById('editor').addEventListener('click', function(event) {
        const target = event.target;

        if (target.classList.contains('musicSheet')) {
            showEditToolbar();
            selectMusicSheet(target);
        } else {
            hideEditToolbar();
        }
    });
});




















// Function to insert a music sheet div and initialize its MusicXML structure
function insertMusicSheet() {
    const editor = document.getElementById('editor');
    const musicSheetDiv = document.createElement('div');
    musicSheetDiv.classList.add('musicSheet');
    musicSheetDiv.contentEditable = "false"; // Make it non-editable
    musicSheetDiv.innerHTML = '🎼 Sheet Music';

    // Initialize an empty MusicXML structure for this music sheet
    const musicXML = `
        <score-partwise version="3.1">
            <part id="P1">
                <measure number="1">
                </measure>
            </part>
        </score-partwise>
    `;

    // Store the XML structure inside the div for later manipulation
    musicSheetDiv.dataset.musicXML = musicXML;

    const selection = window.getSelection();
    if (selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        range.deleteContents();
        range.insertNode(musicSheetDiv);
    }
}

// Function to show the Edit Toolbar
function showEditToolbar() {
    document.getElementById('editToolbar').style.display = 'block';
}

// Function to hide the Edit Toolbar
function hideEditToolbar() {
    document.getElementById('editToolbar').style.display = 'none';
}

// Function to select a music sheet div
let selectedMusicSheet = null;
function selectMusicSheet(musicSheetDiv) {
    selectedMusicSheet = musicSheetDiv;
}

// Function to add a note to the selected music sheet
function addNoteToMusicSheet() {
    if (selectedMusicSheet) {
        const noteType = document.getElementById('noteType').value;
        const newNoteXML = getMusicXMLForNoteType(noteType);

        // Update the MusicXML structure for the selected music sheet
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(selectedMusicSheet.dataset.musicXML, 'text/xml');

        const measure = xmlDoc.querySelector('measure');
        const noteElement = parser.parseFromString(newNoteXML, 'text/xml').querySelector('note');
        measure.appendChild(noteElement);

        // Serialize and store the updated MusicXML back to the div
        const serializer = new XMLSerializer();
        selectedMusicSheet.dataset.musicXML = serializer.serializeToString(xmlDoc);

        // Render the note visually (just as text for now)
        const noteVisual = document.createElement('span');
        noteVisual.classList.add('note');
        noteVisual.textContent = getVisualRepresentationForNoteType(noteType);
        selectedMusicSheet.appendChild(noteVisual);
    }
}

// Function to get MusicXML structure for a specific note type
function getMusicXMLForNoteType(noteType) {
    switch (noteType) {
        case 'quarter':
            return `
                <note>
                    <pitch>
                        <step>C</step>
                        <octave>4</octave>
                    </pitch>
                    <duration>1</duration>
                    <type>quarter</type>
                </note>
            `;
        case 'half':
            return `
                <note>
                    <pitch>
                        <step>C</step>
                        <octave>4</octave>
                    </pitch>
                    <duration>2</duration>
                    <type>half</type>
                </note>
            `;
        case 'whole':
            return `
                <note>
                    <pitch>
                        <step>C</step>
                        <octave>4</octave>
                    </pitch>
                    <duration>4</duration>
                    <type>whole</type>
                </note>
            `;
        default:
            return '';
    }
}

// Function to get visual representation for a note
function getVisualRepresentationForNoteType(noteType) {
    switch (noteType) {
        case 'quarter':
            return '♩';
        case 'half':
            return '♪';
        case 'whole':
            return '𝅝';
        default:
            return '';
    }
}








// Event listener to handle the file upload
document.addEventListener('DOMContentLoaded', function () {
    document.getElementById('fileUpload').addEventListener('change', function (event) {
        const file = event.target.files[0]; // Get the selected file
        if (file) {
            uploadImage(file); // Upload and insert the link
        }
    });
});

window.onload = function() {
    loadFileContents();
};


