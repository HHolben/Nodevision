// FILE: toolbar.js
(function(){
    function updateWYSIWYGToolbar(filePath) {
      const container = document.querySelector('.toolbar');
      if (!container) return console.error('Toolbar not found.');
  
      let dropdown = container.querySelector('.dropdown[data-category="File"]');
      if (!dropdown) {
        dropdown = document.createElement('div');
        dropdown.className = 'dropdown';
        dropdown.dataset.category = 'File';
        dropdown.innerHTML =
          '<button class="dropbtn">File</button>' +
          '<div class="dropdown-content"></div>';
        container.appendChild(dropdown);
      }
  
      const content = dropdown.querySelector('.dropdown-content');
      if (!content.querySelector('#save-wysiwyg-btn')) {
        const btn = document.createElement('button');
        btn.id = 'save-wysiwyg-btn';
        btn.textContent = 'Save changes';
        btn.addEventListener('click', function() {
          window.saveWYSIWYGFile(filePath);
        });
        content.appendChild(btn);
      }
    }
  
    window.updateWYSIWYGToolbar = updateWYSIWYGToolbar;
  })();
  