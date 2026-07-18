// Nodevision/ApplicationSystem/public/ScadEditor/ScadParser.mjs
// Best-effort parser for graphical SCAD metadata and a small OpenSCAD subset.

import { createEmptyScadModel, addObject, normalizeScadModel } from "./ScadModel.mjs";
import { MODEL_BLOCK_START, MODEL_BLOCK_END } from "./ScadSerializer.mjs";

export function extractEmbeddedScadModel(scadText = "") {
  const text = String(scadText || "");
  const start = text.indexOf(MODEL_BLOCK_START);
  if (start < 0) return null;
  const jsonStart = start + MODEL_BLOCK_START.length;
  const end = text.indexOf(MODEL_BLOCK_END, jsonStart);
  if (end < 0) throw new Error("Nodevision SCAD metadata block is not closed.");
  const jsonText = text.slice(jsonStart, end).trim();
  return normalizeScadModel(JSON.parse(jsonText));
}

function parseNumber(value, fallback = 0) {
  const num = Number(String(value || "").trim());
  return Number.isFinite(num) ? num : fallback;
}

function parseParameterValue(value = "") {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (/^(true|false)$/i.test(raw)) return raw.toLowerCase() === "true";
  const num = Number(raw);
  return Number.isFinite(num) ? num : raw;
}

function parsePointsLiteral(value = "") {
  const points = [];
  const re = /\[\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\]/g;
  let match;
  while ((match = re.exec(value))) points.push([parseNumber(match[1]), parseNumber(match[2])]);
  return points;
}

function parseTransformPrefix(prefix = "") {
  const transform = {};
  const translate = /translate\s*\(\s*\[([^\]]+)\]\s*\)/i.exec(prefix);
  const rotate = /rotate\s*\(\s*\[([^\]]+)\]\s*\)/i.exec(prefix);
  const scale = /scale\s*\(\s*\[([^\]]+)\]\s*\)/i.exec(prefix);
  const vec = (raw, fallback) => String(raw || "").split(",").map((v, i) => parseNumber(v, fallback[i] ?? 0)).slice(0, 3);
  if (translate) transform.translate = vec(translate[1], [0, 0, 0]);
  if (rotate) transform.rotate = vec(rotate[1], [0, 0, 0]);
  if (scale) transform.scale = vec(scale[1], [1, 1, 1]);
  return transform;
}

function addParsedObject(model, input) {
  const obj = addObject(model, input, { timeline: false });
  model.timeline.push({
    id: `step_import_${model.timeline.length + 1}`,
    type: "create",
    objectIds: [obj.id],
    label: `Imported ${input.type}`,
    timestamp: new Date().toISOString(),
    params: { imported: true },
    disabled: false,
  });
}

export function parseBasicScad(scadText = "") {
  const source = String(scadText || "");
  const model = createEmptyScadModel();
  const withoutComments = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  const assignmentRe = new RegExp("^\\s*([A-Za-z_][A-Za-z0-9_]*)\\s*=\\s*([^;{}]+);", "gm");
  let assignmentMatch;
  while ((assignmentMatch = assignmentRe.exec(withoutComments))) {
    model.parameters[assignmentMatch[1]] = parseParameterValue(assignmentMatch[2]);
  }
  const statementRe = /((?:translate\s*\([^;{}]+\)\s*)?(?:rotate\s*\([^;{}]+\)\s*)?(?:scale\s*\([^;{}]+\)\s*)?(?:linear_extrude\s*\([^;{}]+\)\s*)?)(circle\s*\([^;]+\)|square\s*\([^;]+\)|polygon\s*\([^;]+\)|text\s*\([^;]+\)|sphere\s*\([^;]+\)|cube\s*\([^;]+\)|cylinder\s*\([^;]+\))\s*;/gi;
  let match;
  while ((match = statementRe.exec(withoutComments))) {
    const prefix = match[1] || "";
    const primitive = match[2] || "";
    const transform = parseTransformPrefix(prefix);
    const extrude = /linear_extrude\s*\([^)]*height\s*=\s*([^,)]+)[^)]*\)/i.exec(prefix);
    const operations = extrude ? [{ type: "extrude", params: { height: parseNumber(extrude[1], 10) } }] : [];
    if (/^circle/i.test(primitive)) {
      const radius = /\br\s*=\s*([^,)]+)/i.exec(primitive) || /\bd\s*=\s*([^,)]+)/i.exec(primitive);
      const usesDiameter = /\bd\s*=/.test(radius?.[0] || "");
      addParsedObject(model, { type: "circle", name: "Imported circle", params: { radius: usesDiameter ? parseNumber(radius?.[1], 10) / 2 : parseNumber(radius?.[1], 5) }, transform, operations });
      continue;
    }
    if (/^text/i.test(primitive)) {
      const quoted = /text\s*\(\s*(?:"([^"]*)"|'([^']*)')/i.exec(primitive);
      const named = /text\s*=\s*(?:"([^"]*)"|'([^']*)')/i.exec(primitive);
      const size = /\bsize\s*=\s*([^,)]+)/i.exec(primitive);
      const value = quoted?.[1] || quoted?.[2] || named?.[1] || named?.[2] || "Text";
      addParsedObject(model, { type: "text", name: "Imported text", params: { text: value, size: parseNumber(size?.[1], 10), font: "Liberation Sans", halign: "center", valign: "center" }, transform, operations });
      continue;
    }
    if (/^sphere/i.test(primitive)) {
      const radius = /\br\s*=\s*([^,)]+)/i.exec(primitive) || /\bd\s*=\s*([^,)]+)/i.exec(primitive);
      const usesDiameter = /\bd\s*=/.test(radius?.[0] || "");
      addParsedObject(model, { type: "sphere", name: "Imported sphere", params: { radius: usesDiameter ? parseNumber(radius?.[1], 12) / 2 : parseNumber(radius?.[1], 6), segments: 48 }, transform, operations });
      continue;
    }
    if (/^cube/i.test(primitive)) {
      const dims = /cube\s*\(\s*\[([^\]]+)\]/i.exec(primitive);
      const scalar = /cube\s*\(\s*([^,\)]+)/i.exec(primitive);
      const parts = dims ? String(dims[1] || "12,12,12").split(",") : [scalar?.[1] || 12, scalar?.[1] || 12, scalar?.[1] || 12];
      addParsedObject(model, { type: "cube", name: "Imported cube", params: { size: [parseNumber(parts[0], 12), parseNumber(parts[1], 12), parseNumber(parts[2], 12)], center: /center\s*=\s*true/i.test(primitive) }, transform, operations });
      continue;
    }
    if (/^cylinder/i.test(primitive)) {
      const height = /\bh\s*=\s*([^,)]+)/i.exec(primitive);
      const radius = /\br\s*=\s*([^,)]+)/i.exec(primitive) || /\bd\s*=\s*([^,)]+)/i.exec(primitive);
      const usesDiameter = /\bd\s*=/.test(radius?.[0] || "");
      addParsedObject(model, { type: "cylinder", name: "Imported cylinder", params: { height: parseNumber(height?.[1], 16), radius: usesDiameter ? parseNumber(radius?.[1], 10) / 2 : parseNumber(radius?.[1], 5), segments: 48, center: /center\s*=\s*true/i.test(primitive) }, transform, operations });
      continue;
    }
    if (/^square/i.test(primitive)) {
      const body = primitive.slice(primitive.indexOf("(") + 1, primitive.lastIndexOf(")")).trim();
      const centerText = primitive.toLowerCase().replaceAll(" ", "");
      const center = centerText.includes("center=true");
      if (body.startsWith("[")) {
        const close = body.indexOf("]");
        const parts = body.slice(1, close < 0 ? body.length : close).split(",");
        addParsedObject(model, { type: "rectangle", name: "Imported rectangle", params: { width: parseNumber(parts[0], 20), height: parseNumber(parts[1], 10), center }, transform, operations });
      } else {
        const sizeText = body.split(",")[0];
        addParsedObject(model, { type: "square", name: "Imported square", params: { size: parseNumber(sizeText, 12), center }, transform, operations });
      }
      continue;
    }
    if (/^polygon/i.test(primitive)) {
      const pointsRaw = /points\s*=\s*(\[[\s\S]*\])\s*\)?$/i.exec(primitive)?.[1] || "";
      const points = parsePointsLiteral(pointsRaw);
      addParsedObject(model, { type: points.length === 3 ? "triangle" : "polygon", name: "Imported polygon", params: { points }, transform, operations });
    }
  }
  const hasParameters = Object.keys(model.parameters || {}).length > 0;
  if (!model.objects.length && source.trim() && !hasParameters) {
    model.unsupportedSource = source;
    model.warnings.push("Graphical SCAD could not import this source. Supported primitives are circle, square, polygon, text, sphere, cube, cylinder, and linear_extrude wrappers.");
  }
  return model;
}

export function parseScadText(scadText = "") {
  const embedded = extractEmbeddedScadModel(scadText);
  if (embedded) return { model: embedded, source: "metadata", warnings: embedded.warnings || [] };
  const model = parseBasicScad(scadText);
  const hasGraphicalContent = model.objects.length || Object.keys(model.parameters || {}).length;
  return { model, source: hasGraphicalContent ? "best-effort" : "unsupported", warnings: model.warnings || [] };
}
