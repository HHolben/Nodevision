// Nodevision/public/fileView.js
// This module loads directories/files and displays them as a list

export async function fetchDirectoryContents(path, callback, errorElem, loadingElem) {
  try {
    if (loadingElem) loadingElem.style.display = 'block';
    const response = await fetch(`/Notebook/${path}`);
    if (!response.ok) throw new Error('Failed to fetch directory');
    const data = await response.json();
    callback(data);
  } catch (err) {
    console.error(err);
    if (errorElem) errorElem.textContent = err.message;
  } finally {
    if (loadingElem) loadingElem.style.display = 'none';
  }
}

export function displayFiles(files) {
  const fileListElem = document.getElementById('file-list');
  if (!fileListElem) {
    console.error('file-list element not found.');
    return;
  }
  fileListElem.innerHTML = '';

  files.forEach(f => {
    const link = document.createElement('a');
    link.href = '#';
    link.textContent = f.name;

    link.addEventListener('click', async () => {
      try {
        const mod = await import('./InfoPanel.js');
        mod.updateInfoPanel(f.name);
      } catch (err) {
        console.error('Failed to load InfoPanel module:', err);
      }
    });

    const li = document.createElement('li');
    li.appendChild(link);
    fileListElem.appendChild(li);
  });
}

// Optional helper for moving files
export async function moveFileOrDirectory(src, dest) {
  const res = await fetch('/api/files/move', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ src, dest }),
  });
  return res.json();
}

// Optional: initialize immediately if elements exist
export function initFileView(path = '') {
  const fileListElem = document.getElementById('file-list');
  const loadingElem = document.getElementById('loading');
  const errorElem = document.getElementById('error');
  if (!fileListElem || !loadingElem || !errorElem) return;

  fetchDirectoryContents(path, displayFiles, errorElem, loadingElem);
}
