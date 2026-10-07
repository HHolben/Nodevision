// Nodevision/scripts/uppercase-handwriting-browser.mjs
// This browser regression exercises actual Session controls, pointer events, ink rendering, fixture export, and cleanup against locally served templates without accessing Notebook data.
import { startUppercaseHandwriting } from '/Sessions/UppercaseHandwritingSession.mjs';
const report = document.querySelector('#result');
const checks = [];
const ok = (condition, message) => { if (!condition) throw new Error(message); checks.push(message); };
const cleanups = [], events = [];
try {
  await startUppercaseHandwriting({ executionContext: { addCleanup: (fn) => cleanups.push(fn), emit: (...args) => events.push(args) } });
  const root = document.querySelector('.nv-uppercase');
  ok(document.querySelector('#nv-session-root').children.length === 1, 'Session replaces initial title with one surface');
  const canvas = root.querySelector('.drawing');
  // Synthetic events cannot establish native pointer capture. Input ownership and lifecycle are still exercised.
  canvas.setPointerCapture = () => {};
  canvas.releasePointerCapture = () => {};
  const button = (name) => root.querySelector(`[data-action="${name}"]`);
  const output = root.querySelector('output');
  const pointer = (type, point, pointerType = 'pen') => {
    const rect = canvas.getBoundingClientRect();
    canvas.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerId: 1, pointerType,
      clientX: rect.left + point[0], clientY: rect.top + point[1], buttons: type === 'pointerup' ? 0 : 1, button: 0 }));
  };
  const draw = (strokes, type) => {
    for (const stroke of strokes) {
      pointer('pointerdown', stroke[0], type);
      for (const point of stroke.slice(1, -1)) pointer('pointermove', point, type);
      pointer('pointerup', stroke.at(-1), type);
    }
  };
  ok(canvas.clientWidth >= 300 && canvas.clientHeight >= 240, 'Comfortable responsive drawing area');
  button('recognize').click();
  ok(output.textContent.includes('first'), 'Empty recognition asks for drawing');
  const fixtures = (await (await fetch('/HandwritingRecognition/StrokeRecognition/fixtures/uppercase-examples.json')).json()).fixtures;
  const times = [];
  for (const [index, fixture] of fixtures.entries()) {
    button('clear').click();
    draw(fixture.strokes, ['pen', 'mouse', 'touch'][index % 3]);
    const start = performance.now(); button('recognize').click(); times.push(performance.now() - start);
    ok(output.textContent === `Recognized: ${fixture.expectedLetter}`, `Recognize ${fixture.expectedLetter} through pointer UI`);
    ok(root.querySelector('pre').textContent.includes('selectedTemplateId'), 'Template diagnostics visible');
  }
  const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
  ok(pixels.some((value, i) => i % 4 === 3 && value > 0), 'Strokes visibly rendered at device pixel ratio');
  let downloaded;
  const originalCreate = URL.createObjectURL, originalClick = HTMLAnchorElement.prototype.click;
  URL.createObjectURL = (blob) => { downloaded = blob; return 'blob:fixture'; };
  HTMLAnchorElement.prototype.click = () => {};
  root.querySelector('select').value = 'A';
  button('export').click();
  const saved = JSON.parse(await downloaded.text());
  URL.createObjectURL = originalCreate; HTMLAnchorElement.prototype.click = originalClick;
  ok(saved.expectedLetter === 'A' && saved.observed.letter === 'Z' && saved.strokes.length, 'Export preserves actual drawing and independent expected label');
  pointer('pointerdown', [80, 80]);
  ok(button('recognize').disabled, 'Recognition waits for active stroke completion');
  button('clear').click();
  ok(!button('recognize').disabled && root.querySelector('pre').textContent === '', 'Clear resets drawing and diagnostics mid-stroke');
  draw(fixtures[0].strokes, 'mouse'); button('recognize').click();
  ok(output.textContent === 'Recognized: A', 'Immediately draw again after clear');
  pointer('pointerdown', [10, 10]); pointer('pointercancel', [20, 20]);
  ok(!button('recognize').disabled, 'Pointer cancellation releases drawing state');
  button('finish').click();
  ok(events[0]?.[0] === 'uppercaseHandwriting.finished', 'Finish emits Session completion event');
  cleanups.forEach((fn) => fn());
  ok(!document.querySelector('.nv-uppercase'), 'Session cleanup removes its UI');
  // Exercise local template load failure independently of the successful cache.
  const { loadBuiltinStrokeTemplates } = await import('/HandwritingRecognition/StrokeRecognition/StrokeTemplateStore.mjs');
  let failed = false;
  try { await loadBuiltinStrokeTemplates({ force: true, fetchImpl: async () => ({ ok: false, status: 404 }) }); }
  catch { failed = true; }
  ok(failed, 'Missing local template file reports a load error');
  report.textContent = `PASS: ${checks.length} checks; recognition UI mean ${(times.reduce((a,b)=>a+b,0)/times.length).toFixed(1)} ms; max ${Math.max(...times).toFixed(1)} ms\n${checks.join('\n')}`;
} catch (error) {
  report.textContent = `FAIL: ${error.stack}`;
  cleanups.forEach((fn) => fn());
}
