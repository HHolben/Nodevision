// Nodevision/ApplicationSystem/server/routes/strokeHandwritingRecognitionRoutes.mjs
// Stores user-approved experimental stroke-recognition templates under UserData.

import fsPromises from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import {
  STROKE_TEMPLATE_FORMAT_VERSION,
  coerceStrokeGlyph,
  firstGrapheme,
  sanitizeTemplateId,
} from "../../public/HandwritingRecognition/StrokeRecognition/StrokeGlyphModel.mjs";
import {
  STROKE_PERSONAL_TEMPLATE_SOURCE,
  normalizeStrokeTemplate,
} from "../../public/HandwritingRecognition/StrokeRecognition/StrokeTemplateStore.mjs";

const STORAGE_ROOT = "HandwritingRecognition";
const TEMPLATE_ROOT = "StrokeTemplates";
const MAX_TEMPLATE_FILES = 2000;
const MAX_RAW_POINTS = 12000;
const MAX_STROKES = 64;

function requireIdentity(req, res, next) {
  if (req.identity) return next();
  return res.status(401).json({ error: "Authentication required" });
}

function userTemplateDir(ctx, identity) {
  const numericId = Number(identity?.id);
  const segment = Number.isInteger(numericId)
    ? `user-${numericId}`
    : `user-${crypto.createHash("sha256").update(String(identity?.username || "unknown")).digest("hex").slice(0, 16)}`;
  return path.join(ctx.userDataDir, STORAGE_ROOT, TEMPLATE_ROOT, "users", segment);
}

function sanitizeText(value = "", maxLength = 160) {
  return String(value || "").replace(/\u0000/g, "").slice(0, maxLength);
}

function sanitizeRawGlyph(rawGlyph) {
  if (!rawGlyph) return null;
  const glyph = coerceStrokeGlyph(rawGlyph);
  if (!glyph.strokes.length) return null;
  let pointCount = 0;
  const strokes = [];
  for (const stroke of glyph.strokes.slice(0, MAX_STROKES)) {
    const points = [];
    for (const point of stroke.points || []) {
      if (pointCount >= MAX_RAW_POINTS) break;
      points.push({
        x: Number(point.x),
        y: Number(point.y),
        t: Number.isFinite(Number(point.t)) ? Number(point.t) : 0,
        pressure: Number.isFinite(Number(point.pressure)) ? Math.max(0, Math.min(1, Number(point.pressure))) : 0.5,
        tiltX: Number.isFinite(Number(point.tiltX)) ? Number(point.tiltX) : 0,
        tiltY: Number.isFinite(Number(point.tiltY)) ? Number(point.tiltY) : 0,
      });
      pointCount += 1;
    }
    if (points.length) strokes.push({ points });
  }
  if (!strokes.length) return null;
  return {
    schema: glyph.schema,
    strokes,
    bounds: glyph.bounds,
    duration: glyph.duration,
    pointerType: sanitizeText(glyph.pointerType || "unknown", 64),
    canvas: glyph.canvas || null,
    metadata: {
      strokeCount: strokes.length,
      pointCount,
    },
  };
}

function templateFilename(template) {
  const char = firstGrapheme(template.character || "glyph") || "glyph";
  const charCode = char.codePointAt(0).toString(16);
  const id = sanitizeTemplateId(template.id || template.variantId || crypto.randomUUID());
  return `${charCode}-${id}.json`;
}

async function readTemplateFile(filePath) {
  const raw = await fsPromises.readFile(filePath, "utf8");
  const parsed = JSON.parse(raw);
  return normalizeStrokeTemplate(parsed, { source: STROKE_PERSONAL_TEMPLATE_SOURCE });
}

async function listStoredTemplates(dir) {
  try {
    const entries = await fsPromises.readdir(dir, { withFileTypes: true });
    const files = entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".json") && entry.name !== "index.json")
      .slice(0, MAX_TEMPLATE_FILES);
    const templates = [];
    const errors = [];
    for (const file of files) {
      try {
        templates.push(await readTemplateFile(path.join(dir, file.name)));
      } catch (err) {
        errors.push({ file: file.name, error: err?.message || String(err) });
      }
    }
    return { templates, errors };
  } catch (err) {
    if (err.code === "ENOENT") return { templates: [], errors: [] };
    throw err;
  }
}

function prepareTemplateForStorage(rawTemplate) {
  const incoming = rawTemplate?.template && typeof rawTemplate.template === "object" ? rawTemplate.template : rawTemplate;
  if (!incoming || typeof incoming !== "object") throw new Error("Template payload is required");
  const character = firstGrapheme(incoming.character || incoming.text || incoming.char);
  if (!character) throw new Error("Template character is required");
  const now = new Date().toISOString();
  const id = sanitizeTemplateId(incoming.id || incoming.variantId || `user-${character.codePointAt(0).toString(16)}-${crypto.randomUUID()}`);
  const normalized = normalizeStrokeTemplate({
    ...incoming,
    id,
    variantId: incoming.variantId || id,
    character,
    metadata: {
      ...(incoming.metadata && typeof incoming.metadata === "object" ? incoming.metadata : {}),
      source: STROKE_PERSONAL_TEMPLATE_SOURCE,
      createdAt: sanitizeText(incoming.metadata?.createdAt || now, 64),
      recognizerVersion: sanitizeText(incoming.metadata?.recognizerVersion || "experimental-stroke-recognizer/1", 64),
      templateFormatVersion: STROKE_TEMPLATE_FORMAT_VERSION,
    },
  }, { source: STROKE_PERSONAL_TEMPLATE_SOURCE });

  return {
    ...normalized,
    rawGlyph: sanitizeRawGlyph(incoming.rawGlyph),
    metadata: {
      ...normalized.metadata,
      source: STROKE_PERSONAL_TEMPLATE_SOURCE,
      createdAt: normalized.metadata.createdAt || now,
      recognizerVersion: normalized.metadata.recognizerVersion || "experimental-stroke-recognizer/1",
      templateFormatVersion: STROKE_TEMPLATE_FORMAT_VERSION,
    },
  };
}

async function writeTemplate(dir, template) {
  await fsPromises.mkdir(dir, { recursive: true });
  const file = templateFilename(template);
  const tempPath = path.join(dir, `${file}.tmp`);
  const finalPath = path.join(dir, file);
  await fsPromises.writeFile(tempPath, `${JSON.stringify(template, null, 2)}\n`, "utf8");
  await fsPromises.rename(tempPath, finalPath);
  return { file, path: finalPath };
}

export function registerStrokeHandwritingRecognitionRoutes(app, ctx) {
  app.get("/api/handwriting-recognition/stroke-templates", requireIdentity, async (req, res) => {
    try {
      const dir = userTemplateDir(ctx, req.identity);
      const listed = await listStoredTemplates(dir);
      res.json({
        templates: listed.templates,
        errors: listed.errors,
        storageRoot: path.join("UserData", STORAGE_ROOT, TEMPLATE_ROOT),
      });
    } catch (err) {
      console.error("Error loading stroke handwriting templates:", err);
      res.status(500).json({ error: "Failed to load stroke handwriting templates" });
    }
  });

  app.post("/api/handwriting-recognition/stroke-templates", requireIdentity, async (req, res) => {
    try {
      const dir = userTemplateDir(ctx, req.identity);
      const template = prepareTemplateForStorage(req.body || {});
      const written = await writeTemplate(dir, template);
      res.status(201).json({ template, file: written.file, storageRoot: path.join("UserData", STORAGE_ROOT, TEMPLATE_ROOT) });
    } catch (err) {
      const message = err?.message || "Failed to save stroke handwriting template";
      const status = /required|missing|unsupported|invalid|no strokes/i.test(message) ? 400 : 500;
      if (status >= 500) console.error("Error saving stroke handwriting template:", err);
      res.status(status).json({ error: message });
    }
  });
}

export const strokeHandwritingRecognitionRouteInternals = Object.freeze({
  userTemplateDir,
  sanitizeRawGlyph,
  prepareTemplateForStorage,
  listStoredTemplates,
});
