import { boxes } from './DefineToolbarElements.js';
import { createBox } from './boxManipulation.js';

function createToolbar() {
    const toolbar = document.querySelector('.toolbar');
    if (!toolbar) {
        console.error('Toolbar element not found');
        return;
    }
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

export { createToolbar };
