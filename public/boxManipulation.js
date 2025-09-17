// public/boxManipulation.js
// Purpose: TODO: Add description of module purpose

// Dependencies available via window after respective files load  
// window.makeResizableAndDraggable from resizeAndDrag.js

// Function to create a new box and add it to the DOM
function createBox(box) {
    const boxContainer = document.createElement('div');
    boxContainer.className = 'box';
    boxContainer.innerHTML = `
        <div class="drag-bar"></div>
        <div class="box-content">
            <div class="fullscreen-button">
                <button class="fullscreen-btn">Full Screen</button>
            </div>
            <div class="close-button">
                <button class="close-btn">Close</button>
            </div>
            <h2>${box.heading}</h2>
            <p>${box.content}</p>
            <button class="run-script-btn">Run Script</button>
        </div>
        <div class="resize-handle"></div>
    `;
    document.body.appendChild(boxContainer);
    window.makeResizableAndDraggable(boxContainer);

    // Add event listeners to buttons
    boxContainer.querySelector('.fullscreen-btn').addEventListener('click', () => toggleFullscreen(boxContainer));
    boxContainer.querySelector('.close-btn').addEventListener('click', () => closeBox(boxContainer));
    boxContainer.querySelector('.run-script-btn').addEventListener('click', () => runScript(box.script));
}

// Function to bring a box to the front
function bringToFront(element) {
    const boxes = document.querySelectorAll('.box');
    boxes.forEach(box => box.style.zIndex = '1');
    element.style.zIndex = '2';
}

// Function to toggle fullscreen mode for a box
function toggleFullscreen(box) {
    box.classList.toggle('fullscreen');
    if (box.classList.contains('fullscreen')) {
        box.style.width = '100%';
        box.style.height = '100%';
        box.style.top = '0';
        box.style.left = '0';
        box.querySelector('.fullscreen-btn').textContent = 'Exit Full Screen';
    } else {
        box.style.width = '300px';
        box.style.height = '200px';
        box.style.top = '';
        box.style.left = '';
        box.querySelector('.fullscreen-btn').textContent = 'Full Screen';
    }
    bringToFront(box);
}

// Function to close a box
function closeBox(box) {
    box.remove();
}

// Function to run a script associated with the box
function runScript(scriptName) {
    try {
        // Check if the script is already loaded
        if (document.querySelector(`script[src="${scriptName}"]`)) {
            console.warn(`Script ${scriptName} is already loaded.`);

            // Re-execute the associated function if the script is already loaded
            if (scriptName === 'NewNotebookPageInitializer.js' && window.initializeNewNotebookPage) {
                console.log('Re-running initializeNewNotebookPage function.');
                window.initializeNewNotebookPage(); // Call the function again
            }
            return;
        }

        // Otherwise, load the script for the first time
        const script = document.createElement('script');
        script.src = scriptName;

        // Add a listener to run the initialization function once the script is loaded
        script.onload = () => {
            if (scriptName === 'NewNotebookPageInitializer.js' && window.initializeNewNotebookPage) {
                console.log('Running initializeNewNotebookPage for the first time.');
                window.initializeNewNotebookPage(); // Call the function once the script is loaded
            }
        };

        document.body.appendChild(script);

    } catch (error) {
        console.error(`Error running script ${scriptName}:`, error);
    }
}

// Export functions globally
window.createBox = createBox;
window.bringToFront = bringToFront;
window.toggleFullscreen = toggleFullscreen;
window.closeBox = closeBox;
window.runScript = runScript;
