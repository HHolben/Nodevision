// Nodevision/ApplicationSystem/public/SwitchToWYSIWYGediting/tabHandler.js
// This file defines browser-side tab Handler logic for the Nodevision UI. It renders interface components and handles user interactions.
// public/SwitchToWYSIWYGediting/tabHandler.js
// Purpose: TODO: Add description of module purpose


// FILE: tabHandler.js
(function(){
    function enableTabInsert(editor) {
      if (!editor) return;
      editor.addEventListener('keydown', function(e) {
        if (e.key === 'Tab') {
          e.preventDefault();
          document.execCommand('insertHTML', false, '<span style="white-space:pre;">\t</span>');
        }
      });
    }
  
    window.enableTabInsert = enableTabInsert;
  })();
  