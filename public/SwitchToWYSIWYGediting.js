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
                const editor = document.getElementById('editor');
                editor.innerHTML = data.content;
                console.log('File content loaded:', data.content);
                // Reattach the image selection event listener after content is loaded.
                editor.addEventListener('click', handleImageClick);
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

function InsertTab() {
    const Tab = `<span style="white-space: pre;">	</span>`;
    document.execCommand('insertHTML', false, Tab);
}

const inputField = document.getElementById('editor');

// Function to be called when the Tab key is pressed.
function onTabKeyPressed(event) {
    if (event.key === "Tab") {
        event.preventDefault(); // Prevent the default tab behavior (focus change)
        InsertTab();
    }
}

inputField.addEventListener('keydown', onTabKeyPressed);

// ----- IMAGE SELECTION & EDIT RASTER SECTION -----

// Global variable to hold the selected image.
let selectedImage = null;

// Modify your handleImageClick so that for images, we enable HTML5 dragging:
function handleImageClick(event) {
    let img = (event.target.tagName.toLowerCase() === 'img') ? event.target : null;
    if (!img) {
        img = event.target.closest('svg');
    }
    if (img) {
        if (selectedImage) {
            selectedImage.classList.remove('selected');
        }
        selectedImage = img;
        selectedImage.classList.add('selected');

        // Set draggable attribute if not already set.
        if (!img.getAttribute('draggable')) {
            img.setAttribute('draggable', 'true');
        }
    }
}

// Global variable to store the dragged image.
let draggedImage = null;

function handleImageClick(event) {
    let img = (event.target.tagName.toLowerCase() === 'img') ? event.target : null;
    if (!img) {
        img = event.target.closest('svg');
    }
    if (img) {
        if (selectedImage) {
            selectedImage.classList.remove('selected');
        }
        selectedImage = img;
        selectedImage.classList.add('selected');
        // Ensure the image is draggable.
        if (!img.getAttribute('draggable')) {
            img.setAttribute('draggable', 'true');
        }
    }
}

function onImageDragStart(event) {
    console.log("Drag started", event.target);
    // Store the dragged element.
    draggedImage = event.target;
    // Force a move operation.
    event.dataTransfer.effectAllowed = 'move';
    // Set both text/html and text/plain to ensure compatibility.
    event.dataTransfer.setData("text/html", event.target.outerHTML);
    event.dataTransfer.setData("text/plain", event.target.outerHTML);
    // Prevent default behavior.
    event.stopPropagation();
    // Add visual cue.
    event.target.classList.add('dragging');
}

document.addEventListener('dragstart', function(event) {
    const target = event.target;
    if (target.tagName.toLowerCase() === 'img' || target.tagName.toLowerCase() === 'svg') {
        onImageDragStart(event);
    }
});

const editorElement = document.getElementById('editor');

editorElement.addEventListener('dragover', function(event) {
    event.preventDefault();
    // Force move as drop effect.
    event.dataTransfer.dropEffect = 'move';
});

editorElement.addEventListener('drop', function(event) {
    event.preventDefault();
    event.stopPropagation();
    console.log("Drop event fired on editor");
    
    // Retrieve the dragged HTML.
    const imageHTML = event.dataTransfer.getData("text/html");
    if (!imageHTML) return;
    
    // Create a temporary container to parse the HTML.
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = imageHTML;
    const imageNode = tempDiv.firstChild;
    
    // Use the Selection and Range API to insert the image inline.
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) {
        editorElement.appendChild(imageNode);
    } else {
        const range = sel.getRangeAt(0);
        range.insertNode(imageNode);
        // Move caret after the inserted node.
        range.setStartAfter(imageNode);
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
    }
    
    // Remove the original dragged image if it still exists.
    if (draggedImage && draggedImage.parentNode) {
        draggedImage.parentNode.removeChild(draggedImage);
        draggedImage = null;
    }
});

document.addEventListener('dragend', function(event) {
    // Remove the dragging class.
    if (event.target.classList.contains('dragging')) {
        event.target.classList.remove('dragging');
    }
    // In case the drop handler didn't run (or didn't remove the element), remove it here if dropEffect is move.
    if (event.dataTransfer.dropEffect === 'move' && draggedImage && draggedImage.parentNode) {
        draggedImage.parentNode.removeChild(draggedImage);
    }
    draggedImage = null;
});



// Function to add the "Edit RASTER" toolbar item to the Edit category.
function addEditRasterToolbarItem() {
    const toolbarContainer = document.querySelector('.toolbar');
    // Avoid duplicating the button.
    if (document.getElementById('edit-raster-btn')) return;
    
    // Create a button for "Edit RASTER".
    const btn = document.createElement('button');
    btn.id = 'edit-raster-btn';
    btn.textContent = 'Edit RASTER';
    btn.addEventListener('click', (e) => {
        e.preventDefault();
        showEditRasterSubToolbar();
    });
    
    // Append the button to the Edit dropdown if it exists.
    const editDropdownContent = document.querySelector('.dropdown[data-category="Edit"] .dropdown-content');
    if (editDropdownContent) {
        editDropdownContent.appendChild(btn);
    } else {
        // If there's no Edit dropdown, append directly to the toolbar.
        toolbarContainer.appendChild(btn);
    }
}

// Function to show the sub-toolbar for editing raster images.
function showEditRasterSubToolbar() {
    let subToolbar = document.getElementById('edit-raster-sub-toolbar');
    if (!subToolbar) {
        subToolbar = document.createElement('div');
        subToolbar.id = 'edit-raster-sub-toolbar';
        subToolbar.className = 'sub-toolbar';
        // Insert the sub-toolbar after the main toolbar.
        const toolbarContainer = document.querySelector('.toolbar');
        toolbarContainer.parentNode.insertBefore(subToolbar, toolbarContainer.nextSibling);
    }
    // Toggle visibility.
    if (subToolbar.style.display === 'block') {
        subToolbar.style.display = 'none';
        return;
    }
    subToolbar.style.display = 'block';
    // Clear any previous content.
    subToolbar.innerHTML = '';
    
    // Create the "Scale" option.
    const scaleBtn = document.createElement('button');
    scaleBtn.textContent = 'Scale';
    scaleBtn.addEventListener('click', (e) => {
        e.preventDefault();
        const scale = prompt("Enter scale factor (e.g. 1.5 for 150%)", "1");
        if (scale && selectedImage && selectedImage.tagName.toLowerCase() === 'img') {
            // Apply scaling via CSS transform.
            selectedImage.style.transform = `scale(${scale})`;
        }
    });
    
    subToolbar.appendChild(scaleBtn);
}

// Function to enable dragging of the selected image.
function enableDragging() {
    let offsetX = 0, offsetY = 0;
    function dragImage(e) {
        if (selectedImage) {
            selectedImage.style.position = "absolute";
            selectedImage.style.left = (e.clientX - offsetX) + "px";
            selectedImage.style.top = (e.clientY - offsetY) + "px";
        }
    }
    document.addEventListener("mousedown", function(e) {
        if (selectedImage && (e.target === selectedImage || selectedImage.contains(e.target))) {
            const rect = selectedImage.getBoundingClientRect();
            offsetX = e.clientX - rect.left;
            offsetY = e.clientY - rect.top;
            document.addEventListener("mousemove", dragImage);
        }
    });
    document.addEventListener("mouseup", function(e) {
        document.removeEventListener("mousemove", dragImage);
    });
}

// Function to copy the selected image to the clipboard.
async function copyImageToClipboard(img) {
    try {
        if (img.tagName.toLowerCase() === 'img' && img.src) {
            const imgBlob = await fetch(img.src).then(res => res.blob());
            const clipboardItem = new ClipboardItem({ 'image/png': imgBlob });
            await navigator.clipboard.write([clipboardItem]);
            console.log("Image copied to clipboard.");
        } else if (img.tagName.toLowerCase() === 'svg') {
            const serializer = new XMLSerializer();
            const svgString = serializer.serializeToString(img);
            const blob = new Blob([svgString], { type: 'image/svg+xml' });
            const clipboardItem = new ClipboardItem({ 'image/svg+xml': blob });
            await navigator.clipboard.write([clipboardItem]);
            console.log("SVG copied to clipboard.");
        }
    } catch (error) {
        console.error("Failed to copy image to clipboard:", error);
    }
}

// Function to handle keyboard events for copy and cut.
function handleKeyboardEvents(event) {
    if (!selectedImage) return;
    if ((event.ctrlKey || event.metaKey) && (event.key === 'c' || event.key === 'x')) {
        event.preventDefault();
        if (event.key === 'x') {
            document.execCommand('delete');
        }
        copyImageToClipboard(selectedImage);
        selectedImage.classList.remove('selected');
        selectedImage = null;
    }
}

// Attach keyboard event listener.
document.addEventListener('keydown', handleKeyboardEvents);
document.addEventListener('copy', (event) => {
    if (selectedImage) event.preventDefault();
});
document.addEventListener('cut', (event) => {
    if (selectedImage) event.preventDefault();
});

// Initialize image selection, dragging, and keyboard handling.
function initImageHandling() {
    const editorElement = document.getElementById('editor');

    editorElement.addEventListener('dragover', function(event) {
        // Allow drop by preventing default.
        event.preventDefault();
        // Optionally, set a drop effect.
        event.dataTransfer.dropEffect = 'move';
    });
    
    editorElement.addEventListener('drop', function(event) {
        event.preventDefault();
        // Debug log to ensure drop fires
        console.log("Drop event fired on editor");
        
        const imageHTML = event.dataTransfer.getData("text/html");
        if (!imageHTML) return;
        
        // Create a temporary container to parse the HTML.
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = imageHTML;
        const imageNode = tempDiv.firstChild;
        
        // Use the Selection and Range API to insert the image inline.
        const sel = window.getSelection();
        if (!sel || sel.rangeCount === 0) {
            // Fallback: append at the end.
            editorElement.appendChild(imageNode);
        } else {
            const range = sel.getRangeAt(0);
            // Insert node at the caret.
            range.insertNode(imageNode);
            // Move caret after the inserted node.
            range.setStartAfter(imageNode);
            range.collapse(true);
            sel.removeAllRanges();
            sel.addRange(range);
        }
        
        // Clear the selected image variable.
        selectedImage = null;
    });
    
    
}

function showEditRasterSubToolbar() {
    // Look for an existing sub-toolbar. If one exists, toggle its display.
    let subToolbar = document.getElementById('edit-raster-sub-toolbar');
    if (!subToolbar) {
        subToolbar = document.createElement('div');
        subToolbar.id = 'edit-raster-sub-toolbar';
        subToolbar.className = 'sub-toolbar';
        // Insert the sub-toolbar immediately below the main toolbar.
        const toolbarContainer = document.querySelector('.toolbar');
        toolbarContainer.parentNode.insertBefore(subToolbar, toolbarContainer.nextSibling);
    }
    // Toggle display: if already visible, hide it.
    if (subToolbar.style.display === 'block') {
        subToolbar.style.display = 'none';
        return;
    }
    subToolbar.style.display = 'block';
    subToolbar.innerHTML = ''; // Clear previous items

    // Create a Scale button
    const scaleBtn = document.createElement('button');
    scaleBtn.textContent = 'Scale';
    scaleBtn.addEventListener('click', (e) => {
        e.preventDefault();
        const scale = prompt("Enter scale factor (e.g. 1.5 for 150%)", "1");
        if (scale && selectedImage && selectedImage.tagName.toLowerCase() === 'img') {
            // Apply scaling via CSS transform.
            selectedImage.style.transform = `scale(${scale})`;
        }
    });
    subToolbar.appendChild(scaleBtn);

    // Create a Crop button (basic example)
    const cropBtn = document.createElement('button');
    cropBtn.textContent = 'Crop';
    cropBtn.addEventListener('click', (e) => {
        e.preventDefault();
        cropImage();
    });
    
    subToolbar.appendChild(cropBtn);

    // Create a Draw button
    const drawBtn = document.createElement('button');
    drawBtn.textContent = 'Draw';
    drawBtn.addEventListener('click', (e) => {
        e.preventDefault();
        // For drawing, you could initialize a simple canvas overlay for freehand drawing.
        alert("Draw functionality is not implemented yet.");
    });
    subToolbar.appendChild(drawBtn);
}

function cropImage() {
    if (!selectedImage || selectedImage.tagName.toLowerCase() !== 'img') {
        alert("No raster image selected for cropping.");
        return;
    }

    // Create a modal overlay for cropping
    const modal = document.createElement('div');
    modal.id = 'crop-modal';
    Object.assign(modal.style, {
        position: 'fixed',
        top: '0',
        left: '0',
        width: '100%',
        height: '100%',
        backgroundColor: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: '1000'
    });

    // Modal content container
    const modalContent = document.createElement('div');
    Object.assign(modalContent.style, {
        backgroundColor: 'white',
        padding: '10px',
        position: 'relative'
    });

    // Create a canvas to display the image
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    img.src = selectedImage.src;
    img.onload = function() {
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
    };

    // Variables for crop selection
    let cropping = false;
    let startX, startY, endX, endY;

    canvas.style.cursor = 'crosshair';

    // Mouse down: begin selection
    canvas.addEventListener('mousedown', function(e) {
        cropping = true;
        const rect = canvas.getBoundingClientRect();
        startX = e.clientX - rect.left;
        startY = e.clientY - rect.top;
        endX = startX;
        endY = startY;
    });

    // Mouse move: update selection rectangle
    canvas.addEventListener('mousemove', function(e) {
        if (!cropping) return;
        const rect = canvas.getBoundingClientRect();
        endX = e.clientX - rect.left;
        endY = e.clientY - rect.top;
        // Redraw image and draw selection rectangle
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        ctx.strokeStyle = 'red';
        ctx.lineWidth = 2;
        const x = Math.min(startX, endX);
        const y = Math.min(startY, endY);
        const w = Math.abs(endX - startX);
        const h = Math.abs(endY - startY);
        ctx.strokeRect(x, y, w, h);
    });

    // Mouse up: finalize selection
    canvas.addEventListener('mouseup', function(e) {
        cropping = false;
    });

    // Crop confirmation button
    const cropBtn = document.createElement('button');
    cropBtn.textContent = 'Crop';
    cropBtn.addEventListener('click', function() {
        // Calculate selection rectangle
        const x = Math.min(startX, endX);
        const y = Math.min(startY, endY);
        const w = Math.abs(endX - startX);
        const h = Math.abs(endY - startY);
        if (w === 0 || h === 0) {
            alert("Please select a crop area.");
            return;
        }
        // Create a new canvas to store cropped image
        const croppedCanvas = document.createElement('canvas');
        const croppedCtx = croppedCanvas.getContext('2d');
        croppedCanvas.width = w;
        croppedCanvas.height = h;
        croppedCtx.drawImage(canvas, x, y, w, h, 0, 0, w, h);
        // Update the selected image with the cropped data
        selectedImage.src = croppedCanvas.toDataURL();
        // Remove the modal
        document.body.removeChild(modal);
    });

    // Cancel button to close the modal without cropping
    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel';
    cancelBtn.style.marginLeft = '10px';
    cancelBtn.addEventListener('click', function() {
        document.body.removeChild(modal);
    });

    // Append elements
    modalContent.appendChild(canvas);
    const btnContainer = document.createElement('div');
    btnContainer.style.marginTop = '10px';
    btnContainer.appendChild(cropBtn);
    btnContainer.appendChild(cancelBtn);
    modalContent.appendChild(btnContainer);
    modal.appendChild(modalContent);
    document.body.appendChild(modal);
}


function loadFileContents() {
    if (!filePath) return;
    
    fetch(`/api/fileCodeContent?path=${encodeURIComponent(filePath)}`)
        .then(response => {
            if (!response.ok) throw new Error('Network response was not ok');
            return response.json();
        })
        .then(data => {
            const editor = document.getElementById('editor');
            editor.innerHTML = data.content;
            console.log('File content loaded:', data.content);
            initImageHandling();
        })
        .catch(error => {
            console.error('Error fetching file content:', error);
            document.getElementById('errorMessage').textContent = 'Error fetching file content: ' + error.message;
        });
}
initImageHandling();
