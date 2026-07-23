// Nodevision/ApplicationSystem/public/resizeHandler.js
// Browser-side resize handling for the legacy two-column container view.

document.addEventListener('DOMContentLoaded', function () {
    const divider = document.getElementById('divider');
    const containerLeft = document.querySelector('.container-left');
    const containerRight = document.querySelector('.container-right');
    const contentFrame = document.getElementById('content-frame');
    if (!divider || !containerLeft || !containerRight || !contentFrame) return;

    let isResizing = false;
    let activePointerId = null;

    divider.style.touchAction = 'none';
    divider.style.userSelect = 'none';

    divider.addEventListener('pointerdown', function (e) {
        if (e.button !== undefined && e.button !== 0) return;
        if (activePointerId !== null) return;
        isResizing = true;
        activePointerId = e.pointerId;
        contentFrame.style.pointerEvents = 'none';
        document.body.style.cursor = 'ew-resize';
        document.body.style.userSelect = 'none';
        divider.setPointerCapture?.(e.pointerId);
        e.preventDefault();
    });

    document.addEventListener('pointermove', function (e) {
        if (!isResizing) return;
        if (e.pointerId !== activePointerId) return;
        e.preventDefault();
        const offsetRight = document.body.offsetWidth - e.clientX;
        const offsetLeft = e.clientX;
        containerLeft.style.width = `${offsetLeft}px`;
        containerRight.style.width = `${offsetRight}px`;
        contentFrame.style.width = `${containerRight.offsetWidth}px`;
    });

    function stopResize(e) {
        if (!isResizing) return;
        if (e?.pointerId !== undefined && e.pointerId !== activePointerId) return;
        divider.releasePointerCapture?.(activePointerId);
        isResizing = false;
        activePointerId = null;
        contentFrame.style.pointerEvents = 'auto';
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
    }

    document.addEventListener('pointerup', stopResize);
    document.addEventListener('pointercancel', stopResize);
});
