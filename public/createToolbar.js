// Import dependencies
import { boxes } from './DefineToolbarElements.js';
import { createBox } from './boxManipulation.js';

/**
 * Displays a sub-toolbar underneath the main toolbar with insert options for a given type.
 * The sub-toolbar is built from items in boxes that have:
 *    ToolbarCategory === 'Insert' and insertGroup === insertType.
 * @param {string} insertType - One of "text", "image", "video", "table", "sheet music", "remote"
 */
function showInsertSubToolbar(insertType) {
    // Look for an existing sub-toolbar.
    let subToolbar = document.getElementById('sub-toolbar');
    if (!subToolbar) {
        subToolbar = document.createElement('div');
        subToolbar.id = 'sub-toolbar';
        subToolbar.className = 'sub-toolbar';
        // Insert the sub-toolbar immediately below the main toolbar.
        const toolbarContainer = document.querySelector('.toolbar');
        toolbarContainer.parentNode.insertBefore(subToolbar, toolbarContainer.nextSibling);
    }
    // Clear previous content and show sub-toolbar.
    subToolbar.innerHTML = '';
    subToolbar.style.display = 'block';

    // Filter the insert items for the selected insertType.
    const insertItems = boxes.filter(box =>
        box.ToolbarCategory === 'Insert' &&
        box.insertGroup === insertType &&
        (!box.modes || box.modes.includes(window.AppState ? window.AppState.getMode() : window.currentMode))
    );

    if (insertItems.length === 0) {
        subToolbar.innerHTML = `<p>No options defined for ${insertType}.</p>`;
        return;
    }

    // For each insert item in this group, create a button.
    insertItems.forEach(item => {
        const btn = document.createElement('button');
        btn.className = 'insert-option-btn';
        btn.textContent = item.heading;
        if (item.callback) {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                item.callback();
            });
        } else if (item.script) {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                createBox(item);
            });
        }
        subToolbar.appendChild(btn);
    });
}

/**
 * Creates the main toolbar in the specified container.
 * @param {string} toolbarSelector - The CSS selector for the toolbar container.
 * @param {function} [onToggleView] - Optional callback function.
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
        // Skip if modes are defined and current mode is not included.
        if (box.modes && !box.modes.includes(currentMode)) {
            return;
        }
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

    groupOrder.forEach(category => {
        if (category === 'Insert') {
            // Instead of rendering individual insert items, create a single "Insert" dropdown.
            if (groupedItems['Insert'] && groupedItems['Insert'].length > 0) {
                const dropdown = document.createElement('div');
                dropdown.className = 'dropdown insert-dropdown';
                dropdown.setAttribute('data-category', 'Insert');

                const button = document.createElement('button');
                button.className = 'dropbtn';
                button.textContent = 'Insert';
                dropdown.appendChild(button);

                // Create a dropdown content that shows options for insert types.
                const dropdownContent = document.createElement('div');
                dropdownContent.className = 'dropdown-content';

                // Define the insert type options.
                const insertTypes = ['text', 'image', 'video', 'table', 'sheet music'];
                insertTypes.forEach(type => {
                    const option = document.createElement('a');
                    option.href = '#';
                    // Capitalize first letter for display.
                    option.textContent = type.charAt(0).toUpperCase() + type.slice(1);
                    // On click, show the sub-toolbar for that insert type.
                    option.addEventListener('click', (e) => {
                        e.preventDefault();
                        showInsertSubToolbar(type);
                    });
                    dropdownContent.appendChild(option);
                });
                dropdown.appendChild(dropdownContent);
                toolbarContainer.appendChild(dropdown);
            }
        } else if (groupedItems[category]) {
            // Render other categories as dropdowns.
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
                if (box.customAction) {
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

            // After rendering the "View" category, insert direct items with category "Search".
            if (category === 'View') {
                directItems
                    .filter(box => box.ToolbarCategory === 'Search')
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

    // Append any remaining direct items (excluding those with category "Search").
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
