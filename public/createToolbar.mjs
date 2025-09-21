// Nodevision/public/createToolbar.mjs
// Purpose: Module for creating and populating the Nodevision toolbar dynamically

// Dependencies: 
// - window.loadToolbarElements
// - window.createBox

export async function showInsertSubToolbar(insertType) {
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

export async function createToolbar(toolbarSelector = '.toolbar') {
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
    }
  });

  directItems.forEach(box => {
    const elem = document.createElement('div');
    elem.className = 'toolbar-direct-item';
    elem.innerHTML = box.content;
    toolbarContainer.appendChild(elem);
    if (box.script) {
      const s = document.createElement('script'); s.src = box.script;
      toolbarContainer.appendChild(s);
    }
  });
}
