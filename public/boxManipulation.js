export function createBox(box) {
    const boxContainer = document.createElement('div');
    boxContainer.className = 'box';
    boxContainer.innerHTML = `
        <div class="drag-bar"></div>
        <div class="box-content">
            <div class="fullscreen-button">
                <button onclick="toggleFullscreen(this)">Full Screen</button>
            </div>
            <div class="close-button">
                <button onclick="closeBox(this)">Close</button>
            </div>
            <h2>${box.heading}</h2>
            <p>${box.content}</p>
            <button onclick="runScript('${box.script}')">Run Script</button>
        </div>
        <div class="resize-handle"></div>
    `;
    document.body.appendChild(boxContainer);
    makeResizableAndDraggable(boxContainer);
}

export function makeResizableAndDraggable(element) {
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

export function bringToFront(element) {
    const boxes = document.querySelectorAll('.box');
    boxes.forEach(box => box.style.zIndex = '1');
    element.style.zIndex = '2';
}

export function toggleFullscreen(button) {
    const box = button.closest('.box');
    box.classList.toggle('fullscreen');
    if (box.classList.contains('fullscreen')) {
        box.style.width = '100%';
        box.style.height = '100%';
        box.style.top = '0';
        box.style.left = '0';
        button.textContent = 'Exit Full Screen';
    } else {
        box.style.width = '300px';
        box.style.height = '200px';
        box.style.top = '';
        box.style.left = '';
        button.textContent = 'Full Screen';
    }
    bringToFront(box);
}

export function closeBox(button) {
    const box = button.closest('.box');
    box.remove();
}

export function runScript(scriptName) {
    try {
        const script = document.createElement('script');
        script.src = scriptName;
        document.body.appendChild(script);
    } catch (error) {
        console.error(`Error running script ${scriptName}:`, error);
    }
}
