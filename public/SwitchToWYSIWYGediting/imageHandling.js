// FILE: imageHandling.js
(function(){
    let draggedImage = null;
  
    function initImageHandling(editor) {
      if (!editor) return;
  
      editor.addEventListener('click', function(e) {
        const img = e.target.closest('img, svg');
        if (!img) return;
        document.querySelector('.selected')?.classList.remove('selected');
        img.classList.add('selected');
        img.setAttribute('draggable', 'true');
        window.selectedImage = img;
        window.setSelectedImage(img);
      });
  
      document.addEventListener('dragstart', function(e) {
        const tgt = e.target;
        if (!['img','svg'].includes(tgt.tagName.toLowerCase())) return;
        draggedImage = tgt;
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/html', tgt.outerHTML);
        e.stopPropagation();
        tgt.classList.add('dragging');
      });
  
      editor.addEventListener('dragover', function(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
      });
  
      editor.addEventListener('drop', function(e) {
        e.preventDefault(); e.stopPropagation();
        const html = e.dataTransfer.getData('text/html');
        if (!html) return;
        const temp = document.createElement('div'); temp.innerHTML = html;
        const node = temp.firstChild;
        const sel = window.getSelection();
        if (sel.rangeCount) {
          const range = sel.getRangeAt(0);
          range.insertNode(node);
          range.setStartAfter(node);
          sel.removeAllRanges(); sel.addRange(range);
        } else editor.appendChild(node);
        draggedImage?.remove(); draggedImage = null;
      });
  
      document.addEventListener('dragend', function(e) {
        e.target.classList.remove('dragging');
        if (e.dataTransfer.dropEffect === 'move' && draggedImage) {
          draggedImage.remove();
        }
        draggedImage = null;
      });
    }
  
    window.initImageHandling = initImageHandling;
  })();
  