// Nodevision/ApplicationSystem/public/SwitchToSVGediting/insertTools.handlers.js
// Implements inserting shapes (and freeform draw) into the SVG editor canvas.
(function () {
  const ns = 'http://www.w3.org/2000/svg';

  function clientToSvg(svgRoot, clientX, clientY) {
    try {
      const ctm = svgRoot.getScreenCTM();
      if (!ctm) return { x: clientX, y: clientY };
      const inv = ctm.inverse();
      const pt = new DOMPoint(clientX, clientY).matrixTransform(inv);
      return { x: pt.x, y: pt.y };
    } catch {
      return { x: clientX, y: clientY };
    }
  }

  function setStyle(el) {
    el.setAttribute('fill', 'none');
    el.setAttribute('stroke', '#000');
    el.setAttribute('stroke-width', '2');
  }

  function ptsToStr(pts) {
    return pts.map((p) => `${p.x},${p.y}`).join(' ');
  }

  function poly(cx, cy, sides, r, rot = -Math.PI / 2) {
    const pts = [];
    for (let i = 0; i < sides; i++) {
      const a = rot + (i * 2 * Math.PI) / sides;
      pts.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
    }
    return pts;
  }

  function star(cx, cy, points, rO, rI, rot = -Math.PI / 2) {
    const pts = [];
    const n = points * 2;
    for (let i = 0; i < n; i++) {
      const r = i % 2 === 0 ? rO : rI;
      const a = rot + (i * 2 * Math.PI) / n;
      pts.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
    }
    return pts;
  }

  function selectAndReturn(api, el) {
    api?.clearSelection?.();
    api?.selectElement?.(el);
    api?.setTool?.('select');
    api?.setMessage?.('Select tool active - click on shapes to select');
  }

  function insert(svgRoot, shape, x, y) {
    let el;
    if (shape === 'rect') {
      el = document.createElementNS(ns, 'rect');
      const w = 120, h = 80;
      el.setAttribute('x', x - w / 2);
      el.setAttribute('y', y - h / 2);
      el.setAttribute('width', w);
      el.setAttribute('height', h);
    } else if (shape === 'ellipse') {
      el = document.createElementNS(ns, 'ellipse');
      el.setAttribute('cx', x);
      el.setAttribute('cy', y);
      el.setAttribute('rx', 70);
      el.setAttribute('ry', 45);
    } else if (shape === 'line') {
      el = document.createElementNS(ns, 'line');
      el.setAttribute('x1', x - 70);
      el.setAttribute('y1', y);
      el.setAttribute('x2', x + 70);
      el.setAttribute('y2', y);
    } else if (shape === 'polygon') {
      el = document.createElementNS(ns, 'polygon');
      el.setAttribute('points', ptsToStr(poly(x, y, 5, 55)));
    } else if (shape === 'star') {
      el = document.createElementNS(ns, 'polygon');
      el.setAttribute('points', ptsToStr(star(x, y, 5, 60, 28)));
    } else if (shape === 'bezier') {
      el = document.createElementNS(ns, 'path');
      const x1 = x - 70, y1 = y + 10, x2 = x + 70, y2 = y - 10;
      el.setAttribute('d', `M ${x1} ${y1} C ${x - 30} ${y - 70} ${x + 30} ${y + 70} ${x2} ${y2}`);
    } else {
      return null;
    }
    setStyle(el);
    svgRoot.appendChild(el);
    return el;
  }

  (function wait() {
    const api = window.NVSvgEditorApi;
    const svgRoot = api?.svgRoot || document.getElementById('svg-editor');
    const insertState = window.NVSvgInsert?.state;
    const drawState = window.NVSvgDraw?.state;
    if (!svgRoot || !insertState || !drawState) return requestAnimationFrame(wait);

    let drawing = false;
    let path = null;

    svgRoot.addEventListener('mousedown', (e) => {
      const tool = window.currentSVGTool;
      const shape =
        tool === 'draw'
          ? (drawState.shape || window.currentDrawShape)
          : (insertState.shape || window.currentInsertShape);

      if (!shape || (tool !== 'insert' && tool !== 'draw')) return;
      if (e.button !== 0) return;

      const pt = clientToSvg(svgRoot, e.clientX, e.clientY);

      if (shape === 'freeform' && tool === 'draw') {
        e.preventDefault(); e.stopPropagation();
        drawing = true;
        path = document.createElementNS(ns, 'path');
        path.setAttribute('d', `M ${pt.x} ${pt.y}`);
        setStyle(path);
        svgRoot.appendChild(path);
        return;
      }

      if (tool === 'insert') {
        e.preventDefault(); e.stopPropagation();
        const el = insert(svgRoot, shape, pt.x, pt.y);
        if (el) selectAndReturn(api, el);
      }

      if (tool === 'draw' && shape === 'bezier') {
        e.preventDefault(); e.stopPropagation();
        const el = insert(svgRoot, 'bezier', pt.x, pt.y);
        if (el) {
          selectAndReturn(api, el);
          drawState.shape = null;
          window.currentDrawShape = null;
          window.currentSVGTool = 'select';
        }
      }
    }, { capture: true });

    document.addEventListener('mousemove', (e) => {
      if (!drawing || !path) return;
      const pt = clientToSvg(svgRoot, e.clientX, e.clientY);
      path.setAttribute('d', `${path.getAttribute('d') || ''} L ${pt.x} ${pt.y}`);
    });

    document.addEventListener('mouseup', () => {
      if (!drawing || !path) return;
      drawing = false;
      const finished = path; path = null;
      selectAndReturn(api, finished);
      drawState.shape = null;
      window.currentDrawShape = null;
      window.currentSVGTool = 'select';
    });
  })();
})();
