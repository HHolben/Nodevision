// Nodevision/ApplicationSystem/public/VectorDrawing/VectorSvgRenderer.mjs
// This adapter renders shared geometry as native SVG elements and keeps unfinished previews separate from document content. Styles are supplied by each host's existing appearance settings.
import { svgGeometry } from './VectorGeometry.mjs';
export function createVectorElement(geometry, style = {}, doc = document) {
  const { tag, attributes } = svgGeometry(geometry);
  const node = doc.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [key, value] of Object.entries({ fill: 'none', stroke: 'currentColor', 'stroke-width': 1, ...style, ...attributes })) node.setAttribute(key, value);
  return node;
}
export function renderVectorPreview(host, geometry, points = []) {
  host.replaceChildren();
  if (geometry) host.append(createVectorElement(geometry, { 'vector-effect': 'non-scaling-stroke' }, host.ownerDocument));
  else if (points.length) {
    const node = host.ownerDocument.createElementNS('http://www.w3.org/2000/svg', 'polyline');
    for (const [key, value] of Object.entries({ points: points.map(p => `${p.x},${p.y}`).join(' '), fill: 'none', stroke: 'currentColor', 'vector-effect': 'non-scaling-stroke' })) node.setAttribute(key, value);
    host.append(node);
  }
}
