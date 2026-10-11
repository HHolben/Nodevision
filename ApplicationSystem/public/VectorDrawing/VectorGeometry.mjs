// Nodevision/ApplicationSystem/public/VectorDrawing/VectorGeometry.mjs
// This module defines validated document-space vector geometry and its SVG representation. The same coordinates describe editable artwork and transient raster annotations without depending on viewport scale.
export const vectorTools = Object.freeze(['line', 'circle', 'ellipse', 'arc', 'rectangle', 'polygon']);
const tau = 2 * Math.PI, epsilon = 1e-6;
const distance = (a, b) => Math.hypot(b.x - a.x, b.y - a.y);
const positive = angle => ((angle % tau) + tau) % tau;
export function createGeometry(kind, points, { sweep = 1 } = {}) {
  if ((!vectorTools.includes(kind) && kind !== 'freehand') || !points?.length || points.some(p => !Number.isFinite(p.x) || !Number.isFinite(p.y))) return null;
  const [a, b, c] = points;
  if (kind === 'freehand') {
    const samples = points.filter((p, i) => !i || distance(p, points[i - 1]) > epsilon);
    return samples.length >= 2 ? { kind, points: samples.map(p => ({ x: p.x, y: p.y })) } : null;
  }
  if (kind === 'polygon') {
    const vertices = points.filter((p, i) => !i || distance(p, points[i - 1]) > epsilon);
    if (vertices.length > 1 && distance(vertices[0], vertices.at(-1)) <= epsilon) vertices.pop();
    if (new Set(vertices.map(p => `${p.x},${p.y}`)).size < 3) return null;
    const twiceArea = vertices.reduce((sum, p, i) => { const q = vertices[(i + 1) % vertices.length]; return sum + p.x * q.y - q.x * p.y; }, 0);
    if (Math.abs(twiceArea) <= epsilon) return null;
    return { kind, points: vertices.map(p => ({ x: p.x, y: p.y })) };
  }
  if (!b) return null;
  if (kind === 'line') return distance(a, b) > epsilon ? { kind, start: { x: a.x, y: a.y }, end: { x: b.x, y: b.y } } : null;
  if (kind === 'circle' || kind === 'arc') {
    const radius = distance(a, b);
    if (radius <= epsilon) return null;
    if (kind === 'circle') return { kind, cx: a.x, cy: a.y, r: radius };
    if (!c || distance(a, c) <= epsilon) return null;
    const startAngle = Math.atan2(b.y - a.y, b.x - a.x), endAngle = Math.atan2(c.y - a.y, c.x - a.x);
    const angle = positive(sweep ? endAngle - startAngle : startAngle - endAngle);
    if (angle <= epsilon) return null;
    return { kind, cx: a.x, cy: a.y, rx: radius, ry: radius, rotation: 0, startAngle, endAngle, angle, sweep: sweep ? 1 : 0, largeArc: angle > Math.PI ? 1 : 0 };
  }
  const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y), width = Math.abs(b.x - a.x), height = Math.abs(b.y - a.y);
  if (width <= epsilon || height <= epsilon) return null;
  return kind === 'rectangle' ? { kind, x, y, width, height } : { kind, cx: x + width / 2, cy: y + height / 2, rx: width / 2, ry: height / 2 };
}
export function svgGeometry(g) {
  switch (g.kind) {
    case 'line': return { tag: 'line', attributes: { x1: g.start.x, y1: g.start.y, x2: g.end.x, y2: g.end.y } };
    case 'circle': return { tag: 'circle', attributes: { cx: g.cx, cy: g.cy, r: g.r } };
    case 'ellipse': return { tag: 'ellipse', attributes: { cx: g.cx, cy: g.cy, rx: g.rx, ry: g.ry } };
    case 'rectangle': return { tag: 'rect', attributes: { x: g.x, y: g.y, width: g.width, height: g.height } };
    case 'freehand': return { tag: 'polyline', attributes: { points: g.points.map(p => `${p.x},${p.y}`).join(' '), 'stroke-linecap': 'round', 'stroke-linejoin': 'round' } };
    case 'polygon': return { tag: 'polygon', attributes: { points: g.points.map(p => `${p.x},${p.y}`).join(' ') } };
    case 'arc': {
      const start = [g.cx + g.rx * Math.cos(g.startAngle), g.cy + g.ry * Math.sin(g.startAngle)];
      const end = [g.cx + g.rx * Math.cos(g.endAngle), g.cy + g.ry * Math.sin(g.endAngle)];
      return { tag: 'path', attributes: { d: `M ${start.join(' ')} A ${g.rx} ${g.ry} ${g.rotation} ${g.largeArc} ${g.sweep} ${end.join(' ')}` } };
    }
  }
}
export function geometryMeasurements(g) {
  switch (g.kind) {
    case 'freehand': return { length: g.points.reduce((sum, p, i) => sum + (i ? distance(g.points[i - 1], p) : 0), 0) };
    case 'line': return { length: distance(g.start, g.end) };
    case 'circle': return { radius: g.r, diameter: 2 * g.r, perimeter: tau * g.r, area: Math.PI * g.r ** 2 };
    case 'ellipse': return { majorAxis: 2 * Math.max(g.rx, g.ry), minorAxis: 2 * Math.min(g.rx, g.ry), area: Math.PI * g.rx * g.ry };
    case 'arc': return { radius: g.rx, length: g.rx * g.angle, angleDegrees: g.angle * 180 / Math.PI };
    case 'rectangle': return { width: g.width, height: g.height, perimeter: 2 * (g.width + g.height), area: g.width * g.height };
    case 'polygon': return {
      perimeter: g.points.reduce((sum, p, i) => sum + distance(p, g.points[(i + 1) % g.points.length]), 0),
      area: Math.abs(g.points.reduce((sum, p, i) => { const q = g.points[(i + 1) % g.points.length]; return sum + p.x * q.y - q.x * p.y; }, 0)) / 2
    };
  }
}
