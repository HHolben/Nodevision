// Nodevision/ApplicationSystem/public/PanelInstances/InfoPanels/HandwritingOcrPanel.mjs
// This file defines browser-side Handwriting Ocr Panel logic for the Nodevision UI. It renders interface components and handles user interactions.
//
// Uses local Tesseract.js assets from /Tesseract. For fully offline OCR you must provide
// language data (e.g. eng.traineddata.gz) under /Tesseract/lang-data.

import { createFloatingInventoryPanel } from "/PanelInstances/InfoPanels/PlayerInventory.mjs";

const PANEL_KEY = "__nvHandwritingOcrPanel";
const DEFAULT_BG = "#0f1826";
const DEFAULT_FG = "#ffffff";

function clamp(num, min, max) {
  const n = Number(num);
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}

function safeText(value) {
  return String(value ?? "").replace(/\u0000/g, "");
}

function makeButton(label, opts = {}) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.textContent = label;
  btn.className = opts.primary ? "nv-ocr-btn primary" : "nv-ocr-btn";
  if (opts.title) btn.title = opts.title;
  return btn;
}

function injectStylesOnce() {
  if (document.getElementById("nv-ocr-style")) return;
  const style = document.createElement("style");
  style.id = "nv-ocr-style";
  style.textContent = `
    .nv-ocr-wrap { display: flex; flex-direction: column; gap: 8px; min-height: 0; height: 100%; color: #eaf7ff; }
    .nv-ocr-header { display:flex; gap: 10px; align-items: baseline; flex-wrap: wrap; flex: 0 0 auto; }
    .nv-ocr-note { opacity: 0.85; font-size: 12px; }
    .nv-ocr-board { display:flex; flex-direction: column; gap: 8px; min-height: 0; flex: 1 1 auto; padding: 10px; border: 1px solid rgba(70, 96, 135, 0.65); background: rgba(12, 18, 28, 0.85); }
    .nv-ocr-toolbar { display:flex; gap: 8px; align-items:center; flex-wrap: wrap; min-width: 0; }
    .nv-ocr-seg { display:inline-flex; border: 1px solid rgba(75, 102, 140, 0.9); overflow: hidden; }
    .nv-ocr-seg button { border: none; border-right: 1px solid rgba(75, 102, 140, 0.9); background: rgba(18, 32, 52, 0.92); }
    .nv-ocr-seg button:last-child { border-right: none; }
    .nv-ocr-seg button.active { background: #2b72ff; }
    .nv-ocr-btn { border: 1px solid rgba(75, 102, 140, 0.9); background: rgba(18, 32, 52, 0.92); color: #eaf7ff; padding: 7px 10px; border-radius: 6px; cursor: pointer; font-weight: 650; }
    .nv-ocr-btn.primary { background: #2b72ff; border-color: #2b72ff; color: #ffffff; }
    .nv-ocr-btn:disabled { opacity: 0.6; cursor: not-allowed; }
    .nv-ocr-label { opacity: 0.9; font-size: 12px; display: inline-flex; align-items: center; gap: 6px; }
    .nv-ocr-range { width: min(140px, 30vw); min-width: 86px; }
    .nv-ocr-spacer { flex: 1; }
    .nv-ocr-canvas { width: 100%; flex: 1 1 auto; min-height: 180px; height: clamp(190px, 38vh, 440px); border-radius: 6px; border: 1px dashed rgba(115, 145, 190, 0.85); background: ${DEFAULT_BG}; touch-action: none; }
    .nv-ocr-progress { height: 10px; background: rgba(16, 28, 46, 0.85); border: 1px solid rgba(75, 102, 140, 0.65); border-radius: 7px; overflow: hidden; }
    .nv-ocr-bar { height: 100%; width: 0%; background: #2b72ff; transition: width 0.18s ease; }
    .nv-ocr-out { display:grid; gap: 6px; flex: 0 0 auto; }
    .nv-ocr-textarea { width: 100%; min-height: 78px; max-height: 22vh; box-sizing: border-box; padding: 10px; border-radius: 6px; border: 1px solid rgba(75, 102, 140, 0.9); background: rgba(10, 18, 32, 0.92); color: #eaf7ff; resize: vertical; }
    .nv-ocr-help { opacity: 0.75; font-size: 12px; line-height: 1.35; }
    .nv-ocr-status { min-height: 16px; font-size: 12px; opacity: 0.82; }
    .nv-ocr-wrap input[type="checkbox"] { margin: 0; }
    @media (max-width: 620px) {
      .nv-ocr-board { padding: 8px; }
      .nv-ocr-toolbar { gap: 6px; }
      .nv-ocr-btn { padding: 6px 8px; }
      .nv-ocr-canvas { min-height: 220px; height: 44vh; }
      .nv-ocr-range { width: 96px; }
    }
  `;
  document.head.appendChild(style);
}

function getDpr() {
  return Math.max(1, window.devicePixelRatio || 1);
}

function fillCanvas(ctx, canvas, color) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.restore();
}

function binarizeCanvas(sourceCanvas, threshold) {
  const sourceCtx = sourceCanvas.getContext("2d", { willReadFrequently: true });
  const source = sourceCtx.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height);
  const d = source.data;
  const t = clamp(threshold, 0, 255);
  let minX = sourceCanvas.width;
  let minY = sourceCanvas.height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < sourceCanvas.height; y += 1) {
    for (let x = 0; x < sourceCanvas.width; x += 1) {
      const i = (y * sourceCanvas.width + x) * 4;
      const gray = d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;
      if (gray > t) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX < minX || maxY < minY) {
    const blank = document.createElement("canvas");
    blank.width = 64;
    blank.height = 64;
    const bctx = blank.getContext("2d");
    bctx.fillStyle = "#ffffff";
    bctx.fillRect(0, 0, blank.width, blank.height);
    return blank;
  }

  const cropW = maxX - minX + 1;
  const cropH = maxY - minY + 1;
  const scale = cropH < 160 ? 3 : (cropH < 280 ? 2 : 1);
  const pad = 32;
  const off = document.createElement("canvas");
  off.width = Math.max(1, Math.ceil((cropW + pad * 2) * scale));
  off.height = Math.max(1, Math.ceil((cropH + pad * 2) * scale));
  const octx = off.getContext("2d", { willReadFrequently: true });
  octx.imageSmoothingEnabled = true;
  octx.fillStyle = DEFAULT_BG;
  octx.fillRect(0, 0, off.width, off.height);
  octx.drawImage(
    sourceCanvas,
    minX,
    minY,
    cropW,
    cropH,
    pad * scale,
    pad * scale,
    cropW * scale,
    cropH * scale
  );

  const img = octx.getImageData(0, 0, off.width, off.height);
  const out = img.data;
  for (let i = 0; i < out.length; i += 4) {
    const gray = out[i] * 0.299 + out[i + 1] * 0.587 + out[i + 2] * 0.114;
    const v = gray > t ? 0 : 255;
    out[i] = v;
    out[i + 1] = v;
    out[i + 2] = v;
    out[i + 3] = 255;
  }

  octx.putImageData(img, 0, 0);
  return off;
}


async function ensureTesseract() {
  const mod = await import("/Tesseract/tesseract.esm.min.js");
  return mod?.default || mod;
}

function describeOfflineRequirement() {
  return "Offline OCR requires language data at /Tesseract/lang-data (e.g. eng.traineddata.gz).";
}

export function mountHandwritingOcrPanel(container, {
  onInsertText = null,
  onLiveText = null,
  liveInsert = true,
  title = "Handwriting -> Text"
} = {}) {
  injectStylesOnce();

  let worker = null;
  let workerPromise = null;
  let nativeRecognizer = null;
  let nativeRecognizerPromise = null;
  let liveTimer = 0;
  let preloadTimer = 0;
  let recognizing = false;
  let queuedRecognition = false;
  let hasInk = false;
  let lastLiveText = "";
  let lastLiveScheduleAt = 0;

  const root = document.createElement("div");
  root.className = "nv-ocr-wrap";

  const header = document.createElement("div");
  header.className = "nv-ocr-header";
  const note = document.createElement("div");
  note.className = "nv-ocr-note";
  note.textContent = "Write in the box. Recognition updates the active editor as text is interpreted.";
  header.appendChild(note);
  root.appendChild(header);

  const board = document.createElement("section");
  board.className = "nv-ocr-board";

  const toolbar = document.createElement("div");
  toolbar.className = "nv-ocr-toolbar";

  const seg = document.createElement("div");
  seg.className = "nv-ocr-seg";
  seg.setAttribute("role", "tablist");
  seg.setAttribute("aria-label", "Tool");

  const penBtn = makeButton("Pen", { title: "Pen" });
  penBtn.classList.add("active");
  penBtn.setAttribute("aria-selected", "true");

  const eraserBtn = makeButton("Eraser", { title: "Eraser" });
  eraserBtn.setAttribute("aria-selected", "false");

  seg.appendChild(penBtn);
  seg.appendChild(eraserBtn);
  toolbar.appendChild(seg);

  const sizeLabel = document.createElement("label");
  sizeLabel.className = "nv-ocr-label";
  sizeLabel.textContent = "Size";
  sizeLabel.setAttribute("for", "nv-ocr-size");
  toolbar.appendChild(sizeLabel);

  const sizeInput = document.createElement("input");
  sizeInput.id = "nv-ocr-size";
  sizeInput.type = "range";
  sizeInput.min = "2";
  sizeInput.max = "36";
  sizeInput.value = "16";
  sizeInput.className = "nv-ocr-range";
  toolbar.appendChild(sizeInput);

  const threshLabel = document.createElement("label");
  threshLabel.className = "nv-ocr-label";
  threshLabel.textContent = "Contrast";
  threshLabel.setAttribute("for", "nv-ocr-threshold");
  toolbar.appendChild(threshLabel);

  const thresholdInput = document.createElement("input");
  thresholdInput.id = "nv-ocr-threshold";
  thresholdInput.type = "range";
  thresholdInput.min = "0";
  thresholdInput.max = "255";
  thresholdInput.value = "180";
  thresholdInput.className = "nv-ocr-range";
  toolbar.appendChild(thresholdInput);

  const liveLabel = document.createElement("label");
  liveLabel.className = "nv-ocr-label";
  const liveInput = document.createElement("input");
  liveInput.type = "checkbox";
  liveInput.checked = liveInsert !== false;
  liveLabel.appendChild(liveInput);
  liveLabel.appendChild(document.createTextNode("Live insert"));
  toolbar.appendChild(liveLabel);

  const clearBtn = makeButton("Clear");
  toolbar.appendChild(clearBtn);

  const spacer = document.createElement("div");
  spacer.className = "nv-ocr-spacer";
  toolbar.appendChild(spacer);

  const recognizeBtn = makeButton("Recognize Text", { primary: true });
  toolbar.appendChild(recognizeBtn);

  board.appendChild(toolbar);

  const canvas = document.createElement("canvas");
  canvas.className = "nv-ocr-canvas";
  canvas.width = 1024;
  canvas.height = 512;
  canvas.setAttribute("aria-label", "Handwriting pad");
  board.appendChild(canvas);

  const progress = document.createElement("div");
  progress.className = "nv-ocr-progress";
  const bar = document.createElement("div");
  bar.className = "nv-ocr-bar";
  progress.appendChild(bar);
  board.appendChild(progress);

  const status = document.createElement("div");
  status.className = "nv-ocr-status";
  board.appendChild(status);

  const outWrap = document.createElement("div");
  outWrap.className = "nv-ocr-out";
  const outLabel = document.createElement("label");
  outLabel.className = "nv-ocr-label";
  outLabel.textContent = "Recognized text";
  outLabel.setAttribute("for", "nv-ocr-out");
  outWrap.appendChild(outLabel);

  const outText = document.createElement("textarea");
  outText.id = "nv-ocr-out";
  outText.className = "nv-ocr-textarea";
  outText.placeholder = "Recognition result will appear here...";
  outWrap.appendChild(outText);

  const outToolbar = document.createElement("div");
  outToolbar.className = "nv-ocr-toolbar";
  const copyBtn = makeButton("Copy");
  const insertBtn = makeButton("Insert");
  const savePngBtn = makeButton("Save PNG");
  outToolbar.appendChild(copyBtn);
  outToolbar.appendChild(insertBtn);
  outToolbar.appendChild(savePngBtn);
  outWrap.appendChild(outToolbar);

  const help = document.createElement("div");
  help.className = "nv-ocr-help";
  help.textContent = describeOfflineRequirement();
  outWrap.appendChild(help);

  board.appendChild(outWrap);
  root.appendChild(board);
  container.replaceChildren(root);

  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  fillCanvas(ctx, canvas, DEFAULT_BG);

  let drawing = false;
  let tool = "pen";
  let currentStroke = null;
  let penStrokes = [];

  function setStroke() {
    const dpr = getDpr();
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.strokeStyle = tool === "pen" ? DEFAULT_FG : DEFAULT_BG;
    ctx.lineWidth = clamp(sizeInput.valueAsNumber || 16, 2, 36) * dpr;
  }

  function resizeCanvasKeepContent() {
    const rect = canvas.getBoundingClientRect();
    const dpr = getDpr();
    const w = Math.max(1, Math.floor(rect.width * dpr));
    const h = Math.max(1, Math.floor(rect.height * dpr));
    if (w === canvas.width && h === canvas.height) return;

    const tmp = document.createElement("canvas");
    tmp.width = canvas.width;
    tmp.height = canvas.height;
    tmp.getContext("2d").drawImage(canvas, 0, 0);

    canvas.width = w;
    canvas.height = h;
    fillCanvas(ctx, canvas, DEFAULT_BG);
    ctx.drawImage(tmp, 0, 0, w, h);
    setStroke();
  }

  function getPoint(e) {
    const rect = canvas.getBoundingClientRect();
    const dpr = getDpr();
    const clientX = e.touches?.[0]?.clientX ?? e.clientX;
    const clientY = e.touches?.[0]?.clientY ?? e.clientY;
    return {
      x: (clientX - rect.left) * dpr,
      y: (clientY - rect.top) * dpr
    };
  }

  function normalizeStrokePoints(strokes) {
    const points = strokes.flatMap((stroke) => Array.isArray(stroke) ? stroke : []);
    if (points.length < 6) return null;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const point of points) {
      if (point.x < minX) minX = point.x;
      if (point.x > maxX) maxX = point.x;
      if (point.y < minY) minY = point.y;
      if (point.y > maxY) maxY = point.y;
    }
    const width = maxX - minX;
    const height = maxY - minY;
    if (width < 18 || height < 28) return null;
    const norm = (point) => ({
      x: (point.x - minX) / width,
      y: (point.y - minY) / height,
    });
    return { width, height, strokes: strokes.map((stroke) => stroke.map(norm)) };
  }

  function strokeHasMiddleBar(stroke) {
    const middle = stroke.filter((p) => p.y > 0.32 && p.y < 0.72);
    if (middle.length < 2) return false;
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const p of middle) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }
    return (maxX - minX) > 0.24 && (maxY - minY) < 0.18 && minX < 0.58 && maxX > 0.42;
  }


  function recognizeCapitalAFromStrokes(strokes) {
    const normalized = normalizeStrokePoints(strokes);
    if (!normalized) return "";
    const { width, height, strokes: normStrokes } = normalized;
    const ratio = height / Math.max(1, width);
    if (ratio < 0.75 || ratio > 3.6) return "";

    const points = normStrokes.flat();
    const apex = points.some((p) => p.y < 0.18 && p.x > 0.25 && p.x < 0.75);
    const leftFoot = points.some((p) => p.y > 0.72 && p.x < 0.35);
    const rightFoot = points.some((p) => p.y > 0.72 && p.x > 0.65);
    const middleBar = normStrokes.some(strokeHasMiddleBar);
    if (apex && leftFoot && rightFoot && middleBar) return "A";

    return "";
  }

  function recognizeSimpleStrokes() {
    const activeStrokes = currentStroke?.length ? [...penStrokes, currentStroke] : penStrokes;
    return recognizeCapitalAFromStrokes(activeStrokes);
  }


  function startDraw(e) {
    drawing = true;
    const p = getPoint(e);
    currentStroke = tool === "pen" ? [p] : null;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    e.preventDefault?.();
  }
  function moveDraw(e) {
    if (!drawing) return;
    const p = getPoint(e);
    if (currentStroke) currentStroke.push(p);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    hasInk = true;
    scheduleLiveRecognition();
    e.preventDefault?.();
  }
  function endDraw() {
    if (drawing && currentStroke?.length > 2) penStrokes.push(currentStroke);
    currentStroke = null;
    if (drawing) scheduleLiveRecognition(140);
    drawing = false;
  }

  const onResize = () => resizeCanvasKeepContent();
  canvas.addEventListener("pointerdown", startDraw);
  canvas.addEventListener("pointermove", moveDraw);
  window.addEventListener("pointerup", endDraw);
  canvas.addEventListener("touchstart", startDraw, { passive: false });
  canvas.addEventListener("touchmove", moveDraw, { passive: false });
  window.addEventListener("touchend", endDraw);

  window.addEventListener("resize", onResize);
  sizeInput.addEventListener("input", () => setStroke());
  thresholdInput.addEventListener("input", () => scheduleLiveRecognition(260));

  penBtn.addEventListener("click", () => {
    tool = "pen";
    penBtn.classList.add("active");
    eraserBtn.classList.remove("active");
    penBtn.setAttribute("aria-selected", "true");
    eraserBtn.setAttribute("aria-selected", "false");
    setStroke();
  });
  eraserBtn.addEventListener("click", () => {
    tool = "eraser";
    eraserBtn.classList.add("active");
    penBtn.classList.remove("active");
    penBtn.setAttribute("aria-selected", "false");
    eraserBtn.setAttribute("aria-selected", "true");
    setStroke();
  });

  clearBtn.addEventListener("click", () => {
    clearTimeout(liveTimer);
    liveTimer = 0;
    fillCanvas(ctx, canvas, DEFAULT_BG);
    setStroke();
    hasInk = false;
    penStrokes = [];
    currentStroke = null;
    lastLiveText = "";
    outText.value = "";
    bar.style.width = "0%";
    status.textContent = "";
    if (typeof onLiveText === "function") onLiveText("");
  });

  copyBtn.addEventListener("click", async () => {
    const text = safeText(outText.value).trim();
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
    } catch (_) {
      outText.select();
      document.execCommand?.("copy");
    }
  });

  insertBtn.addEventListener("click", () => {
    const text = safeText(outText.value).trim();
    if (!text) return;
    if (typeof onInsertText === "function") {
      onInsertText(text);
    } else {
      document.execCommand?.("insertText", false, text);
    }
  });

  savePngBtn.addEventListener("click", () => {
    const link = document.createElement("a");
    link.download = "handwriting.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
  });

  async function ensureNativeRecognizer() {
    if (nativeRecognizer) return nativeRecognizer;
    if (nativeRecognizerPromise) return nativeRecognizerPromise;
    if (typeof navigator?.createHandwritingRecognizer !== "function") return null;
    if (typeof window.HandwritingStroke !== "function") return null;

    nativeRecognizerPromise = navigator
      .createHandwritingRecognizer({ languages: ["en"] })
      .then((recognizer) => {
        nativeRecognizer = recognizer;
        return recognizer;
      })
      .catch((err) => {
        console.warn("[HandwritingOcrPanel] native handwriting recognition unavailable:", err);
        nativeRecognizerPromise = null;
        nativeRecognizer = null;
        return null;
      });

    return nativeRecognizerPromise;
  }

  async function recognizeNativeHandwriting() {
    const recognizer = await ensureNativeRecognizer();
    if (!recognizer?.startDrawing) return "";
    const strokes = currentStroke?.length ? [...penStrokes, currentStroke] : penStrokes;
    if (!strokes.length) return "";

    const drawing = recognizer.startDrawing({ recognitionType: "text" });
    for (const stroke of strokes) {
      if (!stroke?.length) continue;
      const nativeStroke = new window.HandwritingStroke();
      stroke.forEach((point, index) => {
        nativeStroke.addPoint({ x: point.x, y: point.y, t: index * 16 });
      });
      drawing.addStroke(nativeStroke);
    }

    const predictions = await drawing.getPrediction();
    drawing.clear?.();
    return safeText(predictions?.[0]?.text || "").trim();
  }


  async function configureWorker(wk) {
    try {
      await wk?.setParameters?.({
        tessedit_pageseg_mode: "7",
        preserve_interword_spaces: "1",
      });
    } catch (err) {
      console.warn("[HandwritingOcrPanel] failed to configure OCR worker:", err);
    }
  }

  async function ensureWorker() {
    if (worker) return worker;
    if (workerPromise) return workerPromise;

    workerPromise = (async () => {
      const Tesseract = await ensureTesseract();
      const logger = (m) => {
        if (m?.status === "recognizing text" && typeof m.progress === "number") {
          bar.style.width = `${Math.round(m.progress * 100)}%`;
        }
      };
      const baseOptions = {
        workerPath: "/Tesseract/worker.min.js",
        corePath: "/Tesseract/tesseract-core-simd.wasm.js",
        cacheMethod: "readwrite",
        logger,
      };

      try {
        status.textContent = "Loading local OCR data...";
        worker = await Tesseract.createWorker("eng", 1, {
          ...baseOptions,
          langPath: "/Tesseract/lang-data",
        });
        await configureWorker(worker);
        return worker;
      } catch (localErr) {
        console.warn("[HandwritingOcrPanel] local OCR data unavailable, trying online language data:", localErr);
        status.textContent = "Local OCR data unavailable; trying online OCR data...";
        if (!safeText(outText.value).trim()) {
          outText.value = `${describeOfflineRequirement()}\nTrying online OCR language data...`;
        }
        worker = await Tesseract.createWorker("eng", 1, baseOptions);
        await configureWorker(worker);
        return worker;
      }
    })().catch((err) => {
      workerPromise = null;
      worker = null;
      throw err;
    });

    return workerPromise;
  }

  function emitLiveText(text) {
    const clean = safeText(text || "").trim();
    if (clean === lastLiveText) return;
    lastLiveText = clean;
    if (typeof onLiveText === "function") onLiveText(clean);
  }

  function scheduleLiveRecognition(delay = 520) {
    if (!liveInput.checked || !hasInk) return;
    if (!recognizing) status.textContent = "Ink captured; reading shortly...";
    const now = Date.now();
    const elapsed = now - lastLiveScheduleAt;
    lastLiveScheduleAt = now;
    const actualDelay = elapsed > 1200 ? Math.min(delay, 180) : delay;
    clearTimeout(liveTimer);
    liveTimer = window.setTimeout(() => {
      liveTimer = 0;
      recognizeCanvas({ live: true });
    }, actualDelay);
  }

  async function recognizeCanvas({ live = false } = {}) {
    if (!hasInk && live) return;
    if (recognizing) {
      queuedRecognition = true;
      return;
    }

    recognizing = true;
    recognizeBtn.disabled = true;
    if (!live) outText.value = "Recognizing...";
    status.textContent = live ? "Reading handwriting..." : "Recognizing handwriting...";
    bar.style.width = "0%";

    try {
      const nativeText = await recognizeNativeHandwriting();
      if (nativeText) {
        outText.value = nativeText;
        if (liveInput.checked || live) emitLiveText(nativeText);
        bar.style.width = "100%";
        status.textContent = "Text updated from native handwriting recognition.";
        setTimeout(() => { bar.style.width = "0%"; }, 900);
        return;
      }

      const strokeText = recognizeSimpleStrokes();
      if (strokeText) {
        outText.value = strokeText;
        if (liveInput.checked || live) emitLiveText(strokeText);
        bar.style.width = "100%";
        status.textContent = "Text updated from handwriting strokes.";
        setTimeout(() => { bar.style.width = "0%"; }, 900);
        return;
      }

      if (live) {
        status.textContent = "Add more strokes, or use Recognize Text for OCR.";
        return;
      }

      const threshold = Number(thresholdInput.value || "180");
      const bin = binarizeCanvas(canvas, threshold);
      const wk = await ensureWorker();
      const { data } = await wk.recognize(bin);
      const text = safeText(data?.text || "").trim();
      outText.value = text || "(no text detected)";
      if (liveInput.checked || live) emitLiveText(text);
      bar.style.width = "100%";
      status.textContent = text ? "Text updated in the editor." : "No text detected yet.";
      setTimeout(() => { bar.style.width = "0%"; }, 900);
    } catch (err) {
      console.warn("[HandwritingOcrPanel] recognition failed:", err);
      const msg = err?.message ? String(err.message) : String(err);
      const strokeText = recognizeSimpleStrokes();
      if (strokeText) {
        outText.value = strokeText;
        if (liveInput.checked || live) emitLiveText(strokeText);
        status.textContent = "Text updated from handwriting strokes.";
      } else {
        outText.value = `Recognition error: ${msg}\n\n${describeOfflineRequirement()}`;
        status.textContent = "Recognition failed.";
      }
      bar.style.width = "0%";
    } finally {
      recognizing = false;
      recognizeBtn.disabled = false;
      if (queuedRecognition) {
        queuedRecognition = false;
        scheduleLiveRecognition(120);
      }
    }
  }

  recognizeBtn.addEventListener("click", () => {
    clearTimeout(liveTimer);
    liveTimer = 0;
    recognizeCanvas({ live: false });
  });

  liveInput.addEventListener("change", () => {
    if (liveInput.checked) {
      scheduleLiveRecognition(160);
      return;
    }
    if (typeof onLiveText === "function") {
      lastLiveText = "";
      onLiveText("");
    }
  });

  status.textContent = "Ready.";

  setStroke();
  resizeCanvasKeepContent();

  const api = {
    dispose: async () => {
      clearTimeout(liveTimer);
      clearTimeout(preloadTimer);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("pointerup", endDraw);
      window.removeEventListener("touchend", endDraw);
      try {
        await worker?.terminate?.();
      } catch (_) {
        // ignore
      }
      worker = null;
      workerPromise = null;
      try {
        nativeRecognizer?.finish?.();
      } catch (_) {
        // ignore
      }
      nativeRecognizer = null;
      nativeRecognizerPromise = null;
      if (root.parentNode === container) root.remove();
    }
  };

  return api;
}

export async function setupPanel(panel, panelVars = {}) {
  panel.style.display = "flex";
  panel.style.flexDirection = "column";
  panel.style.minHeight = "0";
  panel.style.overflow = "hidden";

  const api = mountHandwritingOcrPanel(panel, panelVars);
  panel.cleanup = async () => {
    await api?.dispose?.();
  };
}

export function openHandwritingOcrPanel(options = {}) {
  injectStylesOnce();

  const existing = window[PANEL_KEY];
  if (existing?.setVisible) {
    existing.setVisible(true);
    return existing;
  }

  let innerApi = null;
  const floating = createFloatingInventoryPanel({
    title: options.title || "Handwriting -> Text",
    onRequestClose: () => floating.setVisible(false)
  });

  innerApi = mountHandwritingOcrPanel(floating.content, options);

  const api = {
    setVisible: (visible) => floating.setVisible(visible),
    dispose: async () => {
      try {
        await innerApi?.dispose?.();
      } finally {
        floating.dispose();
        delete window[PANEL_KEY];
      }
    }
  };

  window[PANEL_KEY] = api;
  return api;
}
