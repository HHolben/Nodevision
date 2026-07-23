// Nodevision/ApplicationSystem/public/resizeContainers.js
// Browser-side resize handling for the legacy two-column container view.

document.addEventListener('DOMContentLoaded', () => {
    const divider = document.getElementById('divider');
    if (!divider) return;

    const containerLeft = divider.previousElementSibling;
    const containerRight = divider.nextElementSibling;
    if (!containerLeft || !containerRight) return;

    let isResizing = false;
    let activePointerId = null;

    divider.style.touchAction = 'none';
    divider.style.userSelect = 'none';

    divider.addEventListener('pointerdown', function (e) {
        if (e.button !== undefined && e.button !== 0) return;
        if (activePointerId !== null) return;
        isResizing = true;
        activePointerId = e.pointerId;
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
        containerLeft.style.width = `calc(100% - ${offsetRight}px)`;
        containerRight.style.width = `${offsetRight}px`;
    });

    function stopResize(e) {
        if (!isResizing) return;
        if (e?.pointerId !== undefined && e.pointerId !== activePointerId) return;
        divider.releasePointerCapture?.(activePointerId);
        isResizing = false;
        activePointerId = null;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
    }

    document.addEventListener('pointerup', stopResize);
    document.addEventListener('pointercancel', stopResize);
});
