// Nodevision/ApplicationSystem/tests/vectorDrawingSvgBrowser.mjs
// These browser checks use the real SVG editor to verify native element serialization, snapshot history, transformed layers, legacy line chaining, and shared gesture cleanup.
import { assert, near, pointer, gesture } from './vectorDrawingBrowser.mjs';
export async function runSvgTests(passed) {
  const { renderEditor } = await import('/PanelInstances/EditorPanels/GraphicalEditors/SVGeditorComponents/SVGeditorRuntime.mjs');
  const host = document.createElement('div'); host.style.cssText = 'width:1000px;height:750px;position:relative'; document.body.append(host);
  const cleanup = await renderEditor('vector-test.svg', host);
  const ctx = window.SVGEditorContext, svg = ctx.svgRoot;
  const wrapper = host.querySelector('[tabindex]');
  const key = value => wrapper.dispatchEvent(new KeyboardEvent('keydown', {key:value,bubbles:true,cancelable:true}));
  const parsed = () => new DOMParser().parseFromString(ctx.getEditorHTML(),'image/svg+xml');
  for (const [kind, tag] of [['line','line'],['circle','circle'],['ellipse','ellipse'],['arc','path'],['rectangle','rect'],['polygon','polygon']]) {
    const callback = await import('/ToolbarCallbacks/draw/svgMode' + kind[0].toUpperCase() + kind.slice(1) + '.mjs'); callback.default();
    gesture(svg,kind); if (kind === 'polygon') key('Enter');
    assert(parsed().querySelector(tag), 'SVG creates ' + tag);
  }
  const saved = ctx.getEditorHTML(); assert(!saved.includes('vector-preview'), 'previews excluded from save');
  assert(ctx.undo(), 'SVG undo'); assert(!parsed().querySelector('polygon'), 'polygon removed by undo');
  assert(ctx.redo(), 'SVG redo'); assert(parsed().querySelector('polygon'), 'polygon restored by redo');
  ctx.setMode('circle'); pointer(svg,'pointerdown',100,100); pointer(svg,'pointermove',120,100); key('Escape'); pointer(svg,'pointerup',120,100);
  assert(parsed().querySelectorAll('circle').length === 1, 'Escape cancels SVG circle');
  pointer(svg,'pointerdown',100,100); pointer(svg,'pointermove',120,100); ctx.setMode('ellipse'); pointer(svg,'pointerup',120,100);
  assert(parsed().querySelectorAll('circle').length === 1, 'tool switch cancels SVG circle');
  ctx.setMode('polygon'); pointer(svg,'pointerdown',100,100); pointer(svg,'pointerup',100,100); pointer(svg,'pointerdown',120,100); pointer(svg,'pointerup',120,100);
  pointer(svg,'pointerdown',150,150); pointer(svg,'pointerup',150,150); key('Backspace');
  pointer(svg,'pointerdown',120,120); pointer(svg,'pointerup',120,120); pointer(svg,'pointerdown',120,120,{detail:2}); pointer(svg,'pointerup',120,120);
  assert(parsed().querySelectorAll('polygon').length === 2, 'double-click polygon completion');
  ctx.setMode('line'); pointer(svg,'pointerdown',200,200); pointer(svg,'pointerup',200,200);
  assert(ctx.debugLineToolState().active, 'legacy click line chain begins');
  pointer(svg,'pointerdown',240,200); pointer(svg,'pointerup',240,200); key('Enter');
  assert(parsed().querySelectorAll('line').length === 2, 'legacy click chain remains usable');
  pointer(svg,'pointerdown',260,200); pointer(svg,'pointerup',260,200);
  window.dispatchEvent(new CustomEvent('activePanelChanged'));
  assert(!ctx.debugLineToolState().active, 'panel switch clears legacy Line preview');
  // Layer transform affects only the adapter: local geometry remains accurate.
  const layer = ctx.createLayer('Vector test'); layer.setAttribute('transform','translate(100 80) scale(2)');
  ctx.setActiveLayer(layer.id); ctx.setMode('rectangle'); pointer(svg,'pointerdown',120,100); pointer(svg,'pointermove',160,140); pointer(svg,'pointerup',160,140);
  const rect = layer.querySelector('rect'); assert(rect && near(Number(rect.getAttribute('x')),10) && near(Number(rect.getAttribute('width')),20), 'transformed layer coordinates');
  ctx.undo(); ctx.redo(); ctx.setMode('circle'); pointer(svg,'pointerdown',300,200); pointer(svg,'pointermove',320,200); pointer(svg,'pointerup',320,200);
  assert(parsed().querySelectorAll('circle').length === 2, 'drawing works after snapshot layer replacement');
  passed.push('SVG: six toolbar callbacks, save, history, cancel, polygon keys, legacy Line, transformed layers');
  // Leave a dedicated shared surface for the native pointer-capture assertion.
  cleanup(); host.remove();
  const { bindVectorInteraction } = await import('/VectorDrawing/BindVectorInteraction.mjs');
  const nativeHost = document.createElement('div'); nativeHost.tabIndex = 0; document.body.append(nativeHost);
  nativeHost.innerHTML = '<svg width="400" height="400" viewBox="0 0 400 400" style="background:#eee"></svg>';
  const surface = nativeHost.firstChild;
  const binding = bindVectorInteraction({surface,keyboardHost:nativeHost,getTool:()=> 'circle',toPoint:e=>({x:e.clientX,y:e.clientY}),preview:()=>{},commit:()=>{}});
  window.vectorNativeCaptureSetup = () => { const r=surface.getBoundingClientRect(); return {x:r.x+100,y:r.y+100}; };
  window.vectorNativeCaptured = () => binding.controller.pointerId !== null && surface.hasPointerCapture(binding.controller.pointerId);
}
