// Nodevision/ApplicationSystem/public/HandwritingRecognition/StrokeRecognition/StrokeTemplateStore.mjs
// Built-in and personal template loading/validation for experimental stroke recognition.

import {
  STROKE_TEMPLATE_FORMAT_VERSION,
  STROKE_TEMPLATE_SCHEMA,
  firstGrapheme,
  sanitizeTemplateId,
} from "./StrokeGlyphModel.mjs";
import { normalizedGlyphFromTemplateStrokes, normalizeStrokeGlyph } from "./StrokeNormalizer.mjs";

export const BUILTIN_STROKE_TEMPLATE_URL = "/HandwritingRecognition/StrokeRecognition/BuiltinStrokeTemplates.json";
export const USER_STROKE_TEMPLATE_ENDPOINT = "/api/handwriting-recognition/stroke-templates";
export const STROKE_PERSONAL_TEMPLATE_SOURCE = "user-approved";

let builtinTemplateCache = null;

function safeText(value = "", max = 160) {
  return String(value || "").replace(/\u0000/g, "").slice(0, max);
}

function normalizeTemplateStrokes(rawStrokes) {
  if (!Array.isArray(rawStrokes)) return [];
  return rawStrokes.map((stroke) => {
    const points = Array.isArray(stroke?.points) ? stroke.points : stroke;
    return (Array.isArray(points) ? points : [])
      .map((point) => {
        if (Array.isArray(point)) return [Number(point[0]), Number(point[1])];
        return [Number(point?.x), Number(point?.y)];
      })
      .filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y));
  }).filter((stroke) => stroke.length);
}

export function normalizeStrokeTemplate(rawTemplate = {}, options = {}) {
  if (!rawTemplate || typeof rawTemplate !== "object") throw new Error("Template must be an object");
  if (rawTemplate.schema && rawTemplate.schema !== STROKE_TEMPLATE_SCHEMA) throw new Error("Unsupported stroke template schema");
  const character = firstGrapheme(rawTemplate.character ?? rawTemplate.char ?? rawTemplate.text);
  if (!character) throw new Error("Template is missing a character");
  const variantId = sanitizeTemplateId(rawTemplate.variantId || rawTemplate.id || `${character}-template`);
  const templateId = sanitizeTemplateId(rawTemplate.id || variantId);
  const strokes = normalizeTemplateStrokes(rawTemplate.strokes || rawTemplate.glyph?.strokes || rawTemplate.normalizedGlyph?.strokes);
  if (!strokes.length) throw new Error(`Template ${templateId} has no strokes`);
  const metadata = rawTemplate.metadata && typeof rawTemplate.metadata === "object" ? rawTemplate.metadata : {};
  const normalizedGlyph = rawTemplate.normalizedGlyph?.strokes?.length
    ? normalizeStrokeGlyph(rawTemplate.normalizedGlyph, { minRawPointDistance: 0.002, ...(options.normalizerOptions || {}) })
    : normalizedGlyphFromTemplateStrokes(strokes, options.normalizerOptions || {});
  if (!normalizedGlyph.strokes.length) throw new Error(`Template ${templateId} could not be normalized`);

  return {
    schema: STROKE_TEMPLATE_SCHEMA,
    templateFormatVersion: STROKE_TEMPLATE_FORMAT_VERSION,
    id: templateId,
    character,
    variantId,
    strokes,
    normalizedGlyph,
    metadata: {
      source: safeText(metadata.source || rawTemplate.source || options.source || "builtin"),
      strokeOrderFlexible: metadata.strokeOrderFlexible !== false,
      strokeDirectionReversible: metadata.strokeDirectionReversible !== false,
      strokesMayBeJoined: metadata.strokesMayBeJoined === true,
      ...(metadata.createdAt ? { createdAt: safeText(metadata.createdAt, 64) } : {}),
      ...(metadata.pointerType ? { pointerType: safeText(metadata.pointerType, 64) } : {}),
      ...(metadata.recognizerVersion ? { recognizerVersion: safeText(metadata.recognizerVersion, 64) } : {}),
    },
  };
}

export function normalizeStrokeTemplates(rawTemplates = [], options = {}) {
  const templates = [];
  const errors = [];
  const duplicateTemplateIds = [];
  const seen = new Set();
  for (const [index, rawTemplate] of (Array.isArray(rawTemplates) ? rawTemplates : []).entries()) {
    try {
      const template = normalizeStrokeTemplate(rawTemplate, options);
      if (seen.has(template.id)) {
        duplicateTemplateIds.push(template.id);
        errors.push({ index, id: template.id, error: "Duplicate template id" });
        continue;
      }
      seen.add(template.id);
      templates.push(template);
    } catch (err) {
      errors.push({ index, id: rawTemplate?.id || rawTemplate?.variantId || "", error: err?.message || String(err) });
    }
  }
  return { templates, errors, duplicateTemplateIds };
}

export async function loadBuiltinStrokeTemplates(options = {}) {
  if (builtinTemplateCache && options.force !== true) return builtinTemplateCache;
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  if (typeof fetchImpl !== "function") throw new Error("No fetch implementation is available for built-in stroke templates");
  const res = await fetchImpl(options.url || BUILTIN_STROKE_TEMPLATE_URL, { cache: options.force ? "reload" : "default" });
  if (!res?.ok) throw new Error(`Failed to load built-in stroke templates (${res?.status || "no response"})`);
  const data = await res.json();
  const rawTemplates = Array.isArray(data?.templates) ? data.templates : (Array.isArray(data) ? data : []);
  builtinTemplateCache = normalizeStrokeTemplates(rawTemplates, { source: "builtin" });
  return builtinTemplateCache;
}

export async function loadUserStrokeTemplates(options = {}) {
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  if (typeof fetchImpl !== "function") return { templates: [], errors: [{ error: "No fetch implementation" }], duplicateTemplateIds: [] };
  try {
    const res = await fetchImpl(options.endpoint || USER_STROKE_TEMPLATE_ENDPOINT, {
      cache: "no-store",
      credentials: "include",
      headers: { Accept: "application/json" },
    });
    if (!res?.ok) throw new Error(`User stroke template load failed (${res?.status || "no response"})`);
    const data = await res.json();
    const rawTemplates = Array.isArray(data?.templates) ? data.templates : [];
    return normalizeStrokeTemplates(rawTemplates, { source: STROKE_PERSONAL_TEMPLATE_SOURCE });
  } catch (err) {
    return { templates: [], errors: [{ error: err?.message || String(err) }], duplicateTemplateIds: [] };
  }
}

export function makePersonalStrokeTemplatePayload({ character, glyph, rawGlyph = null, metadata = {} } = {}) {
  const char = firstGrapheme(character);
  if (!char) throw new Error("A template character is required");
  const normalizedGlyph = normalizeStrokeGlyph(glyph || rawGlyph || {});
  if (!normalizedGlyph.strokes.length) throw new Error("A drawn glyph is required");
  const now = new Date().toISOString();
  const id = sanitizeTemplateId(`user-${char.codePointAt(0).toString(16)}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`);
  return {
    schema: STROKE_TEMPLATE_SCHEMA,
    templateFormatVersion: STROKE_TEMPLATE_FORMAT_VERSION,
    id,
    character: char,
    variantId: id,
    strokes: normalizedGlyph.strokes.map((stroke) => stroke.points.map((point) => [Number(point.x.toFixed(4)), Number(point.y.toFixed(4))])),
    normalizedGlyph: {
      schema: normalizedGlyph.schema,
      strokes: normalizedGlyph.strokes,
      bounds: normalizedGlyph.bounds,
      originalBounds: normalizedGlyph.originalBounds,
      duration: normalizedGlyph.duration,
      pointerType: normalizedGlyph.pointerType,
      canvas: normalizedGlyph.canvas,
      metadata: normalizedGlyph.metadata,
    },
    rawGlyph: rawGlyph || null,
    metadata: {
      source: STROKE_PERSONAL_TEMPLATE_SOURCE,
      createdAt: now,
      recognizerVersion: "experimental-stroke-recognizer/1",
      templateFormatVersion: STROKE_TEMPLATE_FORMAT_VERSION,
      pointerType: normalizedGlyph.pointerType || "unknown",
      ...(metadata && typeof metadata === "object" ? metadata : {}),
    },
  };
}

export async function saveUserStrokeTemplate(payload, options = {}) {
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  if (typeof fetchImpl !== "function") throw new Error("No fetch implementation is available to save templates");
  const res = await fetchImpl(options.endpoint || USER_STROKE_TEMPLATE_ENDPOINT, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `Template save failed (${res.status})`);
  return data?.template || payload;
}
