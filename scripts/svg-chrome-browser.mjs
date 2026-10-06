// Nodevision/scripts/svg-chrome-browser.mjs
// Exercises selection chrome through the real editor's selection, history, clipboard, save, reload, and disposal paths.
export async function checkSvgChrome(context, host, cleanup) {
  const ok = (v, m) => { if (!v) throw Error(m); };
  const frame = () => new Promise(resolve => setTimeout(resolve, 50));
  const root = context.svgRoot;
  context.setEditorHTML('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect id="a" x="10" y="20" width="30" height="40"/><rect id="b" x="100" width="10" height="10"/><g data-nv-editor-ui="overlay"><rect stroke="blue" width="9999" height="9999"/></g></svg>');
  const marquee = host.querySelector('[data-nv-editor-ui="marquee-box"]');
  const pointer = (type, x, y) => root.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: 19, button: 0, buttons: 1, clientX: x, clientY: y }));
  const startMarquee = () => {
    context.setMode('select');
    const bounds = root.getBoundingClientRect();
    pointer('pointerdown', bounds.x + 250, bounds.y + 200);
    pointer('pointermove', bounds.x + 280, bounds.y + 230);
    ok(marquee.getAttribute('display') !== 'none', 'marquee starts through pointer events');
  };
  startMarquee(); pointer('pointercancel', 0, 0);
  ok(marquee.getAttribute('display') === 'none', 'pointer cancellation clears marquee');
  startMarquee(); context.setMode('line');
  ok(marquee.getAttribute('display') === 'none', 'tool mode change clears marquee');
  startMarquee(); context.setEditorHTML(context.getEditorHTML());
  ok(marquee.getAttribute('display') === 'none', 'document replacement clears marquee');
  const a = root.querySelector('#a'), b = root.querySelector('#b');
  const box = host.querySelector('[data-nv-editor-ui="selection-box"]');
  ok(box && !root.contains(box), 'selection chrome lives outside document');
  ok(!root.querySelector('[data-nv-editor-ui]'), 'reload strips old chrome');
  const before = context.getEditorHTML(), bounds = root.getBBox();
  context.setSelection([a]); await frame();
  ok(box.getAttribute('display') !== 'none', 'select A displays bounds');
  const x = box.getAttribute('x');
  context.setSelection([b]); await frame();
  ok(box.getAttribute('x') !== x, 'select B replaces bounds');
  ok(root.getBBox().width === bounds.width, 'chrome cannot affect document bounds');
  ok(context.getEditorHTML() === before && !context.isDirty(), 'selection neither serializes nor dirties');
  const docMutations = [];
  const observer = new MutationObserver(records => docMutations.push(...records));
  observer.observe(root, { subtree: true, childList: true, attributes: true });
  box.setAttribute('x', '5000'); await frame(); observer.disconnect();
  ok(docMutations.length === 0, 'overlay geometry never enters document mutation pipeline');
  for (let i = 0; i < 25; i++) { context.setSelection([a]); context.setSelection([b]); context.clearSelection(); }
  context.clearSelection(); await frame();
  ok(box.getAttribute('display') === 'none', 'clear hides selection');
  context.setSelection([a]); context.copySelection();
  const pasted = context.pasteSelection();
  ok(pasted.length === 1 && !pasted[0].querySelector('[data-nv-editor-ui]') && !pasted[0].hasAttribute('data-nv-editor-ui'), 'clipboard carries document only');
  pasted[0].remove();
  context.setSelection([a]);
  const chromeLayer = host.querySelector('[data-nv-editor-ui="overlay"]');
  root.setAttribute('viewBox', '0 0 600 450'); await frame();
  const rootMatrix = root.getScreenCTM(), chromeMatrix = chromeLayer.getScreenCTM();
  ok(['a','b','c','d','e','f'].every(key => Math.abs(rootMatrix[key]-chromeMatrix[key]) < .001), 'external chrome follows document viewport transforms');
  const handle = [...host.querySelectorAll('rect[data-nv-editor-ui="handle"]')][2];
  const rect = handle.getBoundingClientRect(), widthBefore = a.getBoundingClientRect().width;
  const dispatch = (target, type, x, y) => target.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: 7, button: 0, buttons: type === 'pointerup' ? 0 : 1, clientX: x, clientY: y }));
  dispatch(handle, 'pointerdown', rect.x+rect.width/2, rect.y+rect.height/2);
  dispatch(root, 'pointermove', rect.x+rect.width/2+25, rect.y+rect.height/2+25);
  dispatch(root, 'pointerup', rect.x+rect.width/2+25, rect.y+rect.height/2+25);
  ok(a.getBoundingClientRect().width > widthBefore, 'external resize handle still routes real pointer interactions');
  a.remove(); await frame();
  ok(box.getAttribute('display') === 'none' && !context.getSelectedElement(), 'external removal invalidates selection');
  context.setSelection([b]); context.deleteSelection(); await frame();
  ok(box.getAttribute('display') === 'none', 'delete clears bounds');
  context.undo(); await frame(); context.redo(); await frame();
  ok(box.getAttribute('display') === 'none', 'undo/redo cannot revive stale bounds');
  ok(!context.getEditorHTML().includes('data-nv-editor-ui'), 'save excludes all chrome');
  context.setEditorHTML(before); context.setSelection([root.querySelector('#a')]);
  cleanup(); await frame();
  ok(!host.querySelector('[data-nv-editor-ui]'), 'close removes chrome with selection RAF pending: ' + host.querySelector('[data-nv-editor-ui]')?.outerHTML);
}
