// public/resizeHandler.js
// Purpose: TODO: Add description of module purpose

document.addEventListener('DOMContentLoaded', function () {
    const divider = document.getElementById('divider');
    const containerLeft = document.querySelector('.container-left');
    const containerRight = document.querySelector('.container-right');
    const contentFrame = document.getElementById('content-frame');
    let isResizing = false;

    divider.addEventListener('mousedown', function (e) {
        isResizing = true;
        contentFrame.style.pointerEvents = 'none';
    });

    document.addEventListener('mousemove', function (e) {
        if (!isResizing) return;
        const offsetRight = document.body.offsetWidth - e.clientX;
        const offsetLeft = e.clientX;
        containerLeft.style.width = `${offsetLeft}px`;
        containerRight.style.width = `${offsetRight}px`;
        contentFrame.style.width = `${containerRight.offsetWidth}px`;
    });

    document.addEventListener('mouseup', function () {
        isResizing = false;
        contentFrame.style.pointerEvents = 'auto';
    });
});


    function resize(e) {
        if (!isResizing) return;
        let offsetRight = document.body.offsetWidth - (e.clientX - document.body.offsetLeft);
        containerLeft.style.width = `calc(100% - ${offsetRight}px)`;
        containerRight.style.width = `${offsetRight}px`;
        let iframeWidth = containerRight.offsetWidth;
        contentFrame.style.width = `${iframeWidth}px`;
    }

    function stopResize() {
        isResizing = false;
        contentFrame.style.pointerEvents = 'auto';
        document.removeEventListener('mousemove', resize);
        document.removeEventListener('mouseup', stopResize);
    }

