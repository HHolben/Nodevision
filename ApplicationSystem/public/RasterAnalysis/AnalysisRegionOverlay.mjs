// Nodevision/ApplicationSystem/public/RasterAnalysis/AnalysisRegionOverlay.mjs
// This module shades the ordered Boolean selection with an SVG mask while retaining polygon outlines for inspection. The mask belongs only to the viewer overlay and never becomes image content.
const ns = 'http://www.w3.org/2000/svg';
function element(name, attributes) {
  const node = document.createElementNS(ns, name);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value);
  return node;
}
export function paintAnalysisRegions(host, regions, width, height, id) {
  host.replaceChildren();
  if (!regions.length) return;
  const defs = element('defs', {}), mask = element('mask', { id, maskUnits: 'userSpaceOnUse', x: 0, y: 0, width, height, 'mask-type': 'luminance' });
  const outlines = element('g', { fill: 'none', stroke: 'currentColor' });
  for (const region of regions) {
    const points = region.points.map(p => p.join(',')).join(' ');
    mask.append(element('polygon', { points, fill: region.operation === 'subtract' ? 'black' : 'white', 'fill-rule': 'evenodd' }));
    const outline = element('polygon', { points, 'vector-effect': 'non-scaling-stroke', 'stroke-width': 1.5 });
    if (region.operation === 'subtract') outline.setAttribute('stroke-dasharray', '5 3');
    outlines.append(outline);
  }
  defs.append(mask);
  host.append(defs, element('rect', { width, height, fill: 'currentColor', 'fill-opacity': '.2', mask: `url(#${id})` }), outlines);
}
