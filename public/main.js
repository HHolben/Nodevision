import { createToolbar } from './createToolbar.js';
import { createBox, bringToFront, toggleFullscreen, closeBox, runScript } from './boxManipulation.js';
import { makeResizableAndDraggable } from './resizeAndDrag.js';

document.addEventListener('DOMContentLoaded', function() {
    const divider = document.getElementById('divider');
    const containerLeft = divider.previousElementSibling;
    const containerRight = divider.nextElementSibling;
    const contentFrame = document.getElementById('content-frame');
    let isResizing = false;

    divider.addEventListener('mousedown', function (e) {
        isResizing = true;
        contentFrame.style.pointerEvents = 'none';
    });

    document.addEventListener('mousemove', function (e) {
        if (!isResizing) return;
        let offsetRight = document.body.offsetWidth - (e.clientX - document.body.offsetLeft);
        containerLeft.style.width = `calc(100% - ${offsetRight}px)`;
        containerRight.style.width = `${offsetRight}px`;
        let iframeWidth = containerRight.offsetWidth;
        contentFrame.style.width = `${iframeWidth}px`;
    });

    document.addEventListener('mouseup', function (e) {
        isResizing = false;
        contentFrame.style.pointerEvents = 'auto';
    });

    document.body.addEventListener('click', function(event) {
        if (event.target.matches('.fullscreen-btn')) {
            toggleFullscreen(event);
        } else if (event.target.matches('.close-btn')) {
            closeBox(event);
        } else if (event.target.matches('.run-script-btn')) {
            runScript(event);
        }
    });

    createToolbar();
});


export const boxes = [
    {
        heading: "Resizable and Draggable Box",
        content: "This box can be resized and dragged.",
        script: "exampleScript.js",
        ToolbarCategory: "File"
    },
    // Add other boxes
];

