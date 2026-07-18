// Nodevision/ApplicationSystem/server/routes/handwritingOcrTrainingRoutes.mjs
// Stores per-user handwriting OCR correction samples under UserData.

import crypto from "node:crypto";
import path from "node:path";
import fsPromises from "node:fs/promises";
import {
  HANDWRITING_TRAJECTORY_SCHEMA,
  normalizeStoredHandwritingSample,
} from "../../public/PanelInstances/InfoPanels/HandwritingTrajectory.mjs";
import {
  createEmptyConfusions,
  recordDirectionalConfusion,
  validateConfusions,
} from "../../public/PanelInstances/InfoPanels/HandwritingConfusions.mjs";

const TRAINING_ROOT = "HandwritingOcr";
const INDEX_FILE = "training.json";
const CONFUSIONS_FILE = "confusions.json";
const CORRECTION_SAMPLE_SCHEMA_V1 = "nodevision-handwriting-correction-sample/1";
const CORRECTION_SAMPLE_SCHEMA_V2 = "nodevision-handwriting-correction-sample/2";
const SAMPLE_DIR = "samples";
const FONT_DIR = "fonts";
const FONT_MANIFEST_FILE = "manifest.csv";
const HENRY_SCRIPT_FONT_ID = "henryscript";
const HENRY_SCRIPT_FONT_FILE = "Henryscriptversion1-Regular.ttf";
const SAMPLE_GRID = 28;
const MAX_SAMPLES = 2000;
const MAX_POINTS = SAMPLE_GRID * SAMPLE_GRID;
const MAX_IMAGE_BYTES = 512 * 1024;

function requireIdentity(req, res, next) {
  if (req.identity) return next();
  return res.status(401).json({ error: "Authentication required" });
}


function henryScriptFontPath(ctx) {
  return path.join(ctx.userDataDir, TRAINING_ROOT, FONT_DIR, HENRY_SCRIPT_FONT_FILE);
}


function fontDir(ctx) {
  return path.join(ctx.userDataDir, TRAINING_ROOT, FONT_DIR);
}

function fontManifestPath(ctx) {
  return path.join(fontDir(ctx), FONT_MANIFEST_FILE);
}

function parseCsvLine(line) {
  const cells = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (quoted) {
      if (char === "\"" && line[index + 1] === "\"") {
        value += "\"";
        index += 1;
      } else if (char === "\"") {
        quoted = false;
      } else {
        value += char;
      }
      continue;
    }
    if (char === "\"") {
      quoted = true;
    } else if (char === ",") {
      cells.push(value);
      value = "";
    } else {
      value += char;
    }
  }
  cells.push(value);
  return cells;
}

function parseCsvManifest(raw) {
  const lines = String(raw || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));
  if (!lines.length) return [];
  const headers = parseCsvLine(lines[0]).map((header) => header.trim());
  return lines.slice(1).map((line) => {
    const cells = parseCsvLine(line);
    const entry = {};
    headers.forEach((header, index) => {
      if (!header) return;
      entry[header] = String(cells[index] || "").trim();
    });
    return entry;
  });
}

async function loadFontManifest(ctx) {
  try {
    return parseCsvManifest(await fsPromises.readFile(fontManifestPath(ctx), "utf8"));
  } catch (err) {
    if (err?.code === "ENOENT") return [];
    throw err;
  }
}

function isPathWithin(parentDir, candidatePath) {
  const relative = path.relative(path.resolve(parentDir), path.resolve(candidatePath));
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function fontManifestEntryId(entry) {
  return String(entry?.id || entry?.fontId || entry?.slug || "").trim().toLowerCase();
}

async function existingFontPathInAllowedRoots(ctx, candidatePath) {
  if (!candidatePath) return "";
  const resolved = path.resolve(candidatePath);
  const allowedRoots = [ctx.notebookDir, fontDir(ctx)].filter(Boolean).map((dir) => path.resolve(dir));
  if (!allowedRoots.some((root) => isPathWithin(root, resolved))) return "";
  await fsPromises.access(resolved);
  return resolved;
}

async function resolveManifestFontPath(ctx, fontId) {
  const targetId = String(fontId || "").trim().toLowerCase();
  const manifest = await loadFontManifest(ctx);
  const entry = manifest.find((item) => fontManifestEntryId(item) === targetId);
  if (!entry) return "";

  const candidates = [];
  const notebookRelativePath = entry.notebookRelativePath || entry.notebookPath || entry.relativePath;
  if (notebookRelativePath) candidates.push(path.join(ctx.notebookDir, notebookRelativePath));
  if (entry.sourcePath) candidates.push(entry.sourcePath);
  if (entry.absolutePath) candidates.push(entry.absolutePath);
  if (entry.path) candidates.push(entry.path);
  if (entry.fileName || entry.filename) candidates.push(path.join(fontDir(ctx), entry.fileName || entry.filename));

  for (const candidate of candidates) {
    try {
      const existingPath = await existingFontPathInAllowedRoots(ctx, candidate);
      if (existingPath) return existingPath;
    } catch (_) {
      // Try the next manifest location.
    }
  }
  return "";
}

async function resolveHenryScriptFontPath(ctx) {
  return (await resolveManifestFontPath(ctx, HENRY_SCRIPT_FONT_ID)) || henryScriptFontPath(ctx);
}


function userTrainingDir(ctx, identity) {
  const numericId = Number(identity?.id);
  const segment = Number.isInteger(numericId)
    ? `user-${numericId}`
    : `user-${crypto.createHash("sha256").update(String(identity?.username || "unknown")).digest("hex").slice(0, 16)}`;
  return path.join(ctx.userDataDir, TRAINING_ROOT, "users", segment);
}

function firstGrapheme(value) {
  const text = String(value || "").trim();
  return Array.from(text)[0] || "";
}

function sanitizeLabel(value) {
  const label = firstGrapheme(value);
  if (!label) throw new Error("A correction label is required");
  return label;
}

function sanitizeText(value, maxLength = 64) {
  return String(value || "").replace(/\u0000/g, "").slice(0, maxLength);
}

function sanitizeNumber(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function sanitizeBounds(bounds) {
  if (!bounds || typeof bounds !== "object") return null;
  return {
    minX: sanitizeNumber(bounds.minX),
    minY: sanitizeNumber(bounds.minY),
    maxX: sanitizeNumber(bounds.maxX),
    maxY: sanitizeNumber(bounds.maxY),
    width: sanitizeNumber(bounds.width),
    height: sanitizeNumber(bounds.height),
  };
}

function sanitizeSample(rawSample) {
  const rawPoints = Array.isArray(rawSample?.points) ? rawSample.points : [];
  if (!rawPoints.length || rawPoints.length > MAX_POINTS) throw new Error("A compact glyph sample is required");
  const points = rawPoints.map((point) => {
    const x = Math.max(0, Math.min(SAMPLE_GRID - 1, Math.round(Number(point?.x))));
    const y = Math.max(0, Math.min(SAMPLE_GRID - 1, Math.round(Number(point?.y))));
    if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error("Invalid glyph sample point");
    return { x, y };
  });
  const aspectRatio = sanitizeNumber(rawSample?.aspectRatio, 0);
  const bounds = sanitizeBounds(rawSample?.bounds);
  return {
    grid: SAMPLE_GRID,
    points,
    ...(aspectRatio > 0 ? { aspectRatio } : {}),
    ...(bounds ? { bounds } : {}),
  };
}

function sanitizeTrajectorySample(rawTrajectory, label, sample) {
  if (!rawTrajectory) return null;
  const trajectory = normalizeStoredHandwritingSample(rawTrajectory, {
    character: label,
    raster28: sample,
    requireStrokes: true,
  });
  if (!trajectory?.strokes?.length) throw new Error("Invalid handwriting trajectory sample");
  return {
    ...trajectory,
    schema: HANDWRITING_TRAJECTORY_SCHEMA,
    character: label,
  };
}

function parsePngDataUrl(value) {
  const text = String(value || "");
  if (!text) return null;
  const match = text.match(/^data:image\/png;base64,([a-zA-Z0-9+/=]+)$/);
  if (!match) throw new Error("Correction image must be a PNG data URL");
  const buffer = Buffer.from(match[1], "base64");
  if (!buffer.length || buffer.length > MAX_IMAGE_BYTES) throw new Error("Correction image is too large");
  return buffer;
}

async function loadIndex(filePath) {
  try {
    const raw = await fsPromises.readFile(filePath, "utf8");
    const parsed = JSON.parse(raw);
    return {
      version: 1,
      samples: Array.isArray(parsed?.samples) ? parsed.samples : [],
    };
  } catch (err) {
    if (err?.code === "ENOENT") return { version: 1, samples: [] };
    if (err instanceof SyntaxError) return { version: 1, samples: [] };
    throw err;
  }
}

async function saveIndexAtomic(filePath, index) {
  const tempPath = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  await fsPromises.writeFile(tempPath, `${JSON.stringify(index, null, 2)}\n`, "utf8");
  await fsPromises.rename(tempPath, filePath);
}

async function loadConfusions(filePath) {
  try {
    const raw = await fsPromises.readFile(filePath, "utf8");
    return validateConfusions(JSON.parse(raw));
  } catch (err) {
    if (err?.code === "ENOENT" || err instanceof SyntaxError) return createEmptyConfusions();
    throw err;
  }
}

async function saveConfusionsAtomic(filePath, confusions) {
  const safeConfusions = validateConfusions(confusions);
  const tempPath = filePath + ".tmp-" + process.pid + "-" + Date.now();
  await fsPromises.writeFile(tempPath, JSON.stringify(safeConfusions, null, 2) + "\n", "utf8");
  await fsPromises.rename(tempPath, filePath);
}

function publicSample(entry) {
  const sample = sanitizeSample(entry?.sample);
  let trajectory = null;
  if (entry?.trajectory) {
    try {
      trajectory = normalizeStoredHandwritingSample(entry.trajectory, {
        character: firstGrapheme(entry?.label),
        raster28: sample,
        requireStrokes: false,
      });
    } catch (_) {
      trajectory = null;
    }
  }
  return {
    id: sanitizeText(entry?.id, 80),
    schema: sanitizeText(entry?.schema || (trajectory ? CORRECTION_SAMPLE_SCHEMA_V2 : CORRECTION_SAMPLE_SCHEMA_V1), 80),
    label: firstGrapheme(entry?.label),
    recognizedChar: firstGrapheme(entry?.recognizedChar),
    source: sanitizeText(entry?.source, 80),
    createdAt: sanitizeText(entry?.createdAt, 40),
    mode: "user-correction",
    sample,
    trajectory,
    bounds: sanitizeBounds(entry?.bounds),
    strokeCount: Math.max(0, Math.round(sanitizeNumber(entry?.strokeCount))),
    segmentIndex: Math.max(0, Math.round(sanitizeNumber(entry?.segmentIndex))),
  };
}

async function pruneSamplesIfNeeded(index, trainingDir) {
  if (index.samples.length <= MAX_SAMPLES) return;
  const removed = index.samples.splice(0, index.samples.length - MAX_SAMPLES);
  await Promise.all(removed.map(async (entry) => {
    if (!entry?.imageFile) return;
    try {
      await fsPromises.unlink(path.join(trainingDir, SAMPLE_DIR, path.basename(entry.imageFile)));
    } catch (_) {
      // Best-effort cleanup only.
    }
  }));
}

export function registerHandwritingOcrTrainingRoutes(app, ctx) {
  app.get("/api/handwriting-ocr/font/henryscript", requireIdentity, async (req, res) => {
    const fontPath = await resolveHenryScriptFontPath(ctx);
    try {
      await fsPromises.access(fontPath);
      res.setHeader("Cache-Control", "private, no-store");
      res.type("font/ttf");
      return res.sendFile(fontPath);
    } catch (err) {
      if (err?.code === "ENOENT") {
        return res.status(404).json({ error: "HenryScript font is not listed in the UserData manifest and no UserData fallback copy was found" });
      }
      console.error("Error serving HenryScript font:", err);
      return res.status(500).json({ error: "Failed to load HenryScript font" });
    }
  });

  app.get("/api/handwriting-ocr/training", requireIdentity, async (req, res) => {
    try {
      const trainingDir = userTrainingDir(ctx, req.identity);
      const indexPath = path.join(trainingDir, INDEX_FILE);
      const confusionPath = path.join(trainingDir, CONFUSIONS_FILE);
      const index = await loadIndex(indexPath);
      const confusions = await loadConfusions(confusionPath);
      const samples = index.samples.map((entry) => {
        try {
          return publicSample(entry);
        } catch (_) {
          return null;
        }
      }).filter(Boolean);
      return res.json({ success: true, samples, confusions });
    } catch (err) {
      console.error("Error loading handwriting OCR training samples:", err);
      return res.status(500).json({ error: "Failed to load handwriting OCR training samples" });
    }
  });

  app.get("/api/handwriting-ocr/confusions", requireIdentity, async (req, res) => {
    try {
      const trainingDir = userTrainingDir(ctx, req.identity);
      const confusionPath = path.join(trainingDir, CONFUSIONS_FILE);
      const confusions = await loadConfusions(confusionPath);
      return res.json({ success: true, confusions });
    } catch (err) {
      console.error("Error loading handwriting OCR confusions:", err);
      return res.status(500).json({ error: "Failed to load handwriting OCR confusions" });
    }
  });

  app.post("/api/handwriting-ocr/training", requireIdentity, async (req, res) => {
    try {
      const label = sanitizeLabel(req.body?.label);
      const sample = sanitizeSample(req.body?.sample);
      const trajectory = sanitizeTrajectorySample(req.body?.trajectory, label, sample);
      const imageBuffer = parsePngDataUrl(req.body?.imageDataUrl);
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      const trainingDir = userTrainingDir(ctx, req.identity);
      const samplesDir = path.join(trainingDir, SAMPLE_DIR);
      const indexPath = path.join(trainingDir, INDEX_FILE);
      const confusionPath = path.join(trainingDir, CONFUSIONS_FILE);
      await fsPromises.mkdir(samplesDir, { recursive: true });

      let imageFile = null;
      if (imageBuffer) {
        imageFile = `${id}.png`;
        await fsPromises.writeFile(path.join(samplesDir, imageFile), imageBuffer);
      }

      const index = await loadIndex(indexPath);
      const recognizedChar = firstGrapheme(req.body?.recognizedChar);
      const entry = {
        id,
        schema: trajectory ? CORRECTION_SAMPLE_SCHEMA_V2 : CORRECTION_SAMPLE_SCHEMA_V1,
        label,
        recognizedChar,
        source: sanitizeText(req.body?.source, 80),
        createdAt: now,
        sample,
        trajectory,
        imageFile,
        bounds: sanitizeBounds(req.body?.bounds),
        strokeCount: Math.max(0, Math.round(sanitizeNumber(req.body?.strokeCount))),
        segmentIndex: Math.max(0, Math.round(sanitizeNumber(req.body?.segmentIndex))),
      };
      index.version = 2;
      index.schema = "nodevision-handwriting-training-index/2";
      index.samples.push(entry);
      await pruneSamplesIfNeeded(index, trainingDir);
      await saveIndexAtomic(indexPath, index);

      let confusions = await loadConfusions(confusionPath);
      const confusionResult = recordDirectionalConfusion(confusions, recognizedChar, label, { now });
      confusions = confusionResult.confusions;
      if (confusionResult.recorded) await saveConfusionsAtomic(confusionPath, confusions);

      return res.status(201).json({ success: true, sample: publicSample(entry), count: index.samples.length, confusions });
    } catch (err) {
      const message = err?.message || "Failed to save handwriting OCR training sample";
      const status = /required|Invalid|must|large/i.test(message) ? 400 : 500;
      if (status >= 500) console.error("Error saving handwriting OCR training sample:", err);
      return res.status(status).json({ error: message });
    }
  });
}

export const handwritingOcrTrainingRouteInternals = Object.freeze({
  userTrainingDir,
  sanitizeLabel,
  sanitizeSample,
  sanitizeTrajectorySample,
  publicSample,
  loadIndex,
  loadConfusions,
  saveConfusionsAtomic,
  resolveManifestFontPath,
  existingFontPathInAllowedRoots,
  isPathWithin,
});
