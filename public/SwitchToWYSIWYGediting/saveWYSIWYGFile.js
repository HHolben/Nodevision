// public/SwitchToWYSIWYGediting/saveWYSIWYGFile.js
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
    console.error(msg);
  }

  async function saveWYSIWYGFile(filePath) {
    const editor = document.getElementById('editor');
    if (!editor) {
      return showError('Editor not found');
    }

    const raw = editor.innerHTML;
    const content = (typeof window.formatHtml === 'function')
      ? window.formatHtml(raw)
      : raw;

    console.log("Saving WYSIWYG file:", filePath);
    console.log("Content being sent:", content);

    try {
      const response = await fetch('/api/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: filePath, content })
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(errText || `HTTP ${response.status}`);
      }

      showMessage('File saved successfully!');
    } catch (err) {
      showError('Error saving file: ' + err.message);
    }
  }

  window.saveWYSIWYGFile = saveWYSIWYGFile;
})();
