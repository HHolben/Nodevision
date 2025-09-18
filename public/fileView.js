// Nodevision/public/fileView.js
// Purpose: Load directories/files and display them

export async function fetchDirectoryContents(path, callback, errorElem, loadingElem) {
  try {
    loadingElem.style.display = 'block';
    const response = await fetch(`/Notebook/${path}`);
    if (!response.ok) throw new Error('Failed to fetch directory');
    const data = await response.json();
    callback(data);
  } catch (err) {
    console.error(err);
    if (errorElem) errorElem.textContent = err.message;
  } finally {
    loadingElem.style.display = 'none';
  }
}

export function displayFiles(files) {
  const fileListElem = document.getElementById('file-list');
  fileListElem.innerHTML = '';
  files.forEach(f => {
    const link = document.createElement('a');
    link.href = '#';
    link.textContent = f.name;
    link.addEventListener('click', () => {
      import('./InfoPanel.js').then(mod => {
        mod.updateInfoPanel(f.name);
      });
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
