// Import dependencies
import { boxes } from './DefineToolbarElements.js';
import { createBox } from './boxManipulation.js';

/**
 * Displays a sub-toolbar underneath the main toolbar with Insert options.
 */
function showInsertSubToolbar() {
    // Check if a sub-toolbar already exists.
    let subToolbar = document.getElementById('sub-toolbar');
    if (!subToolbar) {
        subToolbar = document.createElement('div');
        subToolbar.id = 'sub-toolbar';
        subToolbar.className = 'sub-toolbar';
        // Insert the sub-toolbar after the main toolbar container.
        const toolbarContainer = document.querySelector('.toolbar');
        toolbarContainer.parentNode.insertBefore(subToolbar, toolbarContainer.nextSibling);
    }
    // Toggle visibility: if already visible, hide it.
    if (subToolbar.style.display === 'block') {
        subToolbar.style.display = 'none';
        return;
    }
    subToolbar.style.display = 'block';

    // For this example, we simply insert a button for "Insert Text".
    subToolbar.innerHTML = `
        <button id="insert-text-btn">Insert Text</button>
        <!-- Additional insert options could be added here -->
    `;

    // Attach event listener for "Insert Text".
    document.getElementById('insert-text-btn').addEventListener('click', () => {
        console.log("Insert Text clicked");
        // Insert your logic to add text at the desired location.
        // For example, you might open a prompt or insert HTML into an editor.
    });
}

/**
 * Creates a toolbar in the specified container.
 * @param {string} toolbarSelector - The CSS selector for the toolbar container.
 * @param {function} [onToggleView] - Optional callback function for handling toggle view changes.
 */
export function createToolbar(toolbarSelector = '.toolbar', onToggleView = () => {}) {
    const toolbarContainer = document.querySelector(toolbarSelector);
    if (!toolbarContainer) {
        console.error(`Container not found for selector: ${toolbarSelector}`);
        return;
    }

    // Retrieve current mode from centralized state.
    const currentMode = window.AppState ? window.AppState.getMode() : window.currentMode;

    // Separate direct items from grouped items.
    const directItems = [];
    const groupedItems = {};

    boxes.forEach(box => {
        // Skip if the box defines modes and current mode is not included.
        if (box.modes && !box.modes.includes(currentMode)) {
            return;
        }
        // If the box is marked for direct rendering, store it in directItems.
        if (box.direct) {
            directItems.push(box);
        } else {
            const category = box.ToolbarCategory || 'Misc';
            if (!groupedItems[category]) {
                groupedItems[category] = [];
            }
            groupedItems[category].push(box);
        }
    });

    // Clear existing toolbar content.
    toolbarContainer.innerHTML = '';

    // Define the desired order for grouped categories.
    const groupOrder = ['File', 'Edit', 'Insert', 'Settings', 'View', 'User'];

    // Render grouped items in the specified order.
    groupOrder.forEach(category => {
        if (groupedItems[category]) {
            const dropdown = document.createElement('div');
            dropdown.className = 'dropdown';
            dropdown.setAttribute('data-category', category);

            const button = document.createElement('button');
            button.className = 'dropbtn';
            button.textContent = category;
            dropdown.appendChild(button);

            const dropdownContent = document.createElement('div');
            dropdownContent.className = 'dropdown-content';

            groupedItems[category].forEach(box => {
                const link = document.createElement('a');
                link.href = '#';
                link.textContent = box.heading;

                // For the "Insert" category, override the click event.
                if (category === 'Insert') {
                    link.addEventListener('click', (e) => {
                        e.preventDefault();
                        // For now, simply show the sub-toolbar with Insert options.
                        showInsertSubToolbar();
                    });
                } else if (box.customAction) {
                    link.addEventListener('click', (e) => {
                        e.preventDefault();
                        box.customAction();
                    });
                } else if (box.callback) {
                    link.addEventListener('click', (e) => {
                        e.preventDefault();
                        box.callback();
                    });
                } else if (box.script) {
                    link.addEventListener('click', (e) => {
                        e.preventDefault();
                        createBox(box);
                    });
                } else {
                    link.addEventListener('click', (e) => {
                        e.preventDefault();
                        createBox(box);
                    });
                }
                dropdownContent.appendChild(link);
            });

            dropdown.appendChild(dropdownContent);
            toolbarContainer.appendChild(dropdown);

            // After rendering the "View" category, insert any direct items with category "Search"
            if (category === 'View') {
                directItems
                    .filter(box => (box.ToolbarCategory === 'Search'))
                    .forEach(box => {
                        const directElement = document.createElement('div');
                        directElement.className = 'toolbar-direct-item';
                        directElement.innerHTML = box.content;
                        toolbarContainer.appendChild(directElement);
                        if (box.script) {
                            const scriptEl = document.createElement('script');
                            scriptEl.src = box.script;
                            toolbarContainer.appendChild(scriptEl);
                        }
                    });
            }
        }
    });

    // If any direct items remain that weren't rendered (for categories other than "Search"), append them.
    directItems
        .filter(box => box.ToolbarCategory !== 'Search')
        .forEach(box => {
            const directElement = document.createElement('div');
            directElement.className = 'toolbar-direct-item';
            directElement.innerHTML = box.content;
            toolbarContainer.appendChild(directElement);
            if (box.script) {
                const scriptEl = document.createElement('script');
                scriptEl.src = box.script;
                toolbarContainer.appendChild(scriptEl);
            }
        });
}

// Subscribe to mode changes so the toolbar re-renders automatically.
if (window.AppState && typeof window.AppState.subscribe === 'function') {
    window.AppState.subscribe(() => {
        createToolbar();
    });
}

/**
 * Fetches and displays the file view in the specified container.
 * @param {string} fileViewSelector - The CSS selector for the file view container.
 */
export async function loadFileView(fileViewSelector) {
    const fileViewContainer = document.querySelector(fileViewSelector);
    if (!fileViewContainer) {
        console.error(`File view container not found for selector: ${fileViewSelector}`);
        return;
    }

    fileViewContainer.innerHTML = '<p>Loading files...</p>';

    try {
        const response = await fetch('/api/files');
        const directoryStructure = await response.json();
        console.log('Directory Structure:', directoryStructure);  // Debug log
        fileViewContainer.innerHTML = renderDirectoryStructure(directoryStructure, true);
    } catch (error) {
        fileViewContainer.innerHTML = '<p>Error loading files</p>';
        console.error('Error fetching file data:', error);
    }
}

/**
 * Renders a directory structure as an HTML list.
 * @param {Array} files - The directory structure to render.
 * @param {boolean} [isRoot=false] - Whether this is the root directory.
 * @returns {string} - The rendered HTML.
 */
function renderDirectoryStructure(files, isRoot = false) {
    const container = document.createElement('ul');
    console.log('Rendering directory structure:', files);  // Debug log

    files.forEach(file => {
        const listItem = document.createElement('li');
        listItem.className = file.isDirectory ? 'directory' : 'file';

        if (file.isDirectory) {
            const directoryButton = document.createElement('button');
            directoryButton.className = 'directory-button';
            directoryButton.textContent = file.name;

            const relativePath = file.path.replace('/Notebook/', '');
            directoryButton.id = relativePath;

            directoryButton.addEventListener('click', toggleDirectory);

            const nestedList = document.createElement('ul');
            nestedList.className = 'nested';
            nestedList.style.display = 'none';
            nestedList.setAttribute('data-path', file.path);

            listItem.appendChild(directoryButton);
            listItem.appendChild(nestedList);
        } else {
            const fileButton = document.createElement('button');
            const relativePath = file.path.replace('/Notebook/', '');
            fileButton.id = relativePath;
            fileButton.className = 'file-button';
            fileButton.textContent = file.name;

            listItem.appendChild(fileButton);
        }

        container.appendChild(listItem);
    });

    return container.outerHTML;
}

/**
 * Toggles the visibility of a directory's nested contents.
 * @param {Event} event - The click event.
 */
async function toggleDirectory(event) {
    const directoryButton = event.target;
    const directoryElement = directoryButton.nextElementSibling;
    const path = directoryElement.getAttribute('data-path');

    if (directoryElement.style.display === 'none') {
        directoryElement.style.display = 'block';

        if (!directoryElement.hasAttribute('data-loaded')) {
            try {
                const response = await fetch(`/api/files?path=${encodeURIComponent(path)}`);
                const subDirectoryStructure = await response.json();
                directoryElement.innerHTML = renderDirectoryStructure(subDirectoryStructure);
                directoryElement.setAttribute('data-loaded', 'true');
            } catch (error) {
                console.error('Error fetching subdirectory data:', error);
            }
        }
    } else {
        directoryElement.style.display = 'none';
    }
}
