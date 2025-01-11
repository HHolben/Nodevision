// Import dependencies
import { boxes } from './DefineToolbarElements.js';
import { createBox } from './boxManipulation.js';

/**
 * Creates a toolbar in the specified container.
 * @param {string} containerSelector - The CSS selector for the toolbar container.
 * @param {function} [onToggleView] - Optional callback function for handling toggle view changes.
 */
export function createToolbar(toolbarSelector = '.toolbar') {
    const toolbarContainer = document.querySelector(toolbarSelector);
    if (!toolbarContainer) {
        console.error(`Container not found for selector: ${toolbarSelector}`);
        return;
    }

    const categories = {};

    boxes.forEach(box => {
        if (!categories[box.ToolbarCategory]) {
            categories[box.ToolbarCategory] = [];
        }
        categories[box.ToolbarCategory].push(box);
    });

    for (const category in categories) {
        const dropdown = document.createElement('div');
        dropdown.className = 'dropdown';

        const button = document.createElement('button');
        button.className = 'dropbtn';
        button.textContent = category;
        dropdown.appendChild(button);

        const dropdownContent = document.createElement('div');
        dropdownContent.className = 'dropdown-content';

        categories[category].forEach(box => {
            if (box.type === 'toggle') {
                const toggleLabel = document.createElement('label');
                toggleLabel.textContent = 'Graph / File View';

                const toggleSwitch = document.createElement('input');
                toggleSwitch.type = 'checkbox';
                toggleSwitch.addEventListener('change', () => {
                    const cyContainer = document.getElementById('cy');
                    const fileViewContainer = document.getElementById('file-view');

                    if (toggleSwitch.checked) {
                        cyContainer.style.display = 'block';
                        fileViewContainer.style.display = 'none';
                        console.log('Switched to GraphViewMode');
                    } else {
                        cyContainer.style.display = 'none';
                        fileViewContainer.style.display = 'block';
                        console.log('Switched to FileViewMode');
                        if (onToggleView) onToggleView();
                    }
                });

                toggleLabel.appendChild(toggleSwitch);
                dropdownContent.appendChild(toggleLabel);
            } else {
                const link = document.createElement('a');
                link.href = '#';
                link.textContent = box.heading;
                link.addEventListener('click', () => createBox(box));
                dropdownContent.appendChild(link);
            }
        });

        dropdown.appendChild(dropdownContent);
        toolbarContainer.appendChild(dropdown);
    }
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
