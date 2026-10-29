// Native-pixel analysis shared by the session and worker. Masks are cached as row spans.
import { regionRow } from '../RasterAnalysis/PolygonStatistics.mjs';
import { pathContours } from '../SvgGeometry/PathContours.mjs';
import { filledRegion, clipping, regionMeasurements } from '../SvgGeometry/FilledRegion.mjs';
import { modelToPathD } from '../PanelInstances/EditorPanels/GraphicalEditors/SVGeditorComponents/BezierModel.mjs';
const identity = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
export const CURVE_TOLERANCE = 0.001;
export function alphabetic(index) {
  let label = ''; for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) label = String.fromCharCode(65 + (n - 1) % 26) + label;
  return label;
}
export function labelsFor(regions) {
  const labels = {}, counters = {};
  regions.filter(r => r.type === 'total').forEach((r, i) => { labels[r.id] = alphabetic(i); });
  for (const r of regions.filter(r => r.type === 'void')) labels[r.id] = `${labels[r.parentId] || '?'}-${counters[r.parentId] = (counters[r.parentId] || 0) + 1}`;
  return labels;
}
export function regionPath(region) {
  if (region.model) return modelToPathD(region.model);
  return region.points.map(([x, y], i) => `${i ? 'L' : 'M'} ${x} ${y}`).join(' ') + ' Z';
}
export function contoursFor(region) {
  if (region.model) {
    if (!region.model.closed || region.model.nodes.length < 3 || region.model.nodes.some(n => [n, n.inHandle, n.outHandle].filter(Boolean).some(p => !Number.isFinite(p.x) || !Number.isFinite(p.y)))) throw Error('Incomplete or invalid closed path');
    return pathContours(regionPath(region), identity, CURVE_TOLERANCE);
  }
  if (!Array.isArray(region.points) || region.points.length < 3 || region.points.some(p => p.length !== 2 || p.some(v => !Number.isFinite(v)))) throw Error('Incomplete or invalid polygon');
  return [{ points: region.points, closed: true }];
}
const area = shape => regionMeasurements(shape).area;
export function prepareRegion(region, width, height) {
  const contours = contoursFor(region), shape = filledRegion(contours, 'evenodd');
  if (!area(shape)) throw Error('Path has no enclosed area');
  const points = contours.flatMap(c => c.points);
  if (points.some(([x, y]) => x < 0 || y < 0 || x > width || y > height)) throw Error('Path extends outside the image');
  return { contours, shape };
}
export function assignParent(region, regions, width, height) {
  const child = prepareRegion(region, width, height).shape;
  const parents = regions.filter(r => r.type === 'total').filter(r => {
    try { return area(clipping.difference(child, prepareRegion(r, width, height).shape)) === 0; } catch { return false; }
  });
  return parents.length === 1 ? parents[0].id : null;
}
function bounds(contours) {
  let minX = Infinity, minY = Infinity, maxX = 0, maxY = 0;
  for (const c of contours) for (const [x, y] of c.points) { minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y); }
  return { minX, minY, maxX, maxY, x0: Math.max(0, Math.ceil(minX - .5)), y0: Math.max(0, Math.ceil(minY - .5)), x1: Math.ceil(maxX - .5), y1: Math.ceil(maxY - .5) };
}
export function measureContours(image, contours) {
  const b = bounds(contours), width = b.x1 - b.x0, spans = [], sum = [0, 0, 0, 0]; let count = 0;
  const shifted = contours.map(c => ({ points: c.points.map(([x, y]) => [x - b.x0, y]) }));
  for (let y = b.y0; y < b.y1; y++) {
    const row = new Uint8Array(width);
    for (const c of shifted) { const part = regionRow(c, y + .5, width); for (let x = 0; x < width; x++) row[x] ^= part[x]; }
    for (let x = 0; x < width;) {
      if (!row[x]) { x++; continue; }
      const start = x;
      while (x < width && row[x]) {
        const offset = (y * image.width + x + b.x0) * 4;
        for (let channel = 0; channel < 4; channel++) sum[channel] += image.data[offset + channel];
        count++; x++;
      }
      spans.push([y, start + b.x0, x + b.x0]);
    }
  }
  return { area: count, rgba: count ? sum.map(v => v / count) : null, spans };
}
export function unionSpans(measurements) {
  const spans = measurements.flatMap(m => m.spans).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  let count = 0, row = -1, end = -1;
  for (const [y, x0, x1] of spans) { if (y !== row) { row = y; end = -1; } count += Math.max(0, x1 - Math.max(end, x0)); end = Math.max(end, x1); }
  return count;
}
function boundsOverlap(a, b) {
  return a.extent.minX < b.extent.maxX && b.extent.minX < a.extent.maxX && a.extent.minY < b.extent.maxY && b.extent.minY < a.extent.maxY;
}
export function createMeasurementEngine(image) {
  const cache = new Map(); let computations = 0;
  return {
    analyze(regions) {
      const warnings = [], prepared = new Map(), results = [], labels = labelsFor(regions);
      const live = new Set(regions.map(r => r.id)); for (const id of cache.keys()) if (!live.has(id)) cache.delete(id);
      for (const region of regions) {
        try {
          const key = JSON.stringify([region.points, region.model]); let entry = cache.get(region.id);
          if (entry?.key !== key) {
            const p = prepareRegion(region, image.width, image.height);
            entry = { key, ...p, extent: bounds(p.contours), measurement: measureContours(image, p.contours) }; cache.set(region.id, entry); computations++;
          }
          prepared.set(region.id, entry);
          if (!entry.measurement.area) warnings.push(`${labels[region.id]}: no pixel centers enclosed`);
          const { spans, ...measurement } = entry.measurement;
          results.push({ id: region.id, type: region.type, parentId: region.parentId, label: labels[region.id], ...measurement });
        } catch (error) { warnings.push(`${labels[region.id]}: ${error.message}`); }
      }
      const totals = regions.filter(r => r.type === 'total'), voids = regions.filter(r => r.type === 'void');
      if (!totals.length) warnings.push('Draw at least one Total Area region');
      for (let i = 0; i < totals.length; i++) for (let j = 0; j < i; j++) {
        const a = prepared.get(totals[i].id), b = prepared.get(totals[j].id);
        if (a && b && boundsOverlap(a, b) && area(clipping.intersection(a.shape, b.shape)) > 0) warnings.push(`${labels[totals[i].id]} overlaps ${labels[totals[j].id]}`);
      }
      for (const child of voids) {
        const c = prepared.get(child.id), p = prepared.get(child.parentId);
        if (!p || !totals.some(r => r.id === child.parentId)) warnings.push(`${labels[child.id]}: select exactly one parent`);
        else if (c && area(clipping.difference(c.shape, p.shape)) > 0) warnings.push(`${labels[child.id]} extends outside its parent`);
        if (c) for (const other of totals.filter(r => r.id !== child.parentId)) {
          const o = prepared.get(other.id);
          if (o && boundsOverlap(c, o) && area(clipping.intersection(c.shape, o.shape)) > 0) warnings.push(`${labels[child.id]} overlaps another parent ${labels[other.id]}`);
        }
      }
      let totalArea = 0, voidArea = 0;
      for (const parent of results.filter(r => r.type === 'total')) {
        const children = voids.filter(r => r.parentId === parent.id).map(r => prepared.get(r.id)?.measurement).filter(Boolean);
        parent.voidArea = unionSpans(children); parent.voidPercentage = parent.area ? 100 * parent.voidArea / parent.area : null;
        totalArea += parent.area; voidArea += parent.voidArea;
      }
      return { regions: results, warnings, totalArea, voidArea, overallPercentage: totalArea ? 100 * voidArea / totalArea : null, computations };
    }
  };
}
