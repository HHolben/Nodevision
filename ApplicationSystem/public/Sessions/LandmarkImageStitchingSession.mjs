// Nodevision/ApplicationSystem/public/Sessions/LandmarkImageStitchingSession.mjs
// Landmark-based image-grid stitching surface for Nodevision Sessions and the PNG editor.

import {
  buildStitchManifest,
  clamp,
  computeMosaicBounds,
  estimatePairRegistration,
  extractFeatures,
  getGridNeighborPairs,
  inferGrid,
  mapItemsToGrid,
  naturalCompare,
  offsetTransformsToBounds,
  solveTransformsFromEdges,
} from "/ImageStitching/ImageStitchingCore.mjs";

const STYLE_ID = "nv-landmark-image-stitching-styles";
const MAX_EXPORT_PIXELS = 100_000_000;
const MAX_EXPORT_SIDE = 32767;

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
.nv-image-stitcher { box-sizing:border-box; position:relative; display:grid; grid-template-rows:auto minmax(0,1fr); width:100%; height:100%; overflow:hidden; background:#f2f5f3; color:#17201b; font:14px system-ui,sans-serif; }
.nv-image-stitcher * { box-sizing:border-box; }
.nv-image-stitcher-overlay { position:fixed; inset:32px; z-index:10040; width:auto; height:auto; border:1px solid #748078; box-shadow:0 18px 60px rgba(0,0,0,0.28); }
.nv-image-stitcher-backdrop { position:fixed; inset:0; z-index:10039; background:rgba(11,16,13,0.46); }
.nv-image-stitcher-header { display:flex; align-items:center; justify-content:space-between; gap:12px; padding:9px 12px; border-bottom:1px solid #a8b0aa; background:#fff; }
.nv-image-stitcher-header h1 { margin:0; font-size:15px; font-weight:700; }
.nv-image-stitcher-body { min-height:0; display:grid; grid-template-columns:minmax(290px,360px) minmax(0,1fr); }
.nv-image-stitcher-controls { min-height:0; overflow:auto; padding:12px; border-right:1px solid #a8b0aa; background:#fbfcfb; }
.nv-image-stitcher-controls fieldset { min-width:0; margin:0 0 12px; padding:10px; border:1px solid #cbd5cf; border-radius:6px; background:#fff; }
.nv-image-stitcher-controls legend { padding:0 5px; font-weight:650; }
.nv-image-stitcher-row { display:grid; grid-template-columns:1fr 86px; align-items:center; gap:8px; margin:7px 0; }
.nv-image-stitcher-row input, .nv-image-stitcher-row select { width:100%; min-width:0; padding:5px 6px; border:1px solid #94a3a0; border-radius:4px; background:#fff; color:#17201b; }
.nv-image-stitcher-buttons { display:flex; flex-wrap:wrap; gap:7px; }
.nv-image-stitcher button { padding:6px 9px; border:1px solid #64746c; border-radius:5px; background:#fff; color:#17201b; cursor:pointer; font:inherit; }
.nv-image-stitcher button:hover:not(:disabled) { background:#edf4ef; }
.nv-image-stitcher button:disabled { opacity:0.5; cursor:default; }
.nv-image-stitcher-primary { font-weight:700 !important; border-color:#256448 !important; }
.nv-image-stitcher-note { margin:7px 0 0; color:#52635a; font-size:12px; line-height:1.4; }
.nv-image-stitcher-status { min-height:44px; margin-top:9px; padding:7px; border-radius:4px; background:#edf4ef; color:#334139; white-space:pre-wrap; }
.nv-image-stitcher-grid { display:grid; gap:8px; align-items:stretch; margin-top:8px; }
.nv-image-stitcher-tile { min-width:0; min-height:92px; display:grid; grid-template-rows:minmax(70px,1fr) auto; border:1px solid #b9c4bd; border-radius:6px; background:#f8faf9; overflow:hidden; }
.nv-image-stitcher-tile[draggable="true"] { cursor:grab; }
.nv-image-stitcher-tile.is-selected { outline:2px solid #2b7a55; }
.nv-image-stitcher-tile canvas { width:100%; height:100%; background:#18201b; object-fit:contain; }
.nv-image-stitcher-tile span { padding:4px 6px; font:11px ui-monospace,SFMono-Regular,Menlo,Consolas,monospace; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.nv-image-stitcher-workspace { min-width:0; min-height:0; display:grid; grid-template-rows:minmax(0,1fr) minmax(128px,26vh); background:#29312d; }
.nv-image-stitcher-preview { position:relative; min-height:0; overflow:auto; display:grid; place-items:center; padding:16px; background:#29312d; }
.nv-image-stitcher-preview canvas { max-width:none; max-height:none; background:transparent; box-shadow:0 4px 18px rgba(0,0,0,0.42); }
.nv-image-stitcher-report { min-height:0; overflow:auto; padding:10px 12px; border-top:1px solid #111827; background:#fbfcfb; }
.nv-image-stitcher-report table { width:100%; border-collapse:collapse; font-size:12px; }
.nv-image-stitcher-report th, .nv-image-stitcher-report td { padding:4px 6px; text-align:left; border-bottom:1px solid #e2e8e3; }
.nv-image-stitcher-low { font-weight:700; color:#b91c1c; }
.nv-image-stitcher-good { color:#166534; }
@media (max-width:840px) { .nv-image-stitcher-overlay { inset:8px; } .nv-image-stitcher-body { grid-template-columns:1fr; grid-template-rows:minmax(320px,48vh) minmax(0,1fr); } .nv-image-stitcher-controls { border-right:0; border-bottom:1px solid #a8b0aa; } }
`;
  document.head.appendChild(style);
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

function createSurface({ overlay = false } = {}) {
  const backdrop = overlay ? make("div", "nv-image-stitcher-backdrop") : null;
  const surface = make("div", `nv-image-stitcher${overlay ? " nv-image-stitcher-overlay" : ""}`);
  const header = make("div", "nv-image-stitcher-header");
  header.append(make("h1", "", "Image Stitching"), make("button", "", overlay ? "Cancel" : "Finish Session"));
  const closeButton = header.lastChild;

  const body = make("div", "nv-image-stitcher-body");
  const controls = make("aside", "nv-image-stitcher-controls");
  const workspace = make("main", "nv-image-stitcher-workspace");
  const preview = make("div", "nv-image-stitcher-preview");
  const report = make("div", "nv-image-stitcher-report");
  report.appendChild(make("div", "", "Add overlapping photographs and arrange their neighbor relationships."));
  workspace.append(preview, report);

  const sourceFieldset = document.createElement("fieldset");
  sourceFieldset.appendChild(make("legend", "", "Source images"));
  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.multiple = true;
  fileInput.accept = ".png,.jpg,.jpeg,.bmp,.webp,image/*";
  sourceFieldset.appendChild(fileInput);
  const sourceButtons = make("div", "nv-image-stitcher-buttons");
  const removeButton = make("button", "", "Remove");
  const resetButton = make("button", "", "Reset Alignment");
  sourceButtons.append(removeButton, resetButton);
  sourceFieldset.append(sourceButtons, make("p", "nv-image-stitcher-note", "Drag tiles to arrange rows and columns. The grid limits matching to likely neighbors; it does not set overlap."));

  const gridFieldset = document.createElement("fieldset");
  gridFieldset.appendChild(make("legend", "", "Grid"));
  const rowsInput = numberControl(gridFieldset, "Rows", 1, 1, 40, 1);
  const colsInput = numberControl(gridFieldset, "Columns", 1, 1, 40, 1);
  const tileGrid = make("div", "nv-image-stitcher-grid");
  gridFieldset.appendChild(tileGrid);

  const alignmentFieldset = document.createElement("fieldset");
  alignmentFieldset.appendChild(make("legend", "", "Alignment"));
  const workSizeSelect = selectControl(alignmentFieldset, "Feature copy", [["320", "320 px max"], ["480", "480 px max"], ["640", "640 px max"], ["800", "800 px max"]], "480");
  const showMatchesRow = make("label", "nv-image-stitcher-row");
  const showMatches = document.createElement("input");
  showMatches.type = "checkbox";
  showMatchesRow.append(make("span", "", "Show Matches"), showMatches);
  alignmentFieldset.append(showMatchesRow, make("p", "nv-image-stitcher-note", "Uses Harris corner landmarks, normalized patch descriptors, reciprocal descriptor matching, and affine RANSAC."));

  const manualFieldset = document.createElement("fieldset");
  manualFieldset.appendChild(make("legend", "", "Manual landmarks"));
  const pairSelect = selectControl(manualFieldset, "Pair", []);
  const manualButtons = make("div", "nv-image-stitcher-buttons");
  const manualModeButton = make("button", "", "Add Manual Match");
  const clearManualButton = make("button", "", "Clear Manual");
  manualButtons.append(manualModeButton, clearManualButton);
  manualFieldset.append(manualButtons, make("p", "nv-image-stitcher-note", "Choose a pair, then click the same landmark in each tile. Manual points are optional fallback constraints."));

  const actionFieldset = document.createElement("fieldset");
  actionFieldset.appendChild(make("legend", "", "Mosaic"));
  const actionButtons = make("div", "nv-image-stitcher-buttons");
  const stitchButton = make("button", "nv-image-stitcher-primary", "Auto Stitch");
  const retryButton = make("button", "", "Retry");
  const applyButton = make("button", "", "Apply");
  const exportButton = make("button", "", "Export PNG");
  const manifestButton = make("button", "", "Export Layout JSON");
  applyButton.disabled = true;
  exportButton.disabled = true;
  manifestButton.disabled = true;
  actionButtons.append(stitchButton, retryButton, applyButton, exportButton, manifestButton);
  const status = make("div", "nv-image-stitcher-status", "No images loaded.");
  actionFieldset.append(actionButtons, status);

  controls.append(sourceFieldset, gridFieldset, alignmentFieldset, manualFieldset, actionFieldset);
  body.append(controls, workspace);
  surface.append(header, body);
  return { backdrop, surface, closeButton, fileInput, removeButton, resetButton, rowsInput, colsInput, tileGrid, workSizeSelect, showMatches, pairSelect, manualModeButton, clearManualButton, stitchButton, retryButton, applyButton, exportButton, manifestButton, status, preview, report };
}

async function decodeImage(file) {
  try {
    if (typeof createImageBitmap === "function") {
      const bitmap = await createImageBitmap(file);
      return { source: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close?.() };
    }
  } catch {
    // Fall through to HTMLImageElement.
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
  const data = ctx.getImageData(0, 0, width, height).data;
  const gray = new Float32Array(width * height);
  for (let i = 0, p = 0; p < gray.length; i += 4, p += 1) {
    gray[p] = (data[i] * 0.2126 + data[i + 1] * 0.7152 + data[i + 2] * 0.0722) / 255;
  }
  return { width, height, gray, scaleX: width / decoded.width, scaleY: height / decoded.height };
}

function thumbnailImageRect(canvas, image) {
  const scale = Math.min(canvas.width / image.decoded.width, canvas.height / image.decoded.height);
  const width = image.decoded.width * scale;
  const height = image.decoded.height * scale;
  return { x: (canvas.width - width) / 2, y: (canvas.height - height) / 2, width, height, scale };
}

function drawTileThumbnail(canvas, image) {
  canvas.width = 220;
  canvas.height = 130;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#17201b";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!image?.decoded?.source) return;
  const rect = thumbnailImageRect(canvas, image);
  ctx.drawImage(image.decoded.source, rect.x, rect.y, rect.width, rect.height);
}

function closeImages(images) {
  for (const image of images || []) image.decoded?.close?.();
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
  return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Canvas export failed.")), type));
}

function transformForCanvas(matrix, bounds, scale) {
  return [matrix[0] * scale, matrix[1] * scale, matrix[2] * scale, matrix[3] * scale, (matrix[4] - bounds.minX) * scale, (matrix[5] - bounds.minY) * scale];
}

function renderMosaic(images, transforms, { targetMaxDimension = null, showBoundaries = true, showMatches = false, edges = [] } = {}) {
  const bounds = computeMosaicBounds(images, transforms);
  const scale = targetMaxDimension ? Math.min(1, targetMaxDimension / Math.max(bounds.width, bounds.height)) : 1;
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bounds.width * scale));
  canvas.height = Math.max(1, Math.round(bounds.height * scale));
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingEnabled = scale < 1;
  for (const entry of transforms) {
    if (!entry.matrix) continue;
    const image = images[entry.index];
    ctx.save();
    ctx.setTransform(...transformForCanvas(entry.matrix, bounds, scale));
    ctx.globalAlpha = 0.86;
    ctx.drawImage(image.decoded.source, 0, 0);
    ctx.restore();
  }
  if (showBoundaries) {
    ctx.lineWidth = Math.max(1, 2 * scale);
    ctx.strokeStyle = "rgba(255,255,255,0.9)";
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.font = `${Math.max(10, 13 * scale)}px system-ui, sans-serif`;
    for (const entry of transforms) {
      if (!entry.matrix) continue;
      const image = images[entry.index];
      ctx.save();
      ctx.setTransform(...transformForCanvas(entry.matrix, bounds, scale));
      ctx.strokeRect(0, 0, image.decoded.width, image.decoded.height);
      ctx.fillText(String(entry.index + 1), 7, 16);
      ctx.restore();
    }
  }
  if (showMatches) drawMatchDiagnostics(ctx, images, transforms, bounds, scale, edges);
  return { canvas, bounds, scale };
}

function drawMatchDiagnostics(ctx, images, transforms, bounds, scale, edges) {
  const byIndex = new Map(transforms.map((entry) => [entry.index, entry]));
  ctx.lineWidth = Math.max(1, 1.5 * scale);
  for (const edge of edges) {
    if (!edge.ok) continue;
    const from = byIndex.get(edge.from);
    const to = byIndex.get(edge.to);
    if (!from?.matrix || !to?.matrix) continue;
    for (const match of (edge.workInliers || []).slice(0, 80)) {
      const pa = diagnosticPoint(from.matrix, match.a, images[edge.from], bounds, scale);
      const pb = diagnosticPoint(to.matrix, match.b, images[edge.to], bounds, scale);
      ctx.strokeStyle = "rgba(24,195,132,0.72)";
      ctx.beginPath();
      ctx.moveTo(pa.x, pa.y);
      ctx.lineTo(pb.x, pb.y);
      ctx.stroke();
      ctx.fillStyle = "rgba(255,255,255,0.92)";
      ctx.fillRect(pa.x - 2, pa.y - 2, 4, 4);
      ctx.fillRect(pb.x - 2, pb.y - 2, 4, 4);
    }
  }
}

function diagnosticPoint(matrix, point, image, bounds, scale) {
  const x = point.x / (image.work?.scaleX || 1);
  const y = point.y / (image.work?.scaleY || 1);
  return {
    x: (matrix[0] * x + matrix[2] * y + matrix[4] - bounds.minX) * scale,
    y: (matrix[1] * x + matrix[3] * y + matrix[5] - bounds.minY) * scale,
  };
}

async function loadFiles(files, existingCount, workMax, onStatus) {
  const sorted = [...files].sort((a, b) => naturalCompare(a.name, b.name));
  const loaded = [];
  for (let i = 0; i < sorted.length; i += 1) {
    const file = sorted[i];
    onStatus?.(`Decoding ${i + 1}/${sorted.length}: ${file.name}`);
    const decoded = await decodeImage(file);
    const work = makeWorkingImage(decoded, workMax);
    loaded.push({
      index: existingCount + loaded.length,
      file,
      fileName: file.name,
      decoded,
      width: decoded.width,
      height: decoded.height,
      work,
      workScale: { x: work.scaleX, y: work.scaleY },
      workMax,
      features: extractFeatures({ width: work.width, height: work.height, gray: work.gray }, { maxKeypoints: 540, minDistance: 8, patchRadius: 5 }),
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  return loaded;
}

function edgeKey(from, to) {
  return `${Math.min(from, to)}:${Math.max(from, to)}`;
}

function refreshImageFeatures(image, workMax) {
  if (image.workMax === workMax && image.features?.length) return;
  const work = makeWorkingImage(image.decoded, workMax);
  image.work = work;
  image.workScale = { x: work.scaleX, y: work.scaleY };
  image.workMax = workMax;
  image.features = extractFeatures({ width: work.width, height: work.height, gray: work.gray }, { maxKeypoints: 540, minDistance: 8, patchRadius: 5 });
}

function refreshAllImageFeatures(images, workMax) {
  for (const image of images) refreshImageFeatures(image, workMax);
}

async function estimateEdges(images, grid, manualMatches, onProgress) {
  const pairs = getGridNeighborPairs(grid);
  const edges = [];
  for (let i = 0; i < pairs.length; i += 1) {
    const pair = pairs[i];
    const from = images[pair.from];
    const to = images[pair.to];
    const manual = manualMatches.get(edgeKey(pair.from, pair.to)) || [];
    const registration = estimatePairRegistration(
      { ...from, work: { width: from.work.width, height: from.work.height, gray: from.work.gray } },
      { ...to, work: { width: to.work.width, height: to.work.height, gray: to.work.gray } },
      {
        manualMatches: manual.map((match) => ({ a: { x: match.a.x * from.work.scaleX, y: match.a.y * from.work.scaleY }, b: { x: match.b.x * to.work.scaleX, y: match.b.y * to.work.scaleY } })),
        matching: { ratio: 0.8, maxMatches: 280 },
        ransac: { minimumMatches: manual.length >= 3 ? 3 : 8, threshold: 4, confidenceThreshold: manual.length >= 3 ? 0.28 : 0.42 },
      },
    );
    const edge = { ...pair, ...registration, fromName: from.fileName, toName: to.fileName, manualMatches: manual.length };
    edges.push(edge);
    onProgress?.(i + 1, pairs.length, edge);
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  return edges;
}

function showReport(container, edges, transforms) {
  container.replaceChildren();
  const resolved = transforms.filter((entry) => entry.resolved).length;
  container.appendChild(make("strong", "", `Neighbor alignments (${edges.length}); resolved images ${resolved}/${transforms.length}`));
  if (!edges.length) return;
  const table = document.createElement("table");
  const head = document.createElement("tr");
  for (const label of ["Pair", "Direction", "Status", "Confidence", "Matches", "Inliers"]) head.appendChild(make("th", "", label));
  const thead = document.createElement("thead");
  thead.appendChild(head);
  const tbody = document.createElement("tbody");
  for (const edge of edges) {
    const ok = Boolean(edge.ok);
    const row = document.createElement("tr");
    [`${edge.fromName} -> ${edge.toName}`, edge.direction, ok ? "matched" : `unresolved: ${edge.reason}`, (edge.confidence || 0).toFixed(3), String(edge.matches?.length || 0), String(edge.workInliers?.length || 0)]
      .forEach((value, index) => row.appendChild(make("td", index === 2 ? (ok ? "nv-image-stitcher-good" : "nv-image-stitcher-low") : "", value)));
    tbody.appendChild(row);
  }
  table.append(thead, tbody);
  container.appendChild(table);
}

export async function startLandmarkImageStitchingSession(context = {}) {
  ensureStyles();
  const overlay = Boolean(context.overlay || context.asOverlay || context.editorApi);
  const root = overlay ? document.body : (document.getElementById("nv-session-root") || document.body);
  if (!overlay) root.replaceChildren();
  const ui = createSurface({ overlay });
  if (ui.backdrop) root.appendChild(ui.backdrop);
  root.appendChild(ui.surface);

  let images = [];
  let selectedIndex = null;
  let dragIndex = null;
  let result = null;
  let busy = false;
  let finished = false;
  let cleanedUp = false;
  let manualMode = null;
  const manualMatches = new Map();

  const setStatus = (message) => { ui.status.textContent = message; };
  const setBusy = (value) => {
    busy = value;
    ui.fileInput.disabled = value;
    ui.stitchButton.disabled = value;
    ui.retryButton.disabled = value;
    ui.applyButton.disabled = value || !result || !context.editorApi;
    ui.exportButton.disabled = value || !result;
    ui.manifestButton.disabled = value || !result;
  };
  const resetResult = () => {
    result = null;
    ui.applyButton.disabled = true;
    ui.exportButton.disabled = true;
    ui.manifestButton.disabled = true;
    ui.preview.replaceChildren();
    ui.report.replaceChildren(make("div", "", "Ready to align neighboring photographs."));
  };
  const currentRows = () => Math.max(1, Math.floor(Number(ui.rowsInput.value) || 1));
  const currentCols = () => Math.max(1, Math.floor(Number(ui.colsInput.value) || 1));
  const currentGrid = () => mapItemsToGrid(images, currentRows(), currentCols());

  const refreshPairSelect = () => {
    const value = ui.pairSelect.value;
    ui.pairSelect.replaceChildren();
    for (const pair of getGridNeighborPairs(currentGrid())) {
      const option = document.createElement("option");
      option.value = `${pair.from}:${pair.to}`;
      option.textContent = `${images[pair.from]?.fileName || pair.from + 1} -> ${images[pair.to]?.fileName || pair.to + 1}`;
      ui.pairSelect.appendChild(option);
    }
    if (value && [...ui.pairSelect.options].some((option) => option.value === value)) ui.pairSelect.value = value;
  };

  const refreshGrid = () => {
    const rows = currentRows();
    const cols = currentCols();
    ui.tileGrid.style.gridTemplateColumns = `repeat(${cols}, minmax(0, 1fr))`;
    ui.tileGrid.replaceChildren();
    for (let index = 0; index < rows * cols; index += 1) {
      const image = images[index] || null;
      const tile = make("div", "nv-image-stitcher-tile");
      if (image) {
        tile.draggable = true;
        tile.dataset.index = String(index);
        if (selectedIndex === index) tile.classList.add("is-selected");
        const canvas = document.createElement("canvas");
        drawTileThumbnail(canvas, image);
        tile.append(canvas, make("span", "", `${index + 1}. ${image.fileName}`));
        tile.addEventListener("click", (event) => handleTileClick(index, event));
        tile.addEventListener("dragstart", () => { dragIndex = index; });
        tile.addEventListener("dragover", (event) => event.preventDefault());
        tile.addEventListener("drop", (event) => {
          event.preventDefault();
          if (dragIndex === null || dragIndex === index) return;
          const [moved] = images.splice(dragIndex, 1);
          images.splice(index, 0, moved);
          images.forEach((entry, nextIndex) => { entry.index = nextIndex; });
          selectedIndex = index;
          dragIndex = null;
          manualMatches.clear();
          resetResult();
          refreshGrid();
        });
      } else {
        tile.appendChild(make("span", "", "Empty"));
      }
      ui.tileGrid.appendChild(tile);
    }
    refreshPairSelect();
  };

  const handleTileClick = (index, event) => {
    if (!manualMode) {
      selectedIndex = index;
      refreshGrid();
      return;
    }
    const [from, to] = ui.pairSelect.value.split(":").map((value) => Number(value));
    if (![from, to].includes(index)) {
      setStatus("Manual match mode: click one of the two selected pair images.");
      return;
    }
    const canvas = event.currentTarget.querySelector("canvas");
    const rect = canvas.getBoundingClientRect();
    const image = images[index];
    const drawn = thumbnailImageRect(canvas, image);
    const cssScaleX = rect.width / Math.max(1, canvas.width);
    const cssScaleY = rect.height / Math.max(1, canvas.height);
    const canvasX = (event.clientX - rect.left) / Math.max(0.0001, cssScaleX);
    const canvasY = (event.clientY - rect.top) / Math.max(0.0001, cssScaleY);
    const point = {
      x: clamp((canvasX - drawn.x) / Math.max(1, drawn.width), 0, 1) * image.decoded.width,
      y: clamp((canvasY - drawn.y) / Math.max(1, drawn.height), 0, 1) * image.decoded.height,
    };
    if (!manualMode.first) {
      manualMode.first = { index, point };
      setStatus(`Manual match: selected Image ${index + 1}. Click the corresponding point in the other image.`);
      return;
    }
    if (manualMode.first.index === index) {
      setStatus("Manual match: second point must be in the other image of the pair.");
      return;
    }
    const list = manualMatches.get(edgeKey(from, to)) || [];
    list.push(manualMode.first.index === from ? { a: manualMode.first.point, b: point } : { a: point, b: manualMode.first.point });
    manualMatches.set(edgeKey(from, to), list);
    manualMode = { first: null };
    resetResult();
    setStatus(`Added manual landmark ${list.length} for the selected pair. Add at least 3, then retry.`);
  };

  const loadSelectedFiles = async () => {
    if (busy) return;
    const files = [...(ui.fileInput.files || [])];
    if (!files.length) return;
    setBusy(true);
    resetResult();
    try {
      const loaded = await loadFiles(files, images.length, Number(ui.workSizeSelect.value) || 480, setStatus);
      images.push(...loaded);
      images.forEach((entry, index) => { entry.index = index; });
      const inferred = inferGrid(images.length);
      ui.rowsInput.value = String(inferred.rows);
      ui.colsInput.value = String(inferred.cols);
      refreshGrid();
      setStatus(`${images.length} images loaded. Arrange the grid, then choose Auto Stitch.`);
    } catch (error) {
      setStatus(`Error: ${error?.message || error}`);
      ui.report.replaceChildren(make("div", "nv-image-stitcher-low", error?.message || String(error)));
    } finally {
      ui.fileInput.value = "";
      setBusy(false);
    }
  };

  const removeSelected = () => {
    if (selectedIndex === null || !images[selectedIndex]) return;
    const [removed] = images.splice(selectedIndex, 1);
    removed?.decoded?.close?.();
    images.forEach((entry, index) => { entry.index = index; });
    selectedIndex = images.length ? Math.min(selectedIndex, images.length - 1) : null;
    manualMatches.clear();
    resetResult();
    refreshGrid();
    setStatus("Removed selected image. Manual landmarks were cleared because image indices changed.");
  };

  const stitch = async () => {
    if (busy) return;
    if (images.length < 2) {
      setStatus("Choose at least two overlapping images first.");
      return;
    }
    if (currentRows() * currentCols() < images.length) {
      setStatus("Grid has fewer cells than loaded images. Increase rows or columns.");
      return;
    }
    setBusy(true);
    result = null;
    ui.preview.replaceChildren();
    try {
      refreshAllImageFeatures(images, Number(ui.workSizeSelect.value) || 480);
      const grid = currentGrid();
      const edges = await estimateEdges(images, grid, manualMatches, (completed, total, edge) => {
        const state = edge.ok ? "matched" : `unresolved (${edge.reason})`;
        setStatus(`Aligning ${completed}/${total}: ${edge.fromName} -> ${edge.toName}\n${state}; confidence ${(edge.confidence || 0).toFixed(3)}`);
      });
      const transforms = solveTransformsFromEdges(images, edges, { referenceIndex: Math.floor(images.length / 2) });
      const shiftedTransforms = offsetTransformsToBounds(transforms, computeMosaicBounds(images, transforms));
      const bounds = computeMosaicBounds(images, shiftedTransforms);
      const previewRender = renderMosaic(images, shiftedTransforms, { targetMaxDimension: 1800, showBoundaries: true, showMatches: ui.showMatches.checked, edges });
      ui.preview.replaceChildren(previewRender.canvas);
      showReport(ui.report, edges, shiftedTransforms);
      const manifest = buildStitchManifest({ images, grid, edges, transforms: shiftedTransforms, bounds });
      result = { grid, edges, transforms: shiftedTransforms, bounds, manifest };
      window.NodevisionImageStitcherLastResult = manifest;
      const unresolvedEdges = edges.filter((edge) => !edge.ok).length;
      const unresolvedImages = shiftedTransforms.filter((entry) => !entry.resolved).length;
      setStatus(`Stitch preview ready: ${bounds.width}x${bounds.height} px.` +
        (unresolvedEdges ? ` ${unresolvedEdges} neighbor pair${unresolvedEdges === 1 ? "" : "s"} unresolved.` : " All neighbor pairs matched.") +
        (unresolvedImages ? ` ${unresolvedImages} image${unresolvedImages === 1 ? "" : "s"} could not be placed.` : ""));
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
      setStatus(`Full-resolution export would be ${width}x${height} (${(width * height / 1_000_000).toFixed(1)} MP), above the browser export limit.`);
      return;
    }
    setBusy(true);
    try {
      const rendered = renderMosaic(images, result.transforms, { targetMaxDimension: null, showBoundaries: false });
      downloadBlob(await canvasToBlob(rendered.canvas, "image/png"), "Nodevision_Image_Mosaic.png");
      setStatus(`Exported ${width}x${height} PNG. Source files were not modified.`);
    } catch (error) {
      setStatus(`PNG export failed: ${error?.message || error}`);
    } finally {
      setBusy(false);
    }
  };

  const applyToEditor = async () => {
    if (!result || busy || !context.editorApi?.replaceCanvasContents) return;
    const { width, height } = result.bounds;
    if (width > MAX_EXPORT_SIDE || height > MAX_EXPORT_SIDE || width * height > MAX_EXPORT_PIXELS) {
      setStatus(`Apply would create ${width}x${height} pixels, above the browser canvas limit.`);
      return;
    }
    setBusy(true);
    try {
      const rendered = renderMosaic(images, result.transforms, { targetMaxDimension: null, showBoundaries: false });
      context.editorApi.replaceCanvasContents(rendered.canvas, { pushHistory: true, statusMessage: "Applied stitched image" });
      finish({ applied: true });
    } catch (error) {
      setStatus(`Apply failed: ${error?.message || error}`);
    } finally {
      setBusy(false);
    }
  };

  const exportManifest = () => {
    if (!result || busy) return;
    downloadBlob(new Blob([JSON.stringify(result.manifest, null, 2) + "\n"], { type: "application/json" }), "Nodevision_Image_Mosaic.layout.json");
    setStatus("Exported non-destructive mosaic layout JSON.");
  };

  function cleanup() {
    if (cleanedUp) return;
    cleanedUp = true;
    closeImages(images);
    ui.surface.remove();
    ui.backdrop?.remove();
  }

  function finish(extra = {}) {
    if (finished) return;
    finished = true;
    const payload = result
      ? { ok: true, cancelled: false, imageCount: images.length, manifest: result.manifest, ...extra }
      : { ok: false, cancelled: !extra.applied, imageCount: images.length, ...extra };
    context.executionContext?.emit?.("session.imageStitcher.finished", payload);
    cleanup();
  }

  ui.fileInput.addEventListener("change", loadSelectedFiles);
  ui.removeButton.addEventListener("click", removeSelected);
  ui.resetButton.addEventListener("click", () => { resetResult(); setStatus("Alignment reset. Source images remain loaded."); });
  ui.rowsInput.addEventListener("change", () => { resetResult(); refreshGrid(); });
  ui.colsInput.addEventListener("change", () => { resetResult(); refreshGrid(); });
  ui.showMatches.addEventListener("change", () => {
    if (!result) return;
    ui.preview.replaceChildren(renderMosaic(images, result.transforms, { targetMaxDimension: 1800, showBoundaries: true, showMatches: ui.showMatches.checked, edges: result.edges }).canvas);
  });
  ui.manualModeButton.addEventListener("click", () => {
    if (!ui.pairSelect.value) {
      setStatus("Arrange at least one neighboring pair before adding manual landmarks.");
      return;
    }
    manualMode = { first: null };
    setStatus("Manual match mode: click a landmark in one image of the selected pair.");
  });
  ui.clearManualButton.addEventListener("click", () => {
    if (ui.pairSelect.value) manualMatches.delete(edgeKey(...ui.pairSelect.value.split(":").map((value) => Number(value))));
    resetResult();
    setStatus("Cleared manual landmarks for the selected pair.");
  });
  ui.stitchButton.addEventListener("click", stitch);
  ui.retryButton.addEventListener("click", stitch);
  ui.applyButton.addEventListener("click", applyToEditor);
  ui.exportButton.addEventListener("click", exportPng);
  ui.manifestButton.addEventListener("click", exportManifest);
  ui.closeButton.addEventListener("click", () => finish({ cancelled: true }));
  ui.backdrop?.addEventListener("click", () => finish({ cancelled: true }));

  context.executionContext?.addCleanup?.(cleanup);
  refreshGrid();
  setStatus(context.editorApi ? "Add source photographs. Apply will replace the current PNG editor canvas only after preview." : "Add source photographs and arrange their grid before stitching.");
  return { ok: true };
}

export async function startImageStitchingSession(context = {}) {
  return startLandmarkImageStitchingSession(context);
}
