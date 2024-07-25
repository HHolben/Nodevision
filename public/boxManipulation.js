function createBox(box) {
    const boxContainer = document.createElement('div');
    boxContainer.className = 'box';
    boxContainer.innerHTML = `
        <div class="drag-bar"></div>
        <div class="box-content">
            <div class="fullscreen-button">
                <button class="fullscreen-btn">Full Screen</button>
            </div>
            <div class="close-button">
                <button class="close-btn">Close</button>
            </div>
            <h2>${box.heading}</h2>
            <p>${box.content}</p>
            <button class="run-script-btn" data-script="${box.script}">Run Script</button>
        </div>
        <div class="resize-handle"></div>
    `;
    document.body.appendChild(boxContainer);
    makeResizableAndDraggable(boxContainer);
}

function bringToFront(element) {
    const boxes = document.querySelectorAll('.box');
    boxes.forEach(box => box.style.zIndex = '1');
    element.style.zIndex = '2';
}

function toggleFullscreen(event) {
    const button = event.target;
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

function closeBox(event) {
    const button = event.target;
    const box = button.closest('.box');
    box.remove();
}

function runScript(event) {
    const button = event.target;
    const scriptName = button.dataset.script;
    try {
        const script = document.createElement('script');
        script.src = scriptName;
        document.body.appendChild(script);
    } catch (error) {
        console.error(`Error running script ${scriptName}:`, error);
    }
}

export { createBox, bringToFront, toggleFullscreen, closeBox, runScript };
