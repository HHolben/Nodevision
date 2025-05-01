
// FILE: saveWYSIWYGFile.js
(function(){
    function showMessage(msg) {
      const el = document.getElementById('message');
      if (el) {
        el.textContent = msg;
        setTimeout(() => el.textContent = '', 3000);
      }
    }
  
    function showError(msg) {
      const el = document.getElementById('errorMessage');
      if (el) el.textContent = msg;
    }
  
    function saveWYSIWYGFile(filePath) {
      const editor = document.getElementById('editor');
      if (!editor) return showError('Editor not found');
      const raw = editor.innerHTML;
      const content = window.formatHtml(raw);
  
      fetch('/api/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: filePath, content })
      })
      .then(r => r.text())
      .then(() => showMessage('File saved successfully!'))
      .catch(err => showError('Error saving file: ' + err.message));
    }
  
    window.saveWYSIWYGFile = saveWYSIWYGFile;
  })();