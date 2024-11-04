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
                        // Switch to GraphViewMode
                        cyContainer.style.display = 'block';
                        fileViewContainer.style.display = 'none';
                        console.log('Switched to GraphViewMode');
                    } else {
                        // Switch to FileViewMode
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

// Function to load files into File View container
async function loadFileView() {
    const fileViewContainer = document.getElementById('file-view');
    fileViewContainer.innerHTML = '<p>Loading files...</p>';

    try {
        const response = await fetch('/api/files'); // Endpoint to get file data
        const files = await response.json();

        let fileList = '<ul>';
        files.forEach(file => {
            fileList += `<li>${file}</li>`;
        });
        fileList += '</ul>';

        fileViewContainer.innerHTML = fileList;
    } catch (error) {
        fileViewContainer.innerHTML = '<p>Error loading files</p>';
        console.error('Error fetching file data:', error);
    }
}

export { createToolbar };
