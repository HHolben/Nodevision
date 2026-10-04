// Verify the extracted SVG runtime with real browser DOM and its public editing context.
try {
  window.NodevisionState = {};
  const nativeFetch = window.fetch.bind(window);
  window.fetch = (url, options) => String(url).startsWith('/Notebook/')
    ? Promise.resolve(new Response('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect id="shape" x="10" y="20" width="60" height="40" fill="red"/></svg>'))
    : nativeFetch(url, options);
  const { renderEditor } = await import('/PanelInstances/EditorPanels/GraphicalEditors/SVGeditorComponents/SVGeditorRuntime.mjs');
  const container = document.getElementById('editor');
  const dispose = await renderEditor('modular.svg', container);
  const context = window.SVGEditorContext;
  const assert = (value, label) => { if (!value) throw new Error(label); };
  assert(context?.svgRoot.querySelector('#shape'), 'SVG document loads');
  window.selectSVGElement(context.svgRoot.querySelector('#shape'));
  context.recordSvgSnapshot('color', () => { context.svgRoot.querySelector('#shape').setAttribute('fill', 'blue'); return true; });
  assert(context.getEditorHTML().includes('blue'), 'snapshot edit saves');
  context.undo(); assert(context.svgRoot.querySelector('#shape').getAttribute('fill') === 'red', 'undo restores authored paint');
  context.redo(); assert(context.svgRoot.querySelector('#shape').getAttribute('fill') === 'blue', 'redo restores authored paint');
  for (const mode of ['line', 'circle', 'freehand', 'select']) { context.setMode(mode); assert(context.getMode() === mode, 'tool mode ' + mode); }
  dispose();
  document.getElementById('result').textContent = 'PASS: SVG modular runtime loads, edits, undoes, changes tools and disposes';
} catch (error) { document.getElementById('result').textContent = error.stack; }
