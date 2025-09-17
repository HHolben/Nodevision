// resizeAndDrag.js
// Purpose: TODO: Add description of module purpose

function makeResizableAndDraggable(element) {
    let isResizing = false;
    let isDragging = false;
    let originalWidth = 0;
    let originalHeight = 0;
    let originalX = 0;
    let originalY = 0;
    let mouseX = 0;
    let mouseY = 0;

    const resizeHandle = element.querySelector('.resize-handle');
    const dragBar = element.querySelector('.drag-bar');

    resizeHandle.addEventListener('mousedown', function(e) {
        e.preventDefault();
        isResizing = true;
        originalWidth = element.offsetWidth;
        originalHeight = element.offsetHeight;
        mouseX = e.clientX;
        mouseY = e.clientY;
        document.addEventListener('mousemove', resize);
        document.addEventListener('mouseup', stopResize);
    });

    dragBar.addEventListener('mousedown', function(e) {
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
        if (isResizing) {
            const width = originalWidth + (e.clientX - mouseX);
            const height = originalHeight + (e.clientY - mouseY);
            element.style.width = width + 'px';
            element.style.height = height + 'px';
        }
    }

    function stopResize() {
        isResizing = false;
        document.removeEventListener('mousemove', resize);
        document.removeEventListener('mouseup', stopResize);
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
        isDragging = false;
        document.removeEventListener('mousemove', drag);
        document.removeEventListener('mouseup', stopDrag);
    }
}

function bringToFront(element) {
    const boxes = document.querySelectorAll('.box');
    boxes.forEach(box => box.style.zIndex = '1');
    element.style.zIndex = '2';
}

// Export function globally
window.makeResizableAndDraggable = makeResizableAndDraggable;
