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

    const boxes = [
        {
            heading: "Resizable and Draggable Box",
            content: "This box can be resized and dragged.",
            script: "exampleScript.js",
            ToolbarCategory: "File"
        },
        {
            heading: "Another Box",
            content: "This is another example box.",
            script: "anotherScript.js",
            ToolbarCategory: "Edit"
        },
        {
            heading: "New Node",
            content: `
                <label for="fileNameInput">File Name:</label>
                <input type="text" id="fileNameInput" placeholder="Enter file name">
            `,
            script: "NewNotebookPageInitializer.js",
            ToolbarCategory: "File"
        },
        {
            heading: "Edit Code",
            content: `
                <iframe src="CodeEditor.html"></iframe>
            `,
            script: "NewNotebookPageInitializer.js",
            ToolbarCategory: "Edit"
        }
    ];

    function createToolbar() {
        const toolbar = document.querySelector('.toolbar');
        const categories = {};

        boxes.forEach(box => {
            if (!categories[box.ToolbarCategory]) {
                categories[box.ToolbarCategory] = [];
            }
            categories[box.ToolbarCategory].push(box);
        });

        for (const category in categories) {
            const dropdown = document.createElement('div');
            dropdown.className = 'dropdown';
            const button = document.createElement('button');
            button.className = 'dropbtn';
            button.textContent = category;
            dropdown.appendChild(button);

            const dropdownContent = document.createElement('div');
            dropdownContent.className = 'dropdown-content';

            categories[category].forEach(box => {
                const link = document.createElement('a');
                link.href = '#';
                link.textContent = box.heading;
                link.addEventListener('click', () => createBox(box));
                dropdownContent.appendChild(link);
            });

            dropdown.appendChild(dropdownContent);
            toolbar.appendChild(dropdown);
        }
    }

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

    // Attach event listeners to dynamically created buttons
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
