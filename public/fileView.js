// Nodevision/public/fileView.js

// Expose a function to update the preview pane.
window.updateFilePreview = function(filePath, fileName) {
    console.log("Updating preview for:", filePath);
    const contentFrame = document.getElementById('content-frame');
    const elementInfo  = document.getElementById('element-info');
    elementInfo.innerText = fileName;
    // Serve the file from the Notebook directory
    contentFrame.src = `/Notebook/${encodeURIComponent(filePath)}`;
};

// Display the list of files and directories.
function displayFiles(files, currentPath) {
    const fileListElem = document.getElementById('file-list');
    fileListElem.innerHTML = '';

    const ul = document.createElement('ul');
    ul.style.listStyleType = 'none';
    ul.style.padding = '0';

    // Parent-directory ("..") link
    if (currentPath && currentPath.trim() !== "") {
        const parts = currentPath.split('/');
        parts.pop();
        const parentPath = parts.join('/');
        const li = document.createElement('li');
        li.style.margin = '5px 0';
        const link = document.createElement('a');
        link.href = '#';
        link.innerHTML = `<span class="icon">📁</span> .. (Parent Directory)`;
        link.addEventListener('click', e => {
            e.preventDefault();
            window.fetchDirectoryContents(parentPath);
        });
        link.addEventListener('dragover', e => e.preventDefault());
        link.addEventListener('drop', e => {
            e.preventDefault();
            const sourcePath = e.dataTransfer.getData('text/plain');
            moveFileOrDirectory(sourcePath, parentPath, currentPath);
        });
        link.setAttribute('draggable', 'true');
        link.addEventListener('dragstart', e => {
            e.dataTransfer.setData('text/plain', parentPath);
            e.dataTransfer.effectAllowed = 'move';
        });
        li.appendChild(link);
        ul.appendChild(li);
    }

    // File/folder entries
    files.forEach(item => {
        const li = document.createElement('li');
        li.style.margin = '5px 0';

        const link = document.createElement('a');
        link.href = '#';
        link.setAttribute('draggable', 'true');
        link.addEventListener('dragstart', e => {
            e.dataTransfer.setData('text/plain', item.path);
            e.dataTransfer.effectAllowed = 'move';
            link.classList.add('dragging');
        });

        const icon = item.isDirectory ? '📁' : '📄';
        link.innerHTML = `<span class="icon">${icon}</span> ${item.name}`;

        if (item.isDirectory) {
            link.addEventListener('dragover', e => e.preventDefault());
            link.addEventListener('drop', e => {
                e.preventDefault();
                const sourcePath      = e.dataTransfer.getData('text/plain');
                const destinationPath = item.path;
                moveFileOrDirectory(sourcePath, destinationPath, currentPath);
            });
        }

        link.addEventListener('click', e => {
            e.preventDefault();
            if (item.isDirectory) {
                window.fetchDirectoryContents(item.path);
            } else {
          updateInfoPanel(item.path);
            }
        });

        li.appendChild(link);
        ul.appendChild(li);
    });

    fileListElem.appendChild(ul);
}

// Expose a function to fetch directory contents.
window.fetchDirectoryContents = async function(directoryPath = '') {
    console.log("Fetching directory contents for:", directoryPath);
    window.currentDirectoryPath = directoryPath;

    const loadingElem  = document.getElementById('loading');
    const errorElem    = document.getElementById('error');
    const fileListElem = document.getElementById('file-list');

    loadingElem.style.display = 'block';
    errorElem.textContent     = '';
    fileListElem.innerHTML    = '';

    try {
        const response = await fetch(`/api/files?path=${encodeURIComponent(directoryPath)}`);
        if (!response.ok) {
            const text = await response.text();
            console.error('Server error fetching files:', response.status, text);
            throw new Error(`Server ${response.status}: ${text}`);
        }
        const data = await response.json();
        displayFiles(data, directoryPath);
    } catch (error) {
        console.error('Error fetching files:', error);
        errorElem.textContent = 'Could not load directory contents. Please try again.';
    } finally {
        loadingElem.style.display = 'none';
    }
};

// Moves a file or directory from sourcePath to destinationPath.
function moveFileOrDirectory(sourcePath, destinationPath, currentPath) {
    console.log(`Moving "${sourcePath}" to "${destinationPath}"`);
    fetch(`/api/move`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: sourcePath, destination: destinationPath })
    })
    .then(response => {
        if (!response.ok) throw new Error('Move operation failed.');
        return response.json();
    })
    .then(result => {
        console.log('Move successful:', result);
        window.fetchDirectoryContents(window.currentDirectoryPath);
    })
    .catch(error => {
        console.error('Error moving file or directory:', error);
        alert('Error moving file or directory.');
    });
}

// Initialization: force file view for testing.
document.addEventListener('DOMContentLoaded', () => {
    const cyContainer      = document.getElementById('cy');
    const fileViewContainer = document.getElementById('file-view');

    cyContainer.style.display     = 'none';
    fileViewContainer.style.display = 'block';

    if (typeof window.fetchDirectoryContents === 'function') {
        window.fetchDirectoryContents();
    } else {
        console.error("fetchDirectoryContents is not defined.");
    }
});
