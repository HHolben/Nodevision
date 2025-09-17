// public/resizeContainers.js
// Purpose: TODO: Add description of module purpose

document.addEventListener('DOMContentLoaded', () => {
    const divider = document.getElementById('divider');
    const containerLeft = divider.previousElementSibling;
    const containerRight = divider.nextElementSibling;

    let isResizing = false;

    divider.addEventListener('mousedown', function (e) {
        isResizing = true;
        document.body.style.cursor = 'ew-resize'; // Change cursor style during resize
    });

    document.addEventListener('mousemove', function (e) {
        if (!isResizing) return;

        let offsetRight = document.body.offsetWidth - e.clientX;
        containerLeft.style.width = `calc(100% - ${offsetRight}px)`;
        containerRight.style.width = `${offsetRight}px`;
    });

    document.addEventListener('mouseup', function (e) {
        isResizing = false;
        document.body.style.cursor = 'default'; // Reset cursor style
    });
});
