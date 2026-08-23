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
  const text = String(value ?? "").trim();
  if (!text) return fallback;
  const num = Number(text);
  return Number.isFinite(num) ? num : fallback;
}

function stripScadComments(source = "") {
  return String(source || "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

function splitTopLevel(value = "", separator = ",") {
  const text = String(value || "");
  const parts = [];
  let depth = 0;
  let quote = "";
  let start = 0;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quote) {
      if (ch === "\\") i += 1;
      else if (ch === quote) quote = "";
      continue;
    }
    if (ch === "\"" || ch.charCodeAt(0) === 39) {
      quote = ch;
      continue;
    }
    if (ch === "(" || ch === "[" || ch === "{") depth += 1;
    else if (ch === ")" || ch === "]" || ch === "}") depth = Math.max(0, depth - 1);
    else if (ch === separator && depth === 0) {
      parts.push(text.slice(start, i).trim());
      start = i + 1;
    }
  }
  parts.push(text.slice(start).trim());
  return parts.filter((part) => part.length);
}

function evaluateScadNumberExpression(expression = "", scope = {}, fallback = NaN) {
  const text = String(expression || "").trim();
  if (!text) return fallback;
  let index = 0;

  function skipWhitespace() {
    while (/\s/.test(text[index] || "")) index += 1;
  }

  function parseIdentifier() {
    const match = /^[$A-Za-z_][$A-Za-z0-9_]*/.exec(text.slice(index));
    if (!match) return null;
    index += match[0].length;
    return match[0];
  }

  function parseNumericLiteral() {
    const match = /^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/.exec(text.slice(index));
    if (!match) return null;
    index += match[0].length;
    return Number(match[0]);
  }

  function parsePrimary() {
    skipWhitespace();
    if (text[index] === "(") {
      index += 1;
      const value = parseExpression();
      skipWhitespace();
      if (text[index] !== ")") throw new Error("Expected closing parenthesis");
      index += 1;
      return value;
    }

    const literal = parseNumericLiteral();
    if (literal !== null) return literal;

    const identifier = parseIdentifier();
    if (identifier) {
      const rawValue = scope && Object.prototype.hasOwnProperty.call(scope, identifier) ? scope[identifier] : undefined;
      if (typeof rawValue === "number" && Number.isFinite(rawValue)) return rawValue;
      if (identifier === "PI" || identifier === "pi") return Math.PI;
      throw new Error("Unknown identifier " + identifier);
    }

    throw new Error("Expected numeric value");
  }

  function parseUnary() {
    skipWhitespace();
    if (text[index] === "+") {
      index += 1;
      return parseUnary();
    }
    if (text[index] === "-") {
      index += 1;
      return -parseUnary();
    }
    return parsePrimary();
  }

  function parseTerm() {
    let value = parseUnary();
    while (true) {
      skipWhitespace();
      const op = text[index];
      if (op !== "*" && op !== "/") break;
      index += 1;
      const rhs = parseUnary();
      value = op === "*" ? value * rhs : value / rhs;
    }
    return value;
  }

  function parseExpression() {
    let value = parseTerm();
    while (true) {
      skipWhitespace();
      const op = text[index];
      if (op !== "+" && op !== "-") break;
      index += 1;
      const rhs = parseTerm();
      value = op === "+" ? value + rhs : value - rhs;
    }
    return value;
  }

  try {
    const value = parseExpression();
    skipWhitespace();
    return index >= text.length && Number.isFinite(value) ? value : fallback;
  } catch (err) {
    return fallback;
  }
}

function parseScadNumber(value, scope = {}, fallback = 0) {
  const num = evaluateScadNumberExpression(value, scope, NaN);
  return Number.isFinite(num) ? num : parseNumber(value, fallback);
}

function parseScadVector(value = "", scope = {}, fallback = [0, 0, 0]) {
  const parts = splitTopLevel(value);
  return [0, 1, 2].map((index) => parseScadNumber(parts[index], scope, fallback[index] ?? 0));
}

function parseParameterValue(value = "", scope = {}) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (/^(true|false)$/i.test(raw)) return raw.toLowerCase() === "true";
  if (/^[$A-Za-z_][$A-Za-z0-9_]*$/.test(raw) && scope && Object.prototype.hasOwnProperty.call(scope, raw)) return scope[raw];
  if (raw.startsWith("[") && raw.endsWith("]")) return splitTopLevel(raw.slice(1, -1)).map((part) => parseParameterValue(part, scope));
  const num = evaluateScadNumberExpression(raw, scope, NaN);
  return Number.isFinite(num) ? num : raw;
}

function parsePointsLiteral(value = "", scope = {}) {
  const points = [];
  const re = /\[\s*([^\[\],]+)\s*,\s*([^\[\],]+)\s*\]/g;
  let match;
  while ((match = re.exec(value))) points.push([parseScadNumber(match[1], scope), parseScadNumber(match[2], scope)]);
  return points;
}

function parseTransformPrefix(prefix = "", scope = {}) {
  const transform = {};
  const translate = /translate\s*\(\s*\[([^\]]+)\]\s*\)/i.exec(prefix);
  const rotate = /rotate\s*\(\s*\[([^\]]+)\]\s*\)/i.exec(prefix);
  const scale = /scale\s*\(\s*\[([^\]]+)\]\s*\)/i.exec(prefix);
  if (translate) transform.translate = parseScadVector(translate[1], scope, [0, 0, 0]);
  if (rotate) transform.rotate = parseScadVector(rotate[1], scope, [0, 0, 0]);
  if (scale) transform.scale = parseScadVector(scale[1], scope, [1, 1, 1]);
  return transform;
}

function primitiveBody(primitive = "") {
  const start = String(primitive || "").indexOf("(");
  const end = String(primitive || "").lastIndexOf(")");
  return start >= 0 && end > start ? String(primitive).slice(start + 1, end).trim() : "";
}

function firstTopLevelArg(body = "") {
  const parts = splitTopLevel(body);
  return parts[0] || "";
}

function parseFnSegments(primitive = "", fallback = 48, scope = {}) {
  const fn = /\$fn\s*=\s*([^,)]+)/i.exec(primitive);
  const inherited = Number.isFinite(Number(scope?.$fn)) ? Number(scope.$fn) : fallback;
  return Math.max(8, Math.round(parseScadNumber(fn?.[1], scope, inherited)));
}

function parseCenterFlag(primitive = "", scope = {}, fallback = false) {
  const match = /\bcenter\s*=\s*([^,)]+)/i.exec(primitive);
  if (!match) return fallback;
  const value = parseParameterValue(match[1], scope);
  return value === true || String(value).trim().toLowerCase() === "true";
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
  const withoutComments = stripScadComments(source);
  const scope = {};
  const assignmentRe = /^\s*([$A-Za-z_][$A-Za-z0-9_]*)\s*=\s*([^;{}]+);/gm;
  let assignmentMatch;
  while ((assignmentMatch = assignmentRe.exec(withoutComments))) {
    const value = parseParameterValue(assignmentMatch[2], scope);
    model.parameters[assignmentMatch[1]] = value;
    scope[assignmentMatch[1]] = value;
  }
  const statementRe = /((?:translate\s*\([^;{}]+\)\s*)?(?:rotate\s*\([^;{}]+\)\s*)?(?:scale\s*\([^;{}]+\)\s*)?(?:linear_extrude\s*\([^;{}]+\)\s*)?)(circle\s*\([^;]+\)|square\s*\([^;]+\)|polygon\s*\([^;]+\)|text\s*\([^;]+\)|sphere\s*\([^;]+\)|cube\s*\([^;]+\)|cylinder\s*\([^;]+\))\s*;/gi;
  let match;
  while ((match = statementRe.exec(withoutComments))) {
    const prefix = match[1] || "";
    const primitive = match[2] || "";
    const transform = parseTransformPrefix(prefix, scope);
    const extrude = /linear_extrude\s*\([^)]*height\s*=\s*([^,)]+)[^)]*\)/i.exec(prefix);
    const operations = extrude ? [{ type: "extrude", params: { height: parseScadNumber(extrude[1], scope, 10) } }] : [];
    if (/^circle/i.test(primitive)) {
      const radius = /\br\s*=\s*([^,)]+)/i.exec(primitive) || /\bd\s*=\s*([^,)]+)/i.exec(primitive);
      const usesDiameter = /\bd\s*=/.test(radius?.[0] || "");
      addParsedObject(model, { type: "circle", name: "Imported circle", params: { radius: usesDiameter ? parseScadNumber(radius?.[1], scope, 10) / 2 : parseScadNumber(radius?.[1], scope, 5) }, transform, operations });
      continue;
    }
    if (/^text/i.test(primitive)) {
      const quoted = /text\s*\(\s*(?:"([^"]*)"|\x27([^\x27]*)\x27)/i.exec(primitive);
      const named = /text\s*=\s*(?:"([^"]*)"|\x27([^\x27]*)\x27)/i.exec(primitive);
      const size = /\bsize\s*=\s*([^,)]+)/i.exec(primitive);
      const value = quoted?.[1] || quoted?.[2] || named?.[1] || named?.[2] || "Text";
      addParsedObject(model, { type: "text", name: "Imported text", params: { text: value, size: parseScadNumber(size?.[1], scope, 10), font: "Liberation Sans", halign: "center", valign: "center" }, transform, operations });
      continue;
    }
    if (/^sphere/i.test(primitive)) {
      const body = primitiveBody(primitive);
      const radius = /\br\s*=\s*([^,)]+)/i.exec(primitive) || /\bd\s*=\s*([^,)]+)/i.exec(primitive);
      const positional = firstTopLevelArg(body);
      const positionalRadius = positional && !positional.includes("=") ? positional : undefined;
      const usesDiameter = /\bd\s*=/i.test(radius?.[0] || "");
      const radiusValue = usesDiameter
        ? parseScadNumber(radius?.[1], scope, 12) / 2
        : parseScadNumber(radius?.[1] ?? positionalRadius, scope, 6);
      addParsedObject(model, { type: "sphere", name: "Imported sphere", params: { radius: radiusValue, segments: parseFnSegments(primitive, 48, scope) }, transform, operations });
      continue;
    }
    if (/^cube/i.test(primitive)) {
      const dims = /cube\s*\(\s*\[([^\]]+)\]/i.exec(primitive);
      const scalar = /cube\s*\(\s*([^,)]+)/i.exec(primitive);
      const parts = dims ? splitTopLevel(dims[1] || "12,12,12") : [scalar?.[1] || 12, scalar?.[1] || 12, scalar?.[1] || 12];
      addParsedObject(model, { type: "cube", name: "Imported cube", params: { size: [parseScadNumber(parts[0], scope, 12), parseScadNumber(parts[1], scope, 12), parseScadNumber(parts[2], scope, 12)], center: parseCenterFlag(primitive, scope, false) }, transform, operations });
      continue;
    }
    if (/^cylinder/i.test(primitive)) {
      const height = /\bh\s*=\s*([^,)]+)/i.exec(primitive);
      const radius = /\br\s*=\s*([^,)]+)/i.exec(primitive) || /\bd\s*=\s*([^,)]+)/i.exec(primitive);
      const usesDiameter = /\bd\s*=/.test(radius?.[0] || "");
      addParsedObject(model, { type: "cylinder", name: "Imported cylinder", params: { height: parseScadNumber(height?.[1], scope, 16), radius: usesDiameter ? parseScadNumber(radius?.[1], scope, 10) / 2 : parseScadNumber(radius?.[1], scope, 5), segments: parseFnSegments(primitive, 48, scope), center: parseCenterFlag(primitive, scope, false) }, transform, operations });
      continue;
    }
    if (/^square/i.test(primitive)) {
      const body = primitive.slice(primitive.indexOf("(") + 1, primitive.lastIndexOf(")")).trim();
      const center = parseCenterFlag(primitive, scope, false);
      if (body.startsWith("[")) {
        const close = body.indexOf("]");
        const parts = splitTopLevel(body.slice(1, close < 0 ? body.length : close));
        addParsedObject(model, { type: "rectangle", name: "Imported rectangle", params: { width: parseScadNumber(parts[0], scope, 20), height: parseScadNumber(parts[1], scope, 10), center }, transform, operations });
      } else {
        const sizeText = splitTopLevel(body)[0];
        addParsedObject(model, { type: "square", name: "Imported square", params: { size: parseScadNumber(sizeText, scope, 12), center }, transform, operations });
      }
      continue;
    }
    if (/^polygon/i.test(primitive)) {
      const pointsRaw = /points\s*=\s*(\[[\s\S]*\])\s*\)?$/i.exec(primitive)?.[1] || "";
      const points = parsePointsLiteral(pointsRaw, scope);
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
