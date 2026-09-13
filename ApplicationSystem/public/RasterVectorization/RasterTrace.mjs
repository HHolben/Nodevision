// Nodevision/ApplicationSystem/public/RasterVectorization/RasterTrace.mjs
// This module traces cleaned binary raster masks into coherent component contours. It preserves source pixel membership for color analysis and emits closed SVG paths with evenodd holes instead of scanline rectangles.

function neighbors(width, height, p) {
  const x = p % width, y = Math.floor(p / width), out = [];
  if (x > 0) out.push(p - 1);
  if (x + 1 < width) out.push(p + 1);
  if (y > 0) out.push(p - width);
  if (y + 1 < height) out.push(p + width);
  return out;
}

function connectedComponents(mask, width, height, minFeatureSize) {
  const seen = new Uint8Array(mask.length), kept = new Uint8Array(mask.length), labels = new Int32Array(mask.length), components = [];
  for (let start = 0; start < mask.length; start += 1) {
    if (!mask[start] || seen[start]) continue;
    const queue = [start], pixels = [];
    let minX = width, minY = height, maxX = 0, maxY = 0;
    seen[start] = 1;
    for (let q = 0; q < queue.length; q += 1) {
      const p = queue[q], x = p % width, y = Math.floor(p / width);
      pixels.push(p); minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
      for (const n of neighbors(width, height, p)) if (mask[n] && !seen[n]) { seen[n] = 1; queue.push(n); }
    }
    if (pixels.length >= minFeatureSize) {
      const id = components.length + 1;
      pixels.forEach((p) => { kept[p] = 1; labels[p] = id; });
      components.push({ id, minX, minY, maxX: maxX + 1, maxY: maxY + 1, pixels, pixelCount: pixels.length });
    }
  }
  return { mask: kept, labels, components };
}

function key(point) { return point.x + "," + point.y; }
function addEdge(edges, a, b) {
  const k = key(a);
  if (!edges.has(k)) edges.set(k, []);
  edges.get(k).push(b);
}

function componentEdges(component, labels, width, height) {
  const edges = new Map(), id = component.id;
  for (const p of component.pixels) {
    const x = p % width, y = Math.floor(p / width);
    if (y === 0 || labels[p - width] !== id) addEdge(edges, { x, y }, { x: x + 1, y });
    if (x + 1 >= width || labels[p + 1] !== id) addEdge(edges, { x: x + 1, y }, { x: x + 1, y: y + 1 });
    if (y + 1 >= height || labels[p + width] !== id) addEdge(edges, { x: x + 1, y: y + 1 }, { x, y: y + 1 });
    if (x === 0 || labels[p - 1] !== id) addEdge(edges, { x, y: y + 1 }, { x, y });
  }
  return edges;
}

function popEdge(edges, k) {
  const list = edges.get(k);
  if (!list?.length) return null;
  const next = list.pop();
  if (!list.length) edges.delete(k);
  return next;
}

function traceLoops(edges) {
  const loops = [];
  while (edges.size) {
    const startKey = edges.keys().next().value, start = startKey.split(",").map(Number);
    const first = { x: start[0], y: start[1] }, loop = [first];
    let current = first, guard = 0;
    while (guard < 100000) {
      guard += 1;
      const next = popEdge(edges, key(current));
      if (!next) break;
      loop.push(next); current = next;
      if (current.x === first.x && current.y === first.y) break;
    }
    if (loop.length > 3) loops.push(loop);
  }
  return loops;
}

function perpendicularDistance(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const len = dx * dx + dy * dy;
  if (!len) return Math.hypot(p.x - a.x, p.y - a.y);
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

function rdp(points, epsilon) {
  if (points.length <= 2) return points;
  let index = 0, max = 0;
  for (let i = 1; i < points.length - 1; i += 1) {
    const d = perpendicularDistance(points[i], points[0], points[points.length - 1]);
    if (d > max) { max = d; index = i; }
  }
  if (max <= epsilon) return [points[0], points[points.length - 1]];
  return rdp(points.slice(0, index + 1), epsilon).slice(0, -1).concat(rdp(points.slice(index), epsilon));
}

function signedArea(points) {
  let area = 0;
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i], b = points[(i + 1) % points.length];
    area += a.x * b.y - b.x * a.y;
  }
  return area / 2;
}

function simplifyLoop(loop, options) {
  const points = loop.slice(0, -1);
  if (points.length <= 4) return points;
  const epsilon = 0.35 + options.simplification / 14 + (100 - options.detail) / 35;
  const mid = Math.floor(points.length / 2);
  const a = rdp(points.slice(0, mid + 1), epsilon);
  const b = rdp(points.slice(mid).concat(points[0]), epsilon);
  const out = a.slice(0, -1).concat(b.slice(0, -1));
  return out.length >= 3 ? out : points;
}

function loopPath(points, curved) {
  if (!points.length) return "";
  let d = "M" + points[0].x + " " + points[0].y;
  let i = 1;
  while (i < points.length) {
    const p = points[i], prev = points[i - 1], next = points[(i + 1) % points.length];
    const turn = Math.abs((p.x - prev.x) * (next.y - p.y) - (p.y - prev.y) * (next.x - p.x));
    if (curved && turn <= 2 && i + 1 < points.length) { d += "C" + p.x + " " + p.y + " " + p.x + " " + p.y + " " + next.x + " " + next.y; i += 2; }
    else { d += "L" + p.x + " " + p.y; i += 1; }
  }
  return d + "Z";
}

function componentPath(component, labels, width, height, options) {
  const loops = traceLoops(componentEdges(component, labels, width, height)).map((loop) => simplifyLoop(loop, options));
  loops.sort((a, b) => Math.abs(signedArea(b)) - Math.abs(signedArea(a)));
  const curved = options.simplification < 75;
  return { d: loops.map((loop) => loopPath(loop, curved)).join(""), loops, fill: "#000", fillRule: loops.length > 1 ? "evenodd" : "nonzero", pixels: component.pixels, rect: { x: component.minX, y: component.minY, w: component.maxX - component.minX, h: component.maxY - component.minY } };
}

function rectangleLike(path) {
  return path.loops?.length === 1 && path.loops[0].length === 4;
}

export function traceMaskToPaths(mask, width, height, options) {
  const filtered = connectedComponents(mask, width, height, Math.max(1, options.minFeatureSize));
  const paths = filtered.components.map((component) => componentPath(component, filtered.labels, width, height, options)).filter((path) => path.d);
  return { paths, rects: [], mask: filtered.mask, components: filtered.components, nodeCount: paths.reduce((sum, path) => sum + path.loops.reduce((n, loop) => n + loop.length, 0), 0), rectanglePaths: paths.filter(rectangleLike).length };
}
