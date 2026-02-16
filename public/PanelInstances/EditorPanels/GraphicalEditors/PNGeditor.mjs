// Nodevision/public/PanelInstances/EditorPanels/GraphicalEditors/PNGeditor.mjs
//This file is used to create an editor panel for PNG files.
import { History } from './PNGeditorComponents/history.mjs';
import { bresenhamLine, hexToRGBA } from './PNGeditorComponents/canvasEngine.mjs';
import { updateToolbarState } from "./../../../panels/createToolbar.mjs";


export async function renderEditor(filePath, container) {
  if (!container) throw new Error("Container required");
  container.innerHTML = "";

  const state = {
    logicalWidth: 32,
    logicalHeight: 32,
    pixelSize: 1,
    drawing: false,
    lastPos: null,
    alpha: 100
  };


  //0.set current Mode
    window.NodevisionState.currentMode = "PNGediting";
  updateToolbarState({ currentMode: "PNGediting" });


  if (filePath) {
    try {
      const sourceImage = await loadPngFromNotebook(filePath);
      state.logicalWidth = sourceImage.naturalWidth || sourceImage.width || state.logicalWidth;
      state.logicalHeight = sourceImage.naturalHeight || sourceImage.height || state.logicalHeight;
      state.initialImage = sourceImage;
    } catch (err) {
      state.loadError = err?.message || "Failed to load source image.";
      console.warn("PNG editor: failed to load source image, starting with blank canvas.", err);
    }
  }

  // 1. UI Build (Wrapper & Canvas)
  const wrapper = document.createElement("div");
  wrapper.style.cssText = "display:flex; flex-direction:column; height:100%; width:100%; overflow:hidden;";
  
  const canvas = document.createElement("canvas");
  canvas.width = state.logicalWidth;
  canvas.height = state.logicalHeight;
  canvas.style.cssText = "image-rendering:pixelated; cursor:crosshair; background:repeating-conic-gradient(#ccc 0% 25%, #eee 0% 50%) 50% / 20px 20px;";
  
  const ctx = canvas.getContext("2d", { alpha: true });
  const history = new History(ctx);

  // 2. Canvas-only panel controls: color is set through Draw -> Color
  if (state.loadError) {
    const warning = document.createElement("div");
    warning.textContent = state.loadError;
    warning.style.cssText = "padding:6px 8px; color:#b00020; background:#fff3f3; border-bottom:1px solid #d9a0a0; font:12px monospace;";
    wrapper.appendChild(warning);
  }
  wrapper.appendChild(canvas);
  container.appendChild(wrapper);

  if (state.initialImage) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(state.initialImage, 0, 0);
  }

  // 3. Drawing Logic
  const getPos = (e) => {
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: Math.floor(((clientX - rect.left) / rect.width) * state.logicalWidth),
      y: Math.floor(((clientY - rect.top) / rect.height) * state.logicalHeight)
    };
  };

  const draw = (x, y) => {
    const drawColor = window.NodevisionState?.drawColor || "#000000";
    ctx.fillStyle = hexToRGBA(drawColor, state.alpha);
    ctx.fillRect(x, y, state.pixelSize, state.pixelSize);
  };

  const onMove = (e) => {
    if (!state.drawing) return;
    const pos = getPos(e);
    if (state.lastPos) {
      bresenhamLine(state.lastPos.x, state.lastPos.y, pos.x, pos.y, draw);
    }
    state.lastPos = pos;
  };

  // Event Listeners
  canvas.addEventListener("mousedown", (e) => {
    history.push(canvas);
    state.drawing = true;
    state.lastPos = getPos(e);
    draw(state.lastPos.x, state.lastPos.y);
  });

  window.addEventListener("mousemove", onMove);
  window.addEventListener("mouseup", () => state.drawing = false);

  // Global Integration
  window.rasterCanvas = canvas;

  return {
    destroy: () => {
      window.removeEventListener("mousemove", onMove);
      window.rasterCanvas = null;
    }
  };
}

async function loadPngFromNotebook(filePath) {
  const stamp = `t=${Date.now()}`;
  const normalized = normalizeNotebookPath(filePath);
  const decodedNormalized = normalizeNotebookPath(safeDecode(filePath));
  const raw = String(filePath || "").trim().replace(/\\/g, "/");
  const rawNoHashQuery = raw.replace(/[?#].*$/, "");
  const rawPathname = rawNoHashQuery.startsWith("http://") || rawNoHashQuery.startsWith("https://")
    ? safePathnameFromUrl(rawNoHashQuery)
    : rawNoHashQuery;

  const pathCandidates = dedupe([
    normalized || null,
    decodedNormalized || null,
    normalizeNotebookPath(rawPathname) || null,
  ]).filter(Boolean);

  for (const candidatePath of pathCandidates) {
    try {
      const img = await loadImageFromApiPath(candidatePath, stamp);
      return img;
    } catch {
      // try next
    }
  }

  const candidates = dedupe([
    normalized ? `/Notebook/${encodePathSegments(normalized)}?${stamp}` : null,
    decodedNormalized ? `/Notebook/${encodePathSegments(decodedNormalized)}?${stamp}` : null,
    normalized ? `/${encodePathSegments(normalized)}?${stamp}` : null,
    decodedNormalized ? `/${encodePathSegments(decodedNormalized)}?${stamp}` : null,
    rawPathname ? `${rawPathname}${rawPathname.includes("?") ? "&" : "?"}${stamp}` : null,
  ]).filter(Boolean);

  let lastError = null;
  for (const src of candidates) {
    try {
      const img = await loadImageFromSrc(src);
      return img;
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError || new Error(`Failed to load PNG from candidates for: ${filePath}`);
}

async function loadImageFromApiPath(relativePath, stamp) {
  const encodedPath = encodeURIComponent(relativePath);
  const urls = [
    `/api/file-binary?path=${encodedPath}&${stamp}`,
    `/api/api/file-binary?path=${encodedPath}&${stamp}`,
  ];

  let lastStatus = null;
  for (const url of urls) {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
      lastStatus = res.status;
      continue;
    }

    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    try {
      const img = await loadImageFromSrc(objectUrl);
      return img;
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  }

  throw new Error(`Binary API returned ${lastStatus ?? "error"} for ${relativePath}`);
}

function loadImageFromSrc(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load PNG: ${src}`));
    img.src = src;
  });
}

function encodePathSegments(pathValue) {
  return String(pathValue)
    .split("/")
    .filter(Boolean)
    .map((segment) => encodeURIComponent(safeDecode(segment)))
    .join("/");
}

function safeDecode(value) {
  try {
    return decodeURIComponent(String(value));
  } catch {
    return String(value);
  }
}

function dedupe(values) {
  return [...new Set(values)];
}

function normalizeNotebookPath(filePath) {
  if (!filePath) return "";

  const raw = String(filePath).trim();
  if (!raw) return "";

  // Strip protocol/origin if present and keep only pathname part.
  let pathOnly = raw;
  try {
    if (/^https?:\/\//i.test(raw)) {
      pathOnly = new URL(raw).pathname;
    }
  } catch {
    pathOnly = raw;
  }

  // Normalize separators and remove query/hash fragments.
  pathOnly = pathOnly
    .replace(/\\/g, "/")
    .replace(/[?#].*$/, "")
    .replace(/^\/+/, "");

  // If an absolute path contains "/Notebook/", keep the relative section after it.
  pathOnly = pathOnly.replace(/^.*\/Notebook\//i, "");
  pathOnly = pathOnly.replace(/^Notebook\//i, "");

  return pathOnly;
}

function safePathnameFromUrl(urlLike) {
  try {
    return new URL(urlLike).pathname;
  } catch {
    return String(urlLike);
  }
}
