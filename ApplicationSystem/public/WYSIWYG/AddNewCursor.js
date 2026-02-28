// public/WYSIWYG/AddNewCursor.js
// Purpose: TODO: Add description of module purpose


// Keep track of multiple cursor positions
let cursors = [];
const editor = document.getElementById('editor');

// Listen for the mouse click event to add a cursor
editor.addEventListener('click', (event) => {
    if (event.altKey) {  // Check if Alt is held
        const cursorPosition = getCaretPosition(event);
        addCursor(cursorPosition);
    }
});

// Function to get the caret position based on the mouse click
function getCaretPosition(event) {
    const rect = editor.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;
    return { x: mouseX, y: mouseY };
}

// Add a cursor to the editor
function addCursor(position) {
    const cursorId = `cursor-${cursors.length}`;
    const cursor = document.createElement('div');
    cursor.classList.add('multi-cursor');
    cursor.style.position = 'absolute';
    cursor.style.left = `${position.x}px`;
    cursor.style.top = `${position.y}px`;
    cursor.id = cursorId;

    editor.appendChild(cursor);
    cursors.push({ id: cursorId, position });
}

// Function to remove a cursor
function removeCursor(cursorId) {
    const cursor = document.getElementById(cursorId);
    if (cursor) {
        cursor.remove();
    }
    cursors = cursors.filter(cursor => cursor.id !== cursorId);
}

// Listen for key combinations (Alt + Click) to add cursors
editor.addEventListener('keydown', (event) => {
    if (event.key === "Alt") {
        // Placeholder for handling key-based multi-cursor addition
        // This could be expanded to work with combinations like Alt + Arrow keys for navigation
    }
});

// Render multiple cursors based on stored positions
function updateCursors() {
    cursors.forEach(cursor => {
        const cursorElement = document.getElementById(cursor.id);
        if (cursorElement) {
            // Reposition the cursor if needed (this example does not implement dynamic repositioning)
        }
    });
}

// Styling the cursors
const style = document.createElement('style');
style.textContent = `
    .multi-cursor {
        width: 2px;
        height: 20px;
        background-color: red;
        pointer-events: none;
        z-index: 10;
    }
`;
document.head.appendChild(style);

