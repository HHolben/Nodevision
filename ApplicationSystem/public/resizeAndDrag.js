// Nodevision/ApplicationSystem/public/resizeAndDrag.js
// This file defines browser-side resize And Drag logic for the Nodevision UI. It renders interface components and handles user interactions.

export function makeResizableAndDraggable(element, dockCells = []) {
  let isResizing = false;
  let isDragging = false;
  let originalWidth = 0;
  let originalHeight = 0;
  let originalX = 0;
  let originalY = 0;
  let mouseX = 0;
  let mouseY = 0;
  let activeResizePointerId = null;

  const resizeHandle = element.querySelector('.resize-handle');
  const dragBar = element.querySelector('.drag-bar');

  if (resizeHandle) {
    resizeHandle.style.touchAction = 'none';
    resizeHandle.style.userSelect = 'none';

    resizeHandle.addEventListener('pointerdown', function(e) {
      if (e.button !== undefined && e.button !== 0) return;
      if (activeResizePointerId !== null) return;
      e.preventDefault();
      isResizing = true;
      activeResizePointerId = e.pointerId;
      originalWidth = element.offsetWidth;
      originalHeight = element.offsetHeight;
      mouseX = e.clientX;
      mouseY = e.clientY;
      document.body.style.cursor = 'nwse-resize';
      document.body.style.userSelect = 'none';
      resizeHandle.setPointerCapture?.(e.pointerId);
      document.addEventListener('pointermove', resize);
      document.addEventListener('pointerup', stopResize);
      document.addEventListener('pointercancel', stopResize);
    });
  }

  dragBar?.addEventListener('mousedown', function(e) {
    e.preventDefault();
    isDragging = true;
    originalX = element.offsetLeft;
    originalY = element.offsetTop;
    mouseX = e.clientX;
    mouseY = e.clientY;
    document.addEventListener('mousemove', drag);
    document.addEventListener('mouseup', stopDrag);
    bringToFront(element);
  });

  function resize(e) {
    if (!isResizing) return;
    if (e.pointerId !== activeResizePointerId) return;
    e.preventDefault();
    const width = originalWidth + (e.clientX - mouseX);
    const height = originalHeight + (e.clientY - mouseY);
    element.style.width = width + 'px';
    element.style.height = height + 'px';
  }

  function stopResize(e) {
    if (!isResizing) return;
    if (e?.pointerId !== undefined && e.pointerId !== activeResizePointerId) return;
    resizeHandle?.releasePointerCapture?.(activeResizePointerId);
    isResizing = false;
    activeResizePointerId = null;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    document.removeEventListener('pointermove', resize);
    document.removeEventListener('pointerup', stopResize);
    document.removeEventListener('pointercancel', stopResize);
  }

  function drag(e) {
    if (isDragging) {
      const deltaX = e.clientX - mouseX;
      const deltaY = e.clientY - mouseY;
      element.style.top = (originalY + deltaY) + 'px';
      element.style.left = (originalX + deltaX) + 'px';
    }
  }

  function stopDrag() {
    if (!isDragging) return;
    isDragging = false;
    document.removeEventListener('mousemove', drag);
    document.removeEventListener('mouseup', stopDrag);

    // Check for snapping to a dock cell
    for (let cell of dockCells) {
      const rect = cell.getBoundingClientRect();
      const elRect = element.getBoundingClientRect();
      // simple overlap detection
      if (!(elRect.right < rect.left ||
            elRect.left > rect.right ||
            elRect.bottom < rect.top ||
            elRect.top > rect.bottom)) {
        // Snap panel into cell
        element.style.position = 'relative';
        element.style.top = '0';
        element.style.left = '0';
        element.style.width = '100%';
        element.style.height = '100%';
        cell.appendChild(element);
        element.classList.remove('floating');
        element.classList.add('docked');
        break;
      }
    }
  }
}

// bringToFront function unchanged
export function bringToFront(element) {
  const boxes = document.querySelectorAll('.panel');
  boxes.forEach(box => box.style.zIndex = '1');
  element.style.zIndex = '2';
}
