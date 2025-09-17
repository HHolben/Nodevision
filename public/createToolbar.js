// public/createToolbar.js
// Purpose: TODO: Add description of module purpose

// Dependencies available via window after respective files load
// window.loadToolbarElements from DefineToolbarElements.js
// window.createBox from boxManipulation.js

/**
 * Displays a sub-toolbar underneath the main toolbar with insert options for a given type.
 */
function showInsertSubToolbar(insertType) {
    const boxes = window.loadedToolbarBoxes || [];
    let subToolbar = document.getElementById('sub-toolbar');
    if (!subToolbar) {
        subToolbar = document.createElement('div');
        subToolbar.id = 'sub-toolbar';
        subToolbar.className = 'sub-toolbar';
        const toolbarContainer = document.querySelector('.toolbar');
        toolbarContainer.parentNode.insertBefore(subToolbar, toolbarContainer.nextSibling);
    }
    subToolbar.innerHTML = '';
    subToolbar.style.display = 'block';

    const insertItems = boxes.filter(box =>
        box.ToolbarCategory === 'Insert' &&
        box.insertGroup === insertType &&
        (!box.modes || box.modes.includes(window.AppState ? window.AppState.getMode() : window.currentMode))
    );

    if (insertItems.length === 0) {
        subToolbar.innerHTML = `<p>No options defined for ${insertType}.</p>`;
        return;
    }

    insertItems.forEach(item => {
        const btn = document.createElement('button');
        btn.className = 'insert-option-btn';

        if (item.icon || item.save) {
            const img = document.createElement('img');
            img.src = item.icon || item.save;
            img.alt = item.heading;
            img.className = 'insert-option-icon';
            btn.appendChild(img);
            btn.title = item.heading;
        } else if (item.iconClass) {
            const iconEl = document.createElement('i');
            iconEl.className = `${item.iconClass} insert-option-icon`;
            btn.appendChild(iconEl);
            btn.title = item.heading;
        } else {
            btn.textContent = item.heading;
        }

        if (item.callback) {
            btn.addEventListener('click', e => { e.preventDefault(); item.callback(); });
        } else if (item.script) {
            btn.addEventListener('click', e => { e.preventDefault(); window.createBox(item); });
        }
        subToolbar.appendChild(btn);
    });
}

/**
 * Creates the main toolbar in the specified container.
 */
async function createToolbar(toolbarSelector = '.toolbar') {
    const toolbarContainer = document.querySelector(toolbarSelector);
    if (!toolbarContainer) {
        console.error(`Container not found for selector: ${toolbarSelector}`);
        return;
    }

    const boxes = await window.loadToolbarElements();
    window.loadedToolbarBoxes = boxes;
    const currentMode = window.AppState ? window.AppState.getMode() : window.currentMode;

    const directItems = [];
    const groupedItems = {};
    boxes.forEach(box => {
        if (box.modes && !box.modes.includes(currentMode)) return;
        if (box.direct) directItems.push(box);
        else {
            const category = box.ToolbarCategory || 'Misc';
            (groupedItems[category] = groupedItems[category] || []).push(box);
        }
    });

    toolbarContainer.innerHTML = '';
    const groupOrder = ['File','Edit','Insert','Settings','View','User'];

    groupOrder.forEach(category => {
        if (category === 'Insert' && groupedItems['Insert']?.length) {
            const dropdown = document.createElement('div');
            dropdown.className = 'dropdown insert-dropdown';
            dropdown.setAttribute('data-category', 'Insert');

            const button = document.createElement('button');
            button.className = 'dropbtn'; button.textContent = 'Insert';
            dropdown.appendChild(button);

            const dropdownContent = document.createElement('div');
            dropdownContent.className = 'dropdown-content';

            const rawInsertGroups = groupedItems['Insert'].map(item => item.insertGroup);
            const insertTypes = [...new Set(rawInsertGroups.filter(g => typeof g === 'string' && g.length))];
            insertTypes.forEach(type => {
                const option = document.createElement('a');
                option.href = '#';
                option.textContent = type.charAt(0).toUpperCase() + type.slice(1);
                option.addEventListener('click', e => { e.preventDefault(); showInsertSubToolbar(type); });
                dropdownContent.appendChild(option);
            });
            dropdown.appendChild(dropdownContent);
            toolbarContainer.appendChild(dropdown);
        } else if (groupedItems[category]?.length) {
            const dropdown = document.createElement('div');
            dropdown.className = 'dropdown';
            dropdown.setAttribute('data-category', category);

            const button = document.createElement('button');
            button.className = 'dropbtn'; button.textContent = category;
            dropdown.appendChild(button);

            const dropdownContent = document.createElement('div');
            dropdownContent.className = 'dropdown-content';

            groupedItems[category].forEach(box => {
                const link = document.createElement('a');
                link.href = '#';
                if (box.icon || box.save) {
                    const img = document.createElement('img');
                    img.src = box.icon || box.save;
                    img.alt = box.heading;
                    img.className = 'toolbar-icon';
                    link.appendChild(img);
                    link.title = box.heading;
                } else if (box.iconClass) {
                    const i = document.createElement('i');
                    i.className = `${box.iconClass} toolbar-icon`;
                    link.appendChild(i);
                    link.title = box.heading;
                } else {
                    link.textContent = box.heading;
                }

                const handler = box.customAction || box.callback || (() => window.createBox(box));
                link.addEventListener('click', e => { e.preventDefault(); handler(); });
                dropdownContent.appendChild(link);
            });
            dropdown.appendChild(dropdownContent);
            toolbarContainer.appendChild(dropdown);

            if (category === 'View') {
                directItems.filter(d => d.ToolbarCategory === 'Search').forEach(box => {
                    const elem = document.createElement('div');
                    elem.className = 'toolbar-direct-item'; elem.innerHTML = box.content;
                    toolbarContainer.appendChild(elem);
                    if (box.script) {
                        const s = document.createElement('script'); s.src = box.script;
                        toolbarContainer.appendChild(s);
                    }
                });
            }
        }
    });

    directItems.filter(d => d.ToolbarCategory !== 'Search').forEach(box => {
        const elem = document.createElement('div');
        elem.className = 'toolbar-direct-item'; elem.innerHTML = box.content;
        toolbarContainer.appendChild(elem);
        if (box.script) {
            const s = document.createElement('script'); s.src = box.script;
            toolbarContainer.appendChild(s);
        }
    });
}

// Re-render on mode change
if (window.AppState?.subscribe) window.AppState.subscribe(() => createToolbar());

/**
 * Load and display file view
 */
async function loadFileView(selector) {
    const container = document.querySelector(selector);
    if (!container) { console.error(`Container not found: ${selector}`); return; }
    container.innerHTML = '<p>Loading files...</p>';
    try {
        const resp = await fetch('/api/files');
        const data = await resp.json();
        container.innerHTML = renderDirectoryStructure(data, true);
    } catch (e) {
        container.innerHTML = '<p>Error loading files</p>';
        console.error('Error fetching files:', e);
    }
}

function renderDirectoryStructure(files, isRoot = false) {
    const ul = document.createElement('ul');
    files.forEach(file => {
        const li = document.createElement('li');
        li.className = file.isDirectory ? 'directory' : 'file';
        if (file.isDirectory) {
            const btn = document.createElement('button');
            btn.className = 'directory-button'; btn.textContent = file.name;
            btn.id = file.path.replace('/Notebook/', '');
            btn.addEventListener('click', toggleDirectory);
            const nested = document.createElement('ul');
            nested.className = 'nested'; nested.style.display = 'none';
            nested.setAttribute('data-path', file.path);
            li.append(btn, nested);
        } else {
            const btn = document.createElement('button');
            btn.className = 'file-button';
            btn.id = file.path.replace('/Notebook/', ''); btn.textContent = file.name;
            li.append(btn);
        }
        ul.append(li);
    });
    return ul.outerHTML;
}

async function toggleDirectory(evt) {
    const btn = evt.target;
    const nested = btn.nextElementSibling;
    const path = nested.getAttribute('data-path');
    if (nested.style.display === 'none') {
        nested.style.display = 'block';
        if (!nested.hasAttribute('data-loaded')) {
            try {
                const resp = await fetch(`/api/files?path=${encodeURIComponent(path)}`);
                const data = await resp.json();
                nested.innerHTML = renderDirectoryStructure(data);
                nested.setAttribute('data-loaded', 'true');
            } catch (e) { console.error('Error loading subdir:', e); }
        }
    } else {
        nested.style.display = 'none';
    }
}

// Export functions globally
window.createToolbar = createToolbar;
window.loadFileView = loadFileView;
