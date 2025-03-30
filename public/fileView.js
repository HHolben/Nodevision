// Nodevision/public/fileView.js

// Expose a function to update the preview pane.
window.updateFilePreview = function(filePath, fileName) {
    console.log("Updating preview for:", filePath);
    const contentFrame = document.getElementById('content-frame');
    const elementInfo = document.getElementById('element-info');
    // Optionally update the info panel with the file's name.
    elementInfo.innerText = fileName;
    contentFrame.src = filePath;
  };
  
  // Expose a function to fetch directory contents.
  window.fetchDirectoryContents = async function(directoryPath = '') {
    console.log("Fetching directory contents for:", directoryPath);
    const loadingElem = document.getElementById('loading');
    const errorElem = document.getElementById('error');
    const fileListElem = document.getElementById('file-list');
  
    loadingElem.style.display = 'block';
    errorElem.textContent = '';
    fileListElem.innerHTML = '';
  
    try {
      const response = await fetch(`/api/files?path=${encodeURIComponent(directoryPath)}`);
      if (!response.ok) {
        throw new Error(`Error fetching files: ${response.statusText}`);
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
  
  // Display the list of files and directories.
  function displayFiles(files, currentPath) {
    const fileListElem = document.getElementById('file-list');
    fileListElem.innerHTML = '';
  
    const ul = document.createElement('ul');
    ul.style.listStyleType = 'none';
    ul.style.padding = '0';
  
    // Only add a parent directory link if we're not in the root (Notebook) directory.
    if (currentPath && currentPath.trim() !== "") {
      const parts = currentPath.split('/');
      parts.pop(); // Remove the current folder.
      const parentPath = parts.join('/'); // This will be "" if the parent is the Notebook root.
      const li = document.createElement('li');
      const link = document.createElement('a');
      link.href = '#';
      link.innerHTML = `<span class="icon">📁</span> .. (Parent Directory)`;
      link.addEventListener('click', (e) => {
        e.preventDefault();
        window.fetchDirectoryContents(parentPath);
      });
      // Allow drop on the parent directory link.
      link.addEventListener('dragover', (e) => { e.preventDefault(); });
      link.addEventListener('drop', (e) => {
        e.preventDefault();
        const sourcePath = e.dataTransfer.getData("text/plain");
        moveFileOrDirectory(sourcePath, parentPath, currentPath);
      });
      li.appendChild(link);
      ul.appendChild(li);
    }
  
    // Create entries for each file/directory.
    files.forEach(item => {
      const li = document.createElement('li');
      li.style.margin = '5px 0';
      const link = document.createElement('a');
      link.href = '#';
      const icon = item.isDirectory ? '📁' : '📄';
      link.innerHTML = `<span class="icon">${icon}</span> ${item.name}`;
      
      function onImageDragStart(event) {
        // For images, set the drag data.
        event.dataTransfer.setData("text/html", event.target.outerHTML);
        // Optionally add a class for visual feedback.
        event.target.classList.add('dragging');
    }
    
    document.addEventListener('dragstart', function(event) {
        if (event.target.tagName.toLowerCase() === 'img' ||
            event.target.tagName.toLowerCase() === 'svg') {
            onImageDragStart(event);
        }
    });
    
      
      // If the item is a directory, allow drops on it.
      if (item.isDirectory) {
        link.addEventListener('dragover', (e) => { e.preventDefault(); });
        link.addEventListener('drop', (e) => {
          e.preventDefault();
          const sourcePath = e.dataTransfer.getData("text/plain");
          const destinationPath = item.path;
          moveFileOrDirectory(sourcePath, destinationPath, currentPath);
        });
      }
  
      // Click behavior: if directory, navigate into it; if file, update the preview.
      link.addEventListener('click', (e) => {
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
  
  // Moves a file or directory from sourcePath to destinationPath.
  function moveFileOrDirectory(sourcePath, destinationPath, currentPath) {
    console.log(`Moving "${sourcePath}" to "${destinationPath}"`);
    fetch(`/api/move`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source: sourcePath, destination: destinationPath })
    })
    .then(response => {
      if (!response.ok) {
        throw new Error('Move operation failed.');
      }
      return response.json();
    })
    .then(result => {
      console.log('Move successful:', result);
      // Refresh the current directory view.
      window.fetchDirectoryContents(currentPath);
    })
    .catch(error => {
      console.error('Error moving file or directory:', error);
      alert('Error moving file or directory.');
    });
  }
  
  // Initialization: force file view for testing.
  document.addEventListener('DOMContentLoaded', () => {
    const cyContainer = document.getElementById('cy');
    const fileViewContainer = document.getElementById('file-view');
  
    // Hide the graph container and show the file view container.
    cyContainer.style.display = 'none';
    fileViewContainer.style.display = 'block';
  
    if (typeof window.fetchDirectoryContents === 'function') {
      window.fetchDirectoryContents();
    } else {
      console.error("fetchDirectoryContents is not defined.");
    }
  });
  