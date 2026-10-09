// Nodevision/ApplicationSystem/public/RasterAnalysis/PolygonStatistics.mjs
// This module measures polygon selections in original image pixels using even-odd scanline coverage. Boolean operations are ordered, secondary overlaps are counted once, and color averages weight RGB by alpha while retaining transparent pixels in area measurements.
function rasterRow(points, y, width) {
  const crossings = [], row = new Uint8Array(width);
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [ax, ay] = points[j], [bx, by] = points[i];
    if ((ay > y) !== (by > y)) crossings.push(ax + (y - ay) * (bx - ax) / (by - ay));
  }
  crossings.sort((a, b) => a - b);
  for (let i = 0; i + 1 < crossings.length; i += 2) {
    row.fill(1, Math.max(0, Math.ceil(crossings[i] - .5)), Math.min(width, Math.max(0, Math.ceil(crossings[i + 1] - .5))));
  }
  return row;
}
export function polygonStatistics({ width, height, data }, regions) {
  const overlaps = regions.slice(1).map(() => 0), affected = [...overlaps];
  let original = 0, selected = 0, secondary = 0, retained = 0, alpha = 0;
  const rgb = [0, 0, 0];
  if (!regions.length) return null;
  for (let y = 0; y < height; y++) {
    const base = rasterRow(regions[0].points, y + .5, width), result = base.slice(), covered = new Uint8Array(width);
    for (let r = 1; r < regions.length; r++) {
      const row = rasterRow(regions[r].points, y + .5, width), add = regions[r].operation === 'add';
      for (let x = 0; x < width; x++) if (row[x]) {
        if (base[x]) { overlaps[r - 1]++; covered[x] = 1; }
        if (result[x] !== Number(add)) affected[r - 1]++;
        result[x] = Number(add);
      }
    }
    for (let x = 0; x < width; x++) {
      original += base[x]; secondary += covered[x]; retained += base[x] && result[x] ? 1 : 0;
      if (!result[x]) continue;
      selected++;
      const offset = (y * width + x) * 4, a = data[offset + 3];
      alpha += a;
      for (let c = 0; c < 3; c++) rgb[c] += data[offset + c] * a;
    }
  }
  return { original, selected, secondary, overlaps, affected, added: selected - retained, removed: original - retained,
    percentage: original ? secondary / original * 100 : null,
    rgb: alpha ? rgb.map(value => Math.round(value / alpha)) : null, alpha: selected ? alpha / selected / 255 : null };
}
