// Nodevision/ApplicationSystem/public/Sessions/ImageStitchingSession.mjs
// Translation-only image-grid stitching surface for Nodevision Sessions.
// Designed first for fixed-geometry X-ray / microscope / scanner mosaics.
// No external dependencies: Canvas 2D + downsampled normalized cross-correlation.

const STYLE_ID = "nv-image-stitching-session-styles";
const MAX_EXPORT_PIXELS = 100_000_000;
const MAX_EXPORT_SIDE = 32767;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function naturalCompare(a, b) {
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: "base" });
}

function make(tag, className = "", text = "") {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text) element.textContent = text;
  return element;
}

function ensureStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
.nv-image-stitcher {
  box-sizing: border-box;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  background: #e5e7eb;
  color: #111827;
  font: 14px system-ui, sans-serif;
}
.nv-image-stitcher * { box-sizing: border-box; }
.nv-image-stitcher-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 9px 12px;
  border-bottom: 1px solid #9ca3af;
  background: #f8fafc;
}
.nv-image-stitcher-header h1 {
  margin: 0;
  font-size: 15px;
  font-weight: 700;
}
.nv-image-stitcher-body {
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(280px, 340px) minmax(0, 1fr);
}
.nv-image-stitcher-controls {
  min-height: 0;
  overflow: auto;
  padding: 12px;
  border-right: 1px solid #9ca3af;
  background: #f8fafc;
}
.nv-image-stitcher-controls fieldset {
  min-width: 0;
  margin: 0 0 12px;
  padding: 10px;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  background: #fff;
}
.nv-image-stitcher-controls legend { padding: 0 5px; font-weight: 650; }
.nv-image-stitcher-row {
  display: grid;
  grid-template-columns: 1fr 92px;
  align-items: center;
  gap: 8px;
  margin: 7px 0;
}
.nv-image-stitcher-row input,
.nv-image-stitcher-row select {
  width: 100%;
  min-width: 0;
  padding: 5px 6px;
  border: 1px solid #94a3b8;
  border-radius: 4px;
  background: #fff;
  color: #111827;
}
.nv-image-stitcher-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
}
.nv-image-stitcher button {
  padding: 6px 9px;
  border: 1px solid #64748b;
  border-radius: 5px;
  background: #fff;
  color: #111827;
  cursor: pointer;
  font: inherit;
}
.nv-image-stitcher button:hover:not(:disabled) { background: #eef2f7; }
.nv-image-stitcher button:disabled { opacity: 0.5; cursor: default; }
.nv-image-stitcher-primary { font-weight: 700 !important; }
.nv-image-stitcher-note {
  margin: 7px 0 0;
  color: #475569;
  font-size: 12px;
  line-height: 1.4;
}
.nv-image-stitcher-status {
  min-height: 36px;
  margin-top: 9px;
  padding: 7px;
  border-radius: 4px;
  background: #eef2f7;
  color: #334155;
  white-space: pre-wrap;
}
.nv-image-stitcher-files {
  max-height: 190px;
  overflow: auto;
  margin: 8px 0 0;
  padding: 0;
  list-style: none;
  border: 1px solid #e2e8f0;
}
.nv-image-stitcher-files li {
  padding: 5px 7px;
  border-bottom: 1px solid #e2e8f0;
  font: 12px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  overflow-wrap: anywhere;
}
.nv-image-stitcher-files li:last-child { border-bottom: 0; }
.nv-image-stitcher-workspace {
  min-width: 0;
  min-height: 0;
  display: grid;
  grid-template-rows: minmax(0, 1fr) minmax(120px, 28vh);
  background: #1f2937;
}
.nv-image-stitcher-preview {
  position: relative;
  min-height: 0;
  overflow: auto;
  display: grid;
  place-items: center;
  padding: 16px;
  background-image:
    linear-gradient(45deg, #374151 25%, transparent 25%),
    linear-gradient(-45deg, #374151 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, #374151 75%),
    linear-gradient(-45deg, transparent 75%, #374151 75%);
  background-size: 24px 24px;
  background-position: 0 0, 0 12px, 12px -12px, -12px 0;
}
.nv-image-stitcher-preview canvas {
  max-width: none;
  max-height: none;
  background: #000;
  box-shadow: 0 4px 18px rgba(0,0,0,0.45);
  image-rendering: auto;
}
.nv-image-stitcher-report {
  min-height: 0;
  overflow: auto;
  padding: 10px 12px;
  border-top: 1px solid #111827;
  background: #f8fafc;
}
.nv-image-stitcher-report table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}
.nv-image-stitcher-report th,
.nv-image-stitcher-report td {
  padding: 4px 6px;
  text-align: left;
  border-bottom: 1px solid #e2e8f0;
}
.nv-image-stitcher-low { font-weight: 700; color: #b91c1c; }
.nv-image-stitcher-good { color: #166534; }
@media (max-width: 780px) {
  .nv-image-stitcher-body { grid-template-columns: 1fr; grid-template-rows: minmax(250px, 42vh) minmax(0, 1fr); }
  .nv-image-stitcher-controls { border-right: 0; border-bottom: 1px solid #9ca3af; }
}
`;
  document.head.appendChild(style);
}

function createSurface() {
  const surface = make("div", "nv-image-stitcher");
  const header = make("div", "nv-image-stitcher-header");
  const title = make("h1", "", "Image Stitching Session — translation-only grid mosaic");
  const finishButton = make("button", "", "Finish Session");
  header.append(title, finishButton);

  const body = make("div", "nv-image-stitcher-body");
  const controls = make("aside", "nv-image-stitcher-controls");
  const workspace = make("main", "nv-image-stitcher-workspace");
  const preview = make("div", "nv-image-stitcher-preview");
  const report = make("div", "nv-image-stitcher-report");
  report.appendChild(make("div", "", "Load a grid of overlapping images to begin."));
  workspace.append(preview, report);

  const sourceFieldset = document.createElement("fieldset");
  sourceFieldset.appendChild(make("legend", "", "Source images"));
  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.multiple = true;
  fileInput.accept = ".png,.jpg,.jpeg,.bmp,.webp,.tif,.tiff,image/*";
  sourceFieldset.appendChild(fileInput);
  sourceFieldset.appendChild(make(
    "p",
    "nv-image-stitcher-note",
    "Files are naturally sorted by filename. PNG/JPEG/BMP/WebP are safest in Chromium; TIFF decoding depends on the Chromium build."
  ));
  const fileList = make("ol", "nv-image-stitcher-files");
  sourceFieldset.appendChild(fileList);

  const gridFieldset = document.createElement("fieldset");
  gridFieldset.appendChild(make("legend", "", "Grid geometry"));
  const rowsInput = numberControl(gridFieldset, "Rows", 1, 1, 100, 1);
  const colsInput = numberControl(gridFieldset, "Columns", 1, 1, 100, 1);
  const overlapInput = numberControl(gridFieldset, "Expected overlap %", 20, 5, 80, 1);
  const traversalSelect = selectControl(gridFieldset, "Acquisition order", [
    ["row-major", "Rows: left → right"],
    ["snake", "Snake / serpentine"],
  ]);

  const alignmentFieldset = document.createElement("fieldset");
  alignmentFieldset.appendChild(make("legend", "", "Alignment"));
  const searchInput = numberControl(alignmentFieldset, "Search radius %", 6, 1, 20, 1);
  const workSizeSelect = selectControl(alignmentFieldset, "Working resolution", [
    ["256", "256 px max"],
    ["384", "384 px max"],
    ["512", "512 px max"],
  ], "384");
  alignmentFieldset.appendChild(make(
    "p",
    "nv-image-stitcher-note",
    "X/Y translation only. No rotation, scale, shear, perspective warp, exposure correction, or synthetic geometry correction is applied."
  ));

  const actionFieldset = document.createElement("fieldset");
  actionFieldset.appendChild(make("legend", "", "Mosaic"));
  const buttons = make("div", "nv-image-stitcher-buttons");
  const stitchButton = make("button", "nv-image-stitcher-primary", "Stitch");
  const exportButton = make("button", "", "Export PNG");
  const manifestButton = make("button", "", "Export layout JSON");
  exportButton.disabled = true;
  manifestButton.disabled = true;
  buttons.append(stitchButton, exportButton, manifestButton);
  const status = make("div", "nv-image-stitcher-status", "No images loaded.");
  actionFieldset.append(buttons, status);

  controls.append(sourceFieldset, gridFieldset, alignmentFieldset, actionFieldset);
  body.append(controls, workspace);
  surface.append(header, body);

  return {
    surface,
    finishButton,
    fileInput,
    fileList,
    rowsInput,
    colsInput,
    overlapInput,
    traversalSelect,
    searchInput,
    workSizeSelect,
    stitchButton,
    exportButton,
    manifestButton,
    status,
    preview,
    report,
  };
}

function numberControl(parent, labelText, value, min, max, step) {
  const row = make("label", "nv-image-stitcher-row");
  const label = make("span", "", labelText);
  const input = document.createElement("input");
  input.type = "number";
  input.value = String(value);
  input.min = String(min);
  input.max = String(max);
  input.step = String(step);
  row.append(label, input);
  parent.appendChild(row);
  return input;
}

function selectControl(parent, labelText, options, selected = null) {
  const row = make("label", "nv-image-stitcher-row");
  const label = make("span", "", labelText);
  const select = document.createElement("select");
  for (const [value, text] of options) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = text;
    if (selected !== null && value === selected) option.selected = true;
    select.appendChild(option);
  }
  row.append(label, select);
  parent.appendChild(row);
  return select;
}

async function decodeImage(file) {
  try {
    if (typeof createImageBitmap === "function") {
      const bitmap = await createImageBitmap(file);
      return { source: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close?.() };
    }
  } catch {
    // Fall through to HTMLImageElement. Chromium may decode some formats here that createImageBitmap rejects.
  }

  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.decoding = "async";
    image.src = url;
    await image.decode();
    return { source: image, width: image.naturalWidth, height: image.naturalHeight, close: () => null };
  } finally {
    URL.revokeObjectURL(url);
  }
}

function makeWorkingImage(decoded, maxDimension) {
  const scale = Math.min(1, maxDimension / Math.max(decoded.width, decoded.height));
  const width = Math.max(1, Math.round(decoded.width * scale));
  const height = Math.max(1, Math.round(decoded.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(decoded.source, 0, 0, width, height);
  const rgba = ctx.getImageData(0, 0, width, height).data;
  const gray = new Float32Array(width * height);
  for (let i = 0, p = 0; i < rgba.length; i += 4, p += 1) {
    gray[p] = rgba[i] * 0.2126 + rgba[i + 1] * 0.7152 + rgba[i + 2] * 0.0722;
  }
  return { width, height, gray, scaleX: width / decoded.width, scaleY: height / decoded.height };
}

function scoreOffset(a, b, dx, dy, sampleStride = 3) {
  const x0 = Math.max(0, dx);
  const y0 = Math.max(0, dy);
  const x1 = Math.min(a.width, dx + b.width);
  const y1 = Math.min(a.height, dy + b.height);
  const overlapWidth = x1 - x0;
  const overlapHeight = y1 - y0;
  if (overlapWidth < 8 || overlapHeight < 8) return -Infinity;

  let n = 0;
  let sumA = 0;
  let sumB = 0;
  let sumAA = 0;
  let sumBB = 0;
  let sumAB = 0;

  for (let y = y0; y < y1; y += sampleStride) {
    const ay = y * a.width;
    const by = (y - dy) * b.width;
    for (let x = x0; x < x1; x += sampleStride) {
      const av = a.gray[ay + x];
      const bv = b.gray[by + (x - dx)];
      n += 1;
      sumA += av;
      sumB += bv;
      sumAA += av * av;
      sumBB += bv * bv;
      sumAB += av * bv;
    }
  }

  if (n < 64) return -Infinity;
  const numerator = sumAB - (sumA * sumB) / n;
  const varianceA = sumAA - (sumA * sumA) / n;
  const varianceB = sumBB - (sumB * sumB) / n;
  const denominator = Math.sqrt(Math.max(0, varianceA) * Math.max(0, varianceB));
  if (denominator < 1e-9) return -Infinity;
  return numerator / denominator;
}

function searchOffset(a, b, expectedDx, expectedDy, radiusX, radiusY) {
  let best = { dx: expectedDx, dy: expectedDy, score: -Infinity };
  const coarseStep = Math.max(1, Math.round(Math.max(radiusX, radiusY) / 12));
  const sampleStride = Math.max(2, Math.round(Math.max(a.width, a.height) / 160));

  for (let dy = expectedDy - radiusY; dy <= expectedDy + radiusY; dy += coarseStep) {
    for (let dx = expectedDx - radiusX; dx <= expectedDx + radiusX; dx += coarseStep) {
      const score = scoreOffset(a, b, dx, dy, sampleStride);
      if (score > best.score) best = { dx, dy, score };
    }
  }

  const refineRadius = Math.max(2, coarseStep + 1);
  const refineStride = Math.max(1, Math.floor(sampleStride / 2));
  const startDx = best.dx;
  const startDy = best.dy;
  for (let dy = startDy - refineRadius; dy <= startDy + refineRadius; dy += 1) {
    for (let dx = startDx - refineRadius; dx <= startDx + refineRadius; dx += 1) {
      const score = scoreOffset(a, b, dx, dy, refineStride);
      if (score > best.score) best = { dx, dy, score };
    }
  }
  return best;
}

function mapImagesToGrid(images, rows, cols, traversal) {
  const grid = Array.from({ length: rows }, () => Array(cols).fill(null));
  let index = 0;
  for (let row = 0; row < rows; row += 1) {
    for (let sequenceCol = 0; sequenceCol < cols; sequenceCol += 1) {
      const col = traversal === "snake" && row % 2 === 1 ? cols - 1 - sequenceCol : sequenceCol;
      grid[row][col] = images[index++];
    }
  }
  return grid;
}

async function estimateEdges(grid, settings, onProgress) {
  const rows = grid.length;
  const cols = grid[0].length;
  const edges = [];
  const total = rows * Math.max(0, cols - 1) + cols * Math.max(0, rows - 1);
  let completed = 0;

  const alignPair = async (from, to, orientation) => {
    const a = from.work;
    const b = to.work;
    const overlap = settings.overlap;
    const search = settings.search;
    const horizontal = orientation === "horizontal";
    const expectedDx = horizontal ? Math.round(a.width * (1 - overlap)) : 0;
    const expectedDy = horizontal ? 0 : Math.round(a.height * (1 - overlap));
    const radiusX = Math.max(2, Math.round(a.width * search));
    const radiusY = Math.max(2, Math.round(a.height * search));
    const match = searchOffset(a, b, expectedDx, expectedDy, radiusX, radiusY);
    const fullDx = match.dx / a.scaleX;
    const fullDy = match.dy / a.scaleY;
    const confidence = clamp(Number.isFinite(match.score) ? match.score : 0, 0, 1);
    edges.push({
      from: from.index,
      to: to.index,
      orientation,
      dx: fullDx,
      dy: fullDy,
      confidence,
      fromName: from.file.name,
      toName: to.file.name,
    });
    completed += 1;
    onProgress?.(completed, total, edges[edges.length - 1]);
    await new Promise((resolve) => setTimeout(resolve, 0));
  };

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols - 1; col += 1) {
      await alignPair(grid[row][col], grid[row][col + 1], "horizontal");
    }
  }
  for (let row = 0; row < rows - 1; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      await alignPair(grid[row][col], grid[row + 1][col], "vertical");
    }
  }
  return edges;
}

function solveLinearSystem(matrix, vector) {
  const n = vector.length;
  const a = matrix.map((row, i) => [...row, vector[i]]);
  for (let col = 0; col < n; col += 1) {
    let pivot = col;
    for (let row = col + 1; row < n; row += 1) {
      if (Math.abs(a[row][col]) > Math.abs(a[pivot][col])) pivot = row;
    }
    if (Math.abs(a[pivot][col]) < 1e-10) continue;
    [a[col], a[pivot]] = [a[pivot], a[col]];
    const divisor = a[col][col];
    for (let j = col; j <= n; j += 1) a[col][j] /= divisor;
    for (let row = 0; row < n; row += 1) {
      if (row === col) continue;
      const factor = a[row][col];
      if (Math.abs(factor) < 1e-12) continue;
      for (let j = col; j <= n; j += 1) a[row][j] -= factor * a[col][j];
    }
  }
  return a.map((row) => Number.isFinite(row[n]) ? row[n] : 0);
}

function solveGlobalPositions(images, edges) {
  const n = images.length;
  const laplacian = Array.from({ length: n }, () => Array(n).fill(0));
  const bx = Array(n).fill(0);
  const by = Array(n).fill(0);

  for (const edge of edges) {
    const i = edge.from;
    const j = edge.to;
    const weight = Math.max(0.05, edge.confidence * edge.confidence);
    laplacian[i][i] += weight;
    laplacian[j][j] += weight;
    laplacian[i][j] -= weight;
    laplacian[j][i] -= weight;
    bx[i] -= weight * edge.dx;
    bx[j] += weight * edge.dx;
    by[i] -= weight * edge.dy;
    by[j] += weight * edge.dy;
  }

  // Anchor the first tile at the origin to remove the graph's translational degree of freedom.
  laplacian[0][0] += 1_000_000;
  const xs = solveLinearSystem(laplacian.map((row) => [...row]), [...bx]);
  const ys = solveLinearSystem(laplacian.map((row) => [...row]), [...by]);
  let minX = Infinity;
  let minY = Infinity;
  for (let i = 0; i < n; i += 1) {
    minX = Math.min(minX, xs[i]);
    minY = Math.min(minY, ys[i]);
  }
  return images.map((image, i) => ({
    index: image.index,
    x: xs[i] - minX,
    y: ys[i] - minY,
  }));
}

function computeBounds(images, positions) {
  let width = 1;
  let height = 1;
  for (const position of positions) {
    const image = images[position.index];
    width = Math.max(width, Math.ceil(position.x + image.decoded.width));
    height = Math.max(height, Math.ceil(position.y + image.decoded.height));
  }
  return { width, height };
}

function renderMosaic(images, positions, targetMaxDimension = null) {
  const bounds = computeBounds(images, positions);
  const scale = targetMaxDimension
    ? Math.min(1, targetMaxDimension / Math.max(bounds.width, bounds.height))
    : 1;
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bounds.width * scale));
  canvas.height = Math.max(1, Math.round(bounds.height * scale));
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingEnabled = scale < 1;

  // Hard compositing is intentional for metrology/inspection imagery: the stitcher does not
  // disguise disagreement by warping geometry or inventing exposure-corrected seam pixels.
  for (const position of positions) {
    const image = images[position.index];
    ctx.drawImage(
      image.decoded.source,
      Math.round(position.x * scale),
      Math.round(position.y * scale),
      Math.round(image.decoded.width * scale),
      Math.round(image.decoded.height * scale)
    );
  }
  return { canvas, bounds, scale };
}

function buildManifest(images, grid, positions, edges, settings) {
  const bounds = computeBounds(images, positions);
  const gridIndices = grid.map((row) => row.map((image) => image.index));
  return {
    format: "NodevisionImageMosaicLayout",
    version: 1,
    createdAt: new Date().toISOString(),
    model: "translation-only",
    purpose: "planar-grid-stitching",
    settings: {
      rows: settings.rows,
      columns: settings.cols,
      traversal: settings.traversal,
      expectedOverlapPercent: settings.overlap * 100,
      searchRadiusPercent: settings.search * 100,
      workingMaxDimension: settings.workSize,
    },
    bounds,
    grid: gridIndices,
    images: images.map((image) => {
      const position = positions.find((entry) => entry.index === image.index);
      return {
        index: image.index,
        fileName: image.file.name,
        width: image.decoded.width,
        height: image.decoded.height,
        x: position.x,
        y: position.y,
      };
    }),
    alignments: edges.map((edge) => ({ ...edge })),
  };
}

function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function canvasToBlob(canvas, type = "image/png") {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Canvas export failed.")), type);
  });
}

function showReport(container, edges) {
  container.replaceChildren();
  const heading = make("strong", "", `Neighbor alignments (${edges.length})`);
  container.appendChild(heading);
  if (!edges.length) return;
  const table = document.createElement("table");
  const thead = document.createElement("thead");
  const headerRow = document.createElement("tr");
  for (const label of ["Pair", "Direction", "ΔX", "ΔY", "Correlation"]) {
    headerRow.appendChild(make("th", "", label));
  }
  thead.appendChild(headerRow);
  const tbody = document.createElement("tbody");
  for (const edge of edges) {
    const row = document.createElement("tr");
    const confidenceClass = edge.confidence < 0.55 ? "nv-image-stitcher-low" : "nv-image-stitcher-good";
    const values = [
      `${edge.fromName} → ${edge.toName}`,
      edge.orientation,
      edge.dx.toFixed(2),
      edge.dy.toFixed(2),
      edge.confidence.toFixed(3),
    ];
    values.forEach((value, index) => row.appendChild(make("td", index === 4 ? confidenceClass : "", value)));
    tbody.appendChild(row);
  }
  table.append(thead, tbody);
  container.appendChild(table);
}

function inferGrid(count) {
  if (count <= 1) return { rows: 1, cols: Math.max(1, count) };
  let cols = Math.ceil(Math.sqrt(count));
  while (cols > 1 && count % cols !== 0) cols -= 1;
  if (cols === 1) cols = Math.ceil(Math.sqrt(count));
  return { rows: Math.ceil(count / cols), cols };
}

async function loadFiles(files, workMax, onStatus) {
  const sorted = [...files].sort((a, b) => naturalCompare(a.name, b.name));
  const images = [];
  for (let i = 0; i < sorted.length; i += 1) {
    const file = sorted[i];
    onStatus?.(`Decoding ${i + 1}/${sorted.length}: ${file.name}`);
    let decoded;
    try {
      decoded = await decodeImage(file);
    } catch (error) {
      throw new Error(`Could not decode ${file.name}. If it is TIFF, export PNG/BMP from the acquisition software or add a TIFF decoder dependency. (${error?.message || error})`);
    }
    images.push({
      index: i,
      file,
      decoded,
      work: makeWorkingImage(decoded, workMax),
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  return images;
}

function closeImages(images) {
  for (const image of images || []) image.decoded?.close?.();
}

function validateSameDimensions(images) {
  if (!images.length) return;
  const width = images[0].decoded.width;
  const height = images[0].decoded.height;
  const mismatch = images.find((image) => image.decoded.width !== width || image.decoded.height !== height);
  if (mismatch) {
    throw new Error(
      `Translation-only X-ray grid mode currently requires equal tile dimensions. ` +
      `${images[0].file.name} is ${width}×${height}; ${mismatch.file.name} is ${mismatch.decoded.width}×${mismatch.decoded.height}.`
    );
  }
}

export async function startImageStitchingSession(context = {}) {
  ensureStyles();
  const root = document.getElementById("nv-session-root") || document.body;
  root.replaceChildren();
  const ui = createSurface();
  root.appendChild(ui.surface);

  let images = [];
  let result = null;
  let busy = false;
  let finished = false;

  const setBusy = (value) => {
    busy = value;
    ui.fileInput.disabled = value;
    ui.stitchButton.disabled = value;
    ui.exportButton.disabled = value || !result;
    ui.manifestButton.disabled = value || !result;
  };

  const setStatus = (message) => { ui.status.textContent = message; };

  const refreshFileList = () => {
    ui.fileList.replaceChildren();
    for (const image of images) {
      ui.fileList.appendChild(make("li", "", `${image.file.name} — ${image.decoded.width}×${image.decoded.height}`));
    }
  };

  const rebuildWorkingCopies = () => {
    const maxDimension = Number(ui.workSizeSelect.value) || 384;
    for (const image of images) image.work = makeWorkingImage(image.decoded, maxDimension);
  };

  const loadSelectedFiles = async () => {
    if (busy) return;
    const files = [...(ui.fileInput.files || [])];
    if (!files.length) return;
    setBusy(true);
    result = null;
    ui.preview.replaceChildren();
    ui.report.replaceChildren(make("div", "", "Loading images…"));
    closeImages(images);
    images = [];
    try {
      const workMax = Number(ui.workSizeSelect.value) || 384;
      images = await loadFiles(files, workMax, setStatus);
      validateSameDimensions(images);
      refreshFileList();
      const inferred = inferGrid(images.length);
      ui.rowsInput.value = String(inferred.rows);
      ui.colsInput.value = String(inferred.cols);
      setStatus(`${images.length} images loaded. Set the grid dimensions/order, then choose Stitch.`);
      ui.report.replaceChildren(make("div", "", "Ready to align neighboring tiles."));
    } catch (error) {
      closeImages(images);
      images = [];
      refreshFileList();
      setStatus(`Error: ${error?.message || error}`);
      ui.report.replaceChildren(make("div", "nv-image-stitcher-low", error?.message || String(error)));
    } finally {
      setBusy(false);
    }
  };

  const stitch = async () => {
    if (busy) return;
    if (!images.length) {
      setStatus("Choose at least two overlapping images first.");
      return;
    }
    const rows = Math.max(1, Number(ui.rowsInput.value) || 1);
    const cols = Math.max(1, Number(ui.colsInput.value) || 1);
    if (rows * cols !== images.length) {
      setStatus(`Grid is ${rows}×${cols} = ${rows * cols} cells, but ${images.length} images are loaded.`);
      return;
    }
    if (images.length < 2) {
      setStatus("At least two images are required for stitching.");
      return;
    }

    const settings = {
      rows,
      cols,
      overlap: clamp((Number(ui.overlapInput.value) || 20) / 100, 0.05, 0.8),
      traversal: ui.traversalSelect.value,
      search: clamp((Number(ui.searchInput.value) || 6) / 100, 0.01, 0.2),
      workSize: Number(ui.workSizeSelect.value) || 384,
    };

    setBusy(true);
    result = null;
    ui.preview.replaceChildren();
    try {
      rebuildWorkingCopies();
      const grid = mapImagesToGrid(images, rows, cols, settings.traversal);
      const edges = await estimateEdges(grid, settings, (completed, total, edge) => {
        setStatus(
          `Aligning ${completed}/${total}: ${edge.fromName} → ${edge.toName}\n` +
          `ΔX ${edge.dx.toFixed(1)} px, ΔY ${edge.dy.toFixed(1)} px, correlation ${edge.confidence.toFixed(3)}`
        );
      });
      const positions = solveGlobalPositions(images, edges);
      const previewRender = renderMosaic(images, positions, 1800);
      ui.preview.replaceChildren(previewRender.canvas);
      showReport(ui.report, edges);
      const manifest = buildManifest(images, grid, positions, edges, settings);
      result = { settings, grid, edges, positions, manifest, bounds: previewRender.bounds };
      window.NodevisionImageStitcherLastResult = manifest;
      const weak = edges.filter((edge) => edge.confidence < 0.55).length;
      setStatus(
        `Stitch complete: ${previewRender.bounds.width}×${previewRender.bounds.height} px mosaic.` +
        (weak ? ` ${weak} low-confidence neighbor alignment${weak === 1 ? "" : "s"} flagged below.` : " All neighbor correlations are above 0.55.")
      );
    } catch (error) {
      setStatus(`Stitch failed: ${error?.message || error}`);
      ui.report.replaceChildren(make("div", "nv-image-stitcher-low", error?.message || String(error)));
    } finally {
      setBusy(false);
    }
  };

  const exportPng = async () => {
    if (!result || busy) return;
    const { width, height } = result.bounds;
    if (width > MAX_EXPORT_SIDE || height > MAX_EXPORT_SIDE || width * height > MAX_EXPORT_PIXELS) {
      setStatus(
        `Full-resolution export would be ${width}×${height} (${(width * height / 1_000_000).toFixed(1)} MP), ` +
        `which exceeds this prototype's conservative browser-canvas export limit. The layout JSON remains exportable.`
      );
      return;
    }
    setBusy(true);
    try {
      setStatus(`Rendering full-resolution ${width}×${height} PNG…`);
      await new Promise((resolve) => setTimeout(resolve, 0));
      const rendered = renderMosaic(images, result.positions, null);
      const blob = await canvasToBlob(rendered.canvas, "image/png");
      downloadBlob(blob, "Nodevision_Image_Mosaic.png");
      setStatus(`Exported ${width}×${height} PNG. Original source files were not modified.`);
    } catch (error) {
      setStatus(`PNG export failed: ${error?.message || error}`);
    } finally {
      setBusy(false);
    }
  };

  const exportManifest = () => {
    if (!result || busy) return;
    const blob = new Blob([JSON.stringify(result.manifest, null, 2) + "\n"], { type: "application/json" });
    downloadBlob(blob, "Nodevision_Image_Mosaic.layout.json");
    setStatus("Exported non-destructive mosaic layout JSON.");
  };

  const finish = () => {
    if (finished) return;
    finished = true;
    const payload = result
      ? { ok: true, cancelled: false, imageCount: images.length, manifest: result.manifest }
      : { ok: false, cancelled: true, imageCount: images.length };
    context.executionContext?.emit?.("session.imageStitcher.finished", payload);
  };

  ui.fileInput.addEventListener("change", loadSelectedFiles);
  ui.stitchButton.addEventListener("click", stitch);
  ui.exportButton.addEventListener("click", exportPng);
  ui.manifestButton.addEventListener("click", exportManifest);
  ui.finishButton.addEventListener("click", finish);

  context.executionContext?.addCleanup?.(() => {
    closeImages(images);
    ui.surface.remove();
  });

  setStatus("Choose overlapping images captured at fixed geometry. For XT V 160 use, keep magnification, Z, tilt, kV/current, detector geometry, and image processing constant across all tiles.");
  return { ok: true };
}

// Small pure-function surface for future regression tests without making the runtime depend on a test framework.
export const __imageStitchingTest = Object.freeze({
  inferGrid,
  mapImagesToGrid,
  solveLinearSystem,
  solveGlobalPositions,
  computeBounds,
  scoreOffset,
  searchOffset,
});
