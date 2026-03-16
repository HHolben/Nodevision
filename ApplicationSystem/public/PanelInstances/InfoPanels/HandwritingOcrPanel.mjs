// Nodevision/public/PanelInstances/InfoPanels/HandwritingOcrPanel.mjs
// Floating "Handwriting → Text" panel for the Insert toolbar.
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
    .nv-ocr-wrap { display: grid; gap: 10px; }
    .nv-ocr-header { display:flex; gap: 10px; align-items: baseline; flex-wrap: wrap; }
    .nv-ocr-note { opacity: 0.85; font-size: 12px; }
    .nv-ocr-board { display:grid; gap: 10px; padding: 10px; border-radius: 10px; border: 1px solid rgba(70, 96, 135, 0.65); background: rgba(12, 18, 28, 0.85); }
    .nv-ocr-toolbar { display:flex; gap: 8px; align-items:center; flex-wrap: wrap; }
    .nv-ocr-seg { display:inline-flex; border: 1px solid rgba(75, 102, 140, 0.9); border-radius: 9px; overflow: hidden; }
    .nv-ocr-seg button { border: none; border-right: 1px solid rgba(75, 102, 140, 0.9); background: rgba(18, 32, 52, 0.92); }
    .nv-ocr-seg button:last-child { border-right: none; }
    .nv-ocr-seg button.active { background: #2b72ff; }
    .nv-ocr-btn { border: 1px solid rgba(75, 102, 140, 0.9); background: rgba(18, 32, 52, 0.92); color: #eaf7ff; padding: 7px 10px; border-radius: 8px; cursor: pointer; font-weight: 650; }
    .nv-ocr-btn.primary { background: #2b72ff; border-color: #2b72ff; color: #ffffff; }
    .nv-ocr-btn:disabled { opacity: 0.6; cursor: not-allowed; }
    .nv-ocr-label { opacity: 0.9; font-size: 12px; }
    .nv-ocr-spacer { flex: 1; }
    .nv-ocr-canvas { width: 100%; height: 340px; border-radius: 10px; border: 1px dashed rgba(115, 145, 190, 0.85); background: ${DEFAULT_BG}; touch-action: none; }
    .nv-ocr-progress { height: 10px; background: rgba(16, 28, 46, 0.85); border: 1px solid rgba(75, 102, 140, 0.65); border-radius: 7px; overflow: hidden; }
    .nv-ocr-bar { height: 100%; width: 0%; background: #2b72ff; transition: width 0.18s ease; }
    .nv-ocr-out { display:grid; gap: 6px; }
    .nv-ocr-textarea { width: 100%; min-height: 120px; padding: 10px; border-radius: 10px; border: 1px solid rgba(75, 102, 140, 0.9); background: rgba(10, 18, 32, 0.92); color: #eaf7ff; resize: vertical; }
    .nv-ocr-help { opacity: 0.75; font-size: 12px; line-height: 1.35; }
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
  const off = document.createElement("canvas");
  off.width = sourceCanvas.width;
  off.height = sourceCanvas.height;
  const octx = off.getContext("2d", { willReadFrequently: true });
  octx.drawImage(sourceCanvas, 0, 0);
  const img = octx.getImageData(0, 0, off.width, off.height);
  const d = img.data;
  const t = clamp(threshold, 0, 255);

  for (let i = 0; i < d.length; i += 4) {
    const gray = d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;
    const v = gray > t ? 255 : 0;
    d[i] = v;
    d[i + 1] = v;
    d[i + 2] = v;
    d[i + 3] = 255;
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

export function openHandwritingOcrPanel({
  onInsertText = null,
  title = "Handwriting → Text"
} = {}) {
  injectStylesOnce();

  const existing = window[PANEL_KEY];
  if (existing?.setVisible) {
    existing.setVisible(true);
    return existing;
  }

  let worker = null;
  let workerPromise = null;

  const floating = createFloatingInventoryPanel({
    title,
    onRequestClose: () => floating.setVisible(false)
  });

  const root = document.createElement("div");
  root.className = "nv-ocr-wrap";

  const header = document.createElement("div");
  header.className = "nv-ocr-header";
  const note = document.createElement("div");
  note.className = "nv-ocr-note";
  note.textContent = "Write in the box, then recognize. Best with neat block letters.";
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

  const penBtn = makeButton("✍️ Pen", { title: "Pen" });
  penBtn.classList.add("active");
  penBtn.setAttribute("aria-selected", "true");

  const eraserBtn = makeButton("🧽 Eraser", { title: "Eraser" });
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
  toolbar.appendChild(thresholdInput);

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
  outText.placeholder = "Recognition result will appear here…";
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
  floating.content.appendChild(root);

  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  fillCanvas(ctx, canvas, DEFAULT_BG);

  let drawing = false;
  let tool = "pen";

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

  function startDraw(e) {
    drawing = true;
    const p = getPoint(e);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    e.preventDefault?.();
  }
  function moveDraw(e) {
    if (!drawing) return;
    const p = getPoint(e);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    e.preventDefault?.();
  }
  function endDraw() {
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
    fillCanvas(ctx, canvas, DEFAULT_BG);
    setStroke();
    outText.value = "";
    bar.style.width = "0%";
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

  async function ensureWorker() {
    if (worker) return worker;
    if (workerPromise) return workerPromise;

    workerPromise = (async () => {
      const Tesseract = await ensureTesseract();
      worker = await Tesseract.createWorker("eng", 1, {
        workerPath: "/Tesseract/worker.min.js",
        corePath: "/Tesseract/tesseract-core-simd.wasm.js",
        langPath: "/Tesseract/lang-data",
        cacheMethod: "readwrite",
        logger: (m) => {
          if (m?.status === "recognizing text" && typeof m.progress === "number") {
            bar.style.width = `${Math.round(m.progress * 100)}%`;
          }
        }
      });
      return worker;
    })().catch((err) => {
      workerPromise = null;
      worker = null;
      throw err;
    });

    return workerPromise;
  }

  recognizeBtn.addEventListener("click", async () => {
    recognizeBtn.disabled = true;
    bar.style.width = "0%";
    outText.value = "Recognizing…";

    try {
      const threshold = Number(thresholdInput.value || "180");
      const bin = binarizeCanvas(canvas, threshold);
      const wk = await ensureWorker();
      const { data } = await wk.recognize(bin);
      const text = safeText(data?.text || "").trim();
      outText.value = text || "(no text detected)";
      bar.style.width = "100%";
      setTimeout(() => { bar.style.width = "0%"; }, 900);
    } catch (err) {
      console.warn("[HandwritingOcrPanel] recognition failed:", err);
      const msg = err?.message ? String(err.message) : String(err);
      outText.value = `Recognition error: ${msg}\n\n${describeOfflineRequirement()}`;
      bar.style.width = "0%";
    } finally {
      recognizeBtn.disabled = false;
    }
  });

  setStroke();
  resizeCanvasKeepContent();

  const api = {
    setVisible: (visible) => floating.setVisible(visible),
    dispose: async () => {
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
      floating.dispose();
      delete window[PANEL_KEY];
    }
  };

  window[PANEL_KEY] = api;
  return api;
}
