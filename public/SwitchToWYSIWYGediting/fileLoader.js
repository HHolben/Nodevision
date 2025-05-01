// FILE: fileLoader.js
(function(){
    function loadFileContents(filePath, callback) {
      if (!filePath) return;
      fetch(`/api/fileCodeContent?path=${encodeURIComponent(filePath)}`)
        .then(res => {
          if (!res.ok) throw new Error(res.statusText);
          return res.json();
        })
        .then(data => {
          const editor = document.getElementById('editor');
          if (editor) {
            editor.innerHTML = data.content;
            if (typeof callback === 'function') callback(editor);
          }
        })
        .catch(err => {
          console.error('Error loading file:', err);
          const errEl = document.getElementById('errorMessage');
          if (errEl) errEl.textContent = err.message;
        });
    }
  
    window.loadFileContents = loadFileContents;
  })();