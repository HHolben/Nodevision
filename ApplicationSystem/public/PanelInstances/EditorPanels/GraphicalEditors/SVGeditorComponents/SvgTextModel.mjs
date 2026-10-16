// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/SVGeditorComponents/SvgTextModel.mjs
// This module maps editable SVG text to UTF-16 input offsets while retaining original styled text nodes and explicit line spans. Unsupported layouts are rejected before any mutation occurs.
const NS = 'http://www.w3.org/2000/svg';
export function boundaries(value) {
  return [...new Intl.Segmenter(undefined, {granularity: 'grapheme'}).segment(value)].map(s => s.index).concat(value.length);
}
export function readTextModel(element) {
  if (element.querySelector(':not(tspan)')) return null;
  const runs = [];
  let value = '', geometry = 0;
  function visit(parent) {
    for (const node of parent.childNodes) {
      if (node.nodeType === 3) {
        runs.push({node, start: value.length, end: value.length + node.data.length, geometry});
        value += node.data; geometry += node.data.length;
      } else if (node.nodeType === 1) {
        if (value && node.hasAttribute('x') && (node.hasAttribute('dy') || node.hasAttribute('y'))) {
          runs.push({line: node, start: value.length, end: value.length + 1, geometry}); value += '\n';
        }
        visit(node);
      }
    }
  }
  visit(element);
  // Collapsed whitespace and per-character positioning require a different offset map.
  const nodes = [element, ...element.querySelectorAll('tspan')];
  if (nodes.some(n => ['x','y','dx','dy','rotate'].some(a => (n.getAttribute(a) || '').trim().split(/[ ,]+/).length > 1))) return null;
  if (nodes.some(n => {const style = getComputedStyle(n); return style.display === 'none' || style.visibility !== 'visible' || +style.opacity === 0;})) return null;
  if (nodes.some(n => n.hasAttribute('rotate') || getComputedStyle(n).writingMode !== 'horizontal-tb')) return null;
  if (nodes.some(n => n.hasAttribute('textLength')) || /[\t\r\n]/.test(element.textContent)) return null;
  const glyphOffsets = [];
  let glyph = 0;
  const preserve = /pre|break-spaces/.test(getComputedStyle(element).whiteSpace);
  const first = value.search(/[^ \n]/), last = value.search(/[^ \n][ \n]*$/);
  for (let i=0; i<value.length; i++) {
    glyphOffsets[i] = glyph;
    if (value[i] === '\n') continue;
    if (!preserve && value[i] === ' ' && (i < first || i > last || value[i-1] === ' ')) continue;
    glyph++;
  }
  glyphOffsets[value.length] = glyph;
  if (element.getNumberOfChars() !== glyph) return null;
  return {value, runs, glyphOffsets, boundaries: boundaries(value)};
}
export function replaceText(element, model, start, end, inserted) {
  const runs = model.runs.filter(r => r.node);
  let target = runs.find(r => start >= r.start && start <= r.end);
  if (!target) {
    const node = element.ownerDocument.createTextNode(''); element.append(node);
    target = {node, start: 0, end: 0}; runs.push(target);
  }
  // Keep unaffected spans and their attributes intact, including empty styled spans.
  for (const run of runs) {
    const a = Math.max(0, start - run.start), b = Math.min(run.node.data.length, end - run.start);
    if (b > a) run.node.deleteData(a, b - a);
  }
  for (const run of model.runs) if (run.line && start <= run.start && end > run.start) {
    for (const attr of ['x','y','dy']) run.line.removeAttribute(attr);
  }
  const offset = Math.min(start - target.start, target.node.length);
  const lines = inserted.replace(/\r\n?/g, '\n').split('\n');
  target.node.insertData(offset, lines[0]);
  if (lines.length > 1) {
    const tail = target.node.splitText(offset + lines[0].length);
    let previous = target.node;
    for (const line of lines.slice(1)) {
      const span = element.ownerDocument.createElementNS(NS, 'tspan');
      span.setAttribute('x', element.getAttribute('x') || '0'); span.setAttribute('dy', '1.2em');
      span.textContent = line; previous.after(span); previous = span;
    }
    previous.append(tail);
  }
}
export function textDiff(before, after) {
  let start = 0, a = before.length, b = after.length;
  while (start < a && start < b && before[start] === after[start]) start++;
  const stops = boundaries(before); start = stops.filter(i => i <= start).at(-1);
  while (a > start && b > start && before[a - 1] === after[b - 1]) { a--; b--; }
  const end = stops.find(i => i >= a); b += end - a;
  return {start, end, inserted: after.slice(start, b)};
}
