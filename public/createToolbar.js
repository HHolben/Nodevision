import { boxes } from './DefineToolbarElements.js';
import { createBox } from './boxManipulation.js';

function createToolbar() {
    const toolbar = document.querySelector('.toolbar');
    if (!toolbar) {
        console.error('Toolbar element not found');
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
                        // Show Graph View
                        cyContainer.style.display = 'block';
                        fileViewContainer.style.display = 'none';
                        console.log('Switched to GraphViewMode');
                    } else {
                        // Show File View
                        cyContainer.style.display = 'none';
                        fileViewContainer.style.display = 'block';
                        console.log('Switched to FileViewMode');
                        loadFileView(); // Load files into File View
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
        toolbar.appendChild(dropdown);
    }
}

// Load files and directories into File View container
async function loadFileView() {
    const fileViewContainer = document.getElementById('file-view');
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




// Helper function to render directory structure
function renderDirectoryStructure(files, isRoot = false) {
    const container = document.createElement('ul');

    files.forEach(file => {
        const listItem = document.createElement('li');
        listItem.className = file.isDirectory ? 'directory' : 'file';

        if (file.isDirectory) {
            // Create a button for the directory
            const directoryButton = document.createElement('button');
            directoryButton.className = 'directory-button';
            directoryButton.textContent = file.name;

            // Assign ID based on the path relative to the /Notebook directory
            const relativePath = file.path.replace('/Notebook/', '');
            directoryButton.id = relativePath; // Set the ID

            // Attach click event listener to toggle directory expansion
            directoryButton.addEventListener('click', toggleDirectory);

            // Nested list container for subdirectories
            const nestedList = document.createElement('ul');
            nestedList.className = 'nested';
            nestedList.style.display = 'none'; // Initially hidden
            nestedList.setAttribute('data-path', file.path);

            listItem.appendChild(directoryButton);
            listItem.appendChild(nestedList);
        } else {
            // Create a button for the file that opens it in a new tab
            const fileButton = document.createElement('button');


            // Assign ID based on the path relative to the /Notebook directory
            const relativePath = file.path.replace('/Notebook/', '');
            fileButton.id = relativePath; // Set the ID

            

            fileButton.onclick="alert('Hello world!')";
                //window.open(`/Notebook/${file.path}`, '_blank');
            


                fileButton.className = 'file-button';
                fileButton.textContent = file.name;

            listItem.appendChild(fileButton);
        }

        container.appendChild(listItem);
    });

    return container.outerHTML;
}





// Toggle visibility of nested directories
async function toggleDirectory(event) {
    const directoryButton = event.target;
    const directoryElement = directoryButton.nextElementSibling; // Get the nested <ul> element
    const path = directoryElement.getAttribute('data-path');

    // Toggle display between block and none
    if (directoryElement.style.display === 'none') {
        directoryElement.style.display = 'block';

        // Only fetch and load if not already loaded
        if (!directoryElement.hasAttribute('data-loaded')) {
            try {
                const response = await fetch(`/api/files?path=${encodeURIComponent(path)}`);
                const subDirectoryStructure = await response.json();
                
                // Render and insert the HTML for subdirectories
                directoryElement.innerHTML = renderDirectoryStructure(subDirectoryStructure);
                
                // Mark as loaded to avoid fetching again
                directoryElement.setAttribute('data-loaded', 'true');
            } catch (error) {
                console.error('Error fetching subdirectory data:', error);
            }
        }
    } else {
        // Collapse the directory if already expanded
        directoryElement.style.display = 'none';
    }
}




window.toggleDirectory = toggleDirectory;

export { createToolbar };
