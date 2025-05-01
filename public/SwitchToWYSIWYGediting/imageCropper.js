

// FILE: imageCropper.js
(function(){
    function cropImage(img) {
      if (!img || img.tagName.toLowerCase() !== 'img') {
        alert('No raster image selected for cropping.');
        return;
      }
  
      const modal = document.createElement('div');
      Object.assign(modal.style, {
        position: 'fixed', top: '0', left: '0', width: '100%', height: '100%',
        backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex',
        alignItems: 'center', justifyContent: 'center', zIndex: '1000'
      });
  
      const box = document.createElement('div');
      Object.assign(box.style, { backgroundColor: 'white', padding: '10px', position: 'relative' });
  
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const image = new Image();
      image.src = img.src;
      image.onload = function() {
        canvas.width = image.width;
        canvas.height = image.height;
        ctx.drawImage(image, 0, 0);
      };
      canvas.style.cursor = 'crosshair';
  
      let startX, startY, endX, endY, cropping = false;
      canvas.addEventListener('mousedown', function(e) {
        cropping = true;
        const rect = canvas.getBoundingClientRect();
        startX = e.clientX - rect.left;
        startY = e.clientY - rect.top;
        endX = startX;
        endY = startY;
      });
      canvas.addEventListener('mousemove', function(e) {
        if (!cropping) return;
        const rect = canvas.getBoundingClientRect();
        endX = e.clientX - rect.left;
        endY = e.clientY - rect.top;
        ctx.clearRect(0,0,canvas.width,canvas.height);
        ctx.drawImage(image,0,0);
        ctx.strokeStyle = 'red'; ctx.lineWidth = 2;
        const x = Math.min(startX,endX), y = Math.min(startY,endY);
        ctx.strokeRect(x,y,Math.abs(endX-startX),Math.abs(endY-startY));
      });
      canvas.addEventListener('mouseup', function() { cropping = false; });
  
      const btnContainer = document.createElement('div');
      btnContainer.style.marginTop = '10px';
  
      const applyBtn = document.createElement('button');
      applyBtn.textContent = 'Crop';
      applyBtn.addEventListener('click', function() {
        const x = Math.min(startX,endX), y = Math.min(startY,endY);
        const w = Math.abs(endX-startX), h = Math.abs(endY-startY);
        if (!w || !h) { alert('Select an area first.'); return; }
        const c2 = document.createElement('canvas'); c2.width = w; c2.height = h;
        c2.getContext('2d').drawImage(canvas, x,y,w,h, 0,0,w,h);
        img.src = c2.toDataURL();
        document.body.removeChild(modal);
      });
  
      const cancelBtn = document.createElement('button');
      cancelBtn.textContent = 'Cancel';
      cancelBtn.style.marginLeft = '10px';
      cancelBtn.addEventListener('click', function() {
        document.body.removeChild(modal);
      });
  
      btnContainer.append(applyBtn,cancelBtn);
      box.append(canvas,btnContainer);
      modal.append(box);
      document.body.append(modal);
    }
  
    window.cropImage = cropImage;
  })();
  