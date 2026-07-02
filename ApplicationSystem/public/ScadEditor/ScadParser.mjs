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
  const statementRe = /((?:translate\s*\([^;{}]+\)\s*)?(?:rotate\s*\([^;{}]+\)\s*)?(?:scale\s*\([^;{}]+\)\s*)?(?:linear_extrude\s*\([^;{}]+\)\s*)?)(circle\s*\([^;]+\)|square\s*\([^;]+\)|polygon\s*\([^;]+\))\s*;/gi;
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
    if (/^square/i.test(primitive)) {
      const dims = /square\s*\(\s*\[([^\]]+)\]/i.exec(primitive);
      const parts = String(dims?.[1] || "20,10").split(",");
      addParsedObject(model, { type: "rectangle", name: "Imported rectangle", params: { width: parseNumber(parts[0], 20), height: parseNumber(parts[1], 10), center: /center\s*=\s*true/i.test(primitive) }, transform, operations });
      continue;
    }
    if (/^polygon/i.test(primitive)) {
      const pointsRaw = /points\s*=\s*(\[[\s\S]*\])\s*\)?$/i.exec(primitive)?.[1] || "";
      const points = parsePointsLiteral(pointsRaw);
      addParsedObject(model, { type: points.length === 3 ? "triangle" : "polygon", name: "Imported polygon", params: { points }, transform, operations });
    }
  }
  if (!model.objects.length && source.trim()) {
    model.unsupportedSource = source;
    model.warnings.push("Graphical SCAD could not import this source. Supported primitives are circle, square, polygon, and linear_extrude wrappers.");
  }
  return model;
}

export function parseScadText(scadText = "") {
  const embedded = extractEmbeddedScadModel(scadText);
  if (embedded) return { model: embedded, source: "metadata", warnings: embedded.warnings || [] };
  const model = parseBasicScad(scadText);
  return { model, source: model.objects.length ? "best-effort" : "unsupported", warnings: model.warnings || [] };
}
