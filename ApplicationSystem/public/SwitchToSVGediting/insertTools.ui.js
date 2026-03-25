// Nodevision/ApplicationSystem/public/SwitchToSVGediting/insertTools.ui.js
// Builds the SVG editor "Insert" toolbar button + dropdown menu.
(function () {
  const INSERT_SHAPES = [
    { id: 'rect', label: 'Rectangle' },
    { id: 'ellipse', label: 'Ellipse' },
    { id: 'polygon', label: 'Polygon' },
    { id: 'star', label: 'Star' },
    { id: 'line', label: 'Line' }
  ];

  const DRAW_SHAPES = [
    { id: 'freeform', label: 'Freeform' },
    { id: 'bezier', label: 'Bezier' }
  ];

  const insertState = {
    shape: null,
    mode: 'insert'
  };

  const drawState = {
    shape: null,
    mode: 'draw'
  };

  function setInsertShape(shape) {
    insertState.shape = shape;
    window.currentInsertShape = shape;
    window.currentSVGTool = 'insert';
    window.NVSvgEditorApi?.setMessage?.(`Insert: ${shape} (click canvas)`);
    window.dispatchEvent(new CustomEvent('nv-svg-insert-shape', { detail: { shape, mode: 'insert' } }));
  }

  function setDrawShape(shape) {
    drawState.shape = shape;
    window.currentDrawShape = shape;
    window.currentSVGTool = 'draw';
    window.NVSvgEditorApi?.setMessage?.(`Draw: ${shape} (click canvas)`);
    window.dispatchEvent(new CustomEvent('nv-svg-insert-shape', { detail: { shape, mode: 'draw' } }));
  }

  function ensureUi() {
    const api = window.NVSvgEditorApi;
    const toolbar = document.getElementById('publisher-toolbar');
    if (!toolbar) return false;

    const selectionGroup = toolbar.querySelector('.tool-group');
    if (!selectionGroup) return false;

    if (!document.getElementById('svg-insert-tool')) {
      const insertBtn = document.createElement('button');
      insertBtn.id = 'svg-insert-tool';
      insertBtn.className = 'svg-tool-btn';
      insertBtn.title = 'Insert Shapes';
      insertBtn.textContent = 'Insert';
      selectionGroup.appendChild(insertBtn);

      const drawBtn = document.createElement('button');
      drawBtn.id = 'svg-draw-tool';
      drawBtn.className = 'svg-tool-btn';
      drawBtn.title = 'Draw Tools';
      drawBtn.textContent = 'Draw';
      selectionGroup.appendChild(drawBtn);

      const menu = document.createElement('div');
      menu.id = 'svg-insert-menu';
      menu.className = 'context-menu';
      menu.style.display = 'none';
      document.body.appendChild(menu);

      for (const s of INSERT_SHAPES) {
        const item = document.createElement('div');
        item.className = 'context-item';
        item.dataset.shape = s.id;
        item.textContent = s.label;
        menu.appendChild(item);
      }

      const drawMenu = document.createElement('div');
      drawMenu.id = 'svg-draw-menu';
      drawMenu.className = 'context-menu';
      drawMenu.style.display = 'none';
      document.body.appendChild(drawMenu);

      for (const s of DRAW_SHAPES) {
        const item = document.createElement('div');
        item.className = 'context-item';
        item.dataset.shape = s.id;
        item.textContent = s.label;
        drawMenu.appendChild(item);
      }

      const placeMenu = () => {
        const r = insertBtn.getBoundingClientRect();
        menu.style.left = `${Math.round(r.left)}px`;
        menu.style.top = `${Math.round(r.bottom + 6)}px`;
      };

      const placeDrawMenu = () => {
        const r = drawBtn.getBoundingClientRect();
        drawMenu.style.left = `${Math.round(r.left)}px`;
        drawMenu.style.top = `${Math.round(r.bottom + 6)}px`;
      };

      insertBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        drawMenu.style.display = 'none';
        placeMenu();
        menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
      });

      drawBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        menu.style.display = 'none';
        placeDrawMenu();
        drawMenu.style.display = drawMenu.style.display === 'block' ? 'none' : 'block';
      });

      document.addEventListener('click', (e) => {
        const inInsert = e.target === insertBtn || menu.contains(e.target);
        const inDraw = e.target === drawBtn || drawMenu.contains(e.target);
        if (!inInsert) menu.style.display = 'none';
        if (!inDraw) drawMenu.style.display = 'none';
      });

      menu.addEventListener('click', (e) => {
        const shape = e.target && e.target.dataset ? e.target.dataset.shape : null;
        if (!shape) return;
        menu.style.display = 'none';
        setInsertShape(shape);
      });

      drawMenu.addEventListener('click', (e) => {
        const shape = e.target && e.target.dataset ? e.target.dataset.shape : null;
        if (!shape) return;
        drawMenu.style.display = 'none';
        setDrawShape(shape);
      });

      if (api?.setTool) {
        // Keep "Insert" visually inactive when switching tools.
        window.addEventListener('nv-svg-editor-selection-changed', () => {
          insertBtn.classList.remove('active');
          drawBtn.classList.remove('active');
        });
      }
    }

    return true;
  }

  window.NVSvgInsert = {
    SHAPES: INSERT_SHAPES,
    state: insertState,
    setShape: setInsertShape,
    ensureUi
  };

  window.NVSvgDraw = {
    SHAPES: DRAW_SHAPES,
    state: drawState,
    setShape: setDrawShape,
    ensureUi
  };

  (function wait() {
    if (!ensureUi()) requestAnimationFrame(wait);
  })();
})();
