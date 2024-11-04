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

        // Log the entire response for debugging
        console.log("Response Status:", response.status);
        console.log("Response Headers:", response.headers);
        
        // Check the Content-Type and log the response body for inspection
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
            const directoryStructure = await response.json(); // Parse JSON if content-type is correct
            fileViewContainer.innerHTML = renderDirectoryStructure(directoryStructure);
        } else {
            const textResponse = await response.text(); // Capture non-JSON response
            console.error("Unexpected response body:", textResponse);
            throw new Error("Response is not JSON");
        }
    } catch (error) {
        fileViewContainer.innerHTML = '<p>Error loading files</p>';
        console.error('Error fetching file data:', error);
    }
}



// Helper function to render directory structure
function renderDirectoryStructure(files) {
    let html = '<ul>';
    files.forEach(file => {
        if (file.isDirectory) {
            html += `<li>${file.name}<ul>${renderDirectoryStructure(file.contents)}</ul></li>`;
        } else {
            html += `<li><a href="/Notebook/${file.path}" target="_blank">${file.name}</a></li>`;
        }
    });
    html += '</ul>';
    return html;
}

export { createToolbar };
