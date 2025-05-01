

// FILE: clipboardHandler.js
(function(){
    let selectedImage = null;
  
    function setSelectedImage(img) {
      selectedImage = img;
    }
  
    async function copyImageToClipboard() {
      if (!selectedImage) return;
      try {
        if (selectedImage.tagName.toLowerCase() === 'img') {
          const blob = await fetch(selectedImage.src).then(r => r.blob());
          await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        } else {
          const xml = new XMLSerializer().serializeToString(selectedImage);
          const blob = new Blob([xml], { type: 'image/svg+xml' });
          await navigator.clipboard.write([new ClipboardItem({ 'image/svg+xml': blob })]);
        }
      } catch (e) {
        console.error('Failed to copy image to clipboard:', e);
      }
    }
  
    function initClipboardHandlers() {
      document.addEventListener('keydown', function(e) {
        if (!selectedImage) return;
        const isCopy = (e.key === 'c' || e.key === 'x') && (e.ctrlKey || e.metaKey);
        if (isCopy) {
          e.preventDefault();
          if (e.key === 'x') document.execCommand('delete');
          copyImageToClipboard();
          selectedImage.classList.remove('selected');
          selectedImage = null;
        }
      });
      document.addEventListener('copy', function(e) { if (selectedImage) e.preventDefault(); });
      document.addEventListener('cut',  function(e) { if (selectedImage) e.preventDefault(); });
    }
  
    window.setSelectedImage = setSelectedImage;
    window.initClipboardHandlers = initClipboardHandlers;
  })();
  