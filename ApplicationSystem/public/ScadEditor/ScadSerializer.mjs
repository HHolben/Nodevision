// Nodevision/ApplicationSystem/public/ScadEditor/ScadSerializer.mjs
// Serializer for Nodevision graphical SCAD models.

import { normalizeScadModel } from "./ScadModel.mjs";

export const MODEL_BLOCK_START = "/* nodevision-scad-model:";
export const MODEL_BLOCK_END = "*/";

function n(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function bool(value) {
  return value ? "true" : "false";
}

function fmtNumber(value) {
  const num = n(value, 0);
  return Number.isInteger(num) ? String(num) : String(Number(num.toFixed(5)));
}

function vec(values = [], size = 3, fallback = 0) {
  const arr = Array.isArray(values) ? values : [];
  return Array.from({ length: size }, (_, i) => fmtNumber(arr[i] ?? fallback));
}

function qName(name = "") {
  return String(name || "").replace(/[^a-zA-Z0-9_ -]/g, "").trim();
}

function qString(value = "") {
  return JSON.stringify(String(value || ""));
}

function indentLines(lines, spaces = 2) {
  const pad = " ".repeat(spaces);
  return lines.map((line) => line ? pad + line : line);
}

function pointsLiteral(points = []) {
  return `[${points.map((pt) => `[${fmtNumber(pt?.[0] ?? 0)}, ${fmtNumber(pt?.[1] ?? 0)}]`).join(", ")}]`;
}

function points3Literal(points = []) {
  return "[" + points.map((pt) => {
    const arr = Array.isArray(pt) ? pt : [];
    return "[" + fmtNumber(arr[0]) + ", " + fmtNumber(arr[1]) + ", " + fmtNumber(arr[2]) + "]";
  }).join(", ") + "]";
}

function facesLiteral(faces = []) {
  return "[" + faces.map((face) => {
    const arr = Array.isArray(face) ? face : [];
    return "[" + arr.map((index) => Math.max(0, Math.round(n(index, 0)))).join(", ") + "]";
  }).join(", ") + "]";
}

function primitiveLines(obj) {
  const p = obj.params || {};
  if (obj.type === "circle") return ["circle(r = " + fmtNumber(p.radius ?? p.r ?? 5) + ", $fn = " + Math.max(8, Math.round(n(p.segments, 48))) + ");"];
  if (obj.type === "rectangle") return ["square([" + fmtNumber(p.width ?? 20) + ", " + fmtNumber(p.height ?? 10) + "], center = " + bool(p.center) + ");"];
  if (obj.type === "square") return ["square(" + fmtNumber(p.size ?? 12) + ", center = " + bool(p.center) + ");"];
  if (obj.type === "line") {
    const points = Array.isArray(p.points) && p.points.length >= 2 ? p.points : [[0, 0], [20, 0]];
    const radius = Math.max(0.01, n(p.strokeWidth, 0.5) / 2);
    const a = points[0] || [0, 0];
    const b = points[1] || [20, 0];
    return [
      "hull() {",
      "  translate([" + fmtNumber(a[0] || 0) + ", " + fmtNumber(a[1] || 0) + "]) circle(r = " + fmtNumber(radius) + ", $fn = 12);",
      "  translate([" + fmtNumber(b[0] || 0) + ", " + fmtNumber(b[1] || 0) + "]) circle(r = " + fmtNumber(radius) + ", $fn = 12);",
      "}",
    ];
  }
  if (obj.type === "triangle") return ["polygon(points = " + pointsLiteral(p.points || [[0, 0], [10, 0], [5, 8]]) + ");"];
  if (obj.type === "polygon" || obj.type === "vertexPath") return ["polygon(points = " + pointsLiteral(p.points || []) + ");"];
  if (obj.type === "text") return ["text(text = " + qString(p.text || "Text") + ", size = " + fmtNumber(p.size ?? 10) + ", font = " + qString(p.font || "Liberation Sans") + ", halign = " + qString(p.halign || "center") + ", valign = " + qString(p.valign || "center") + ");"];
  if (obj.type === "sphere") return ["sphere(r = " + fmtNumber(p.radius ?? 6) + ", $fn = " + Math.max(8, Math.round(n(p.segments, 48))) + ");"];
  if (obj.type === "cube") {
    const size = Array.isArray(p.size) ? p.size : [p.size ?? 12, p.size ?? 12, p.size ?? 12];
    return ["cube([" + vec(size, 3, 12).join(", ") + "], center = " + bool(p.center !== false) + ");"];
  }
  if (obj.type === "cylinder") return ["cylinder(h = " + fmtNumber(p.height ?? 16) + ", r = " + fmtNumber(p.radius ?? 5) + ", center = " + bool(p.center !== false) + ", $fn = " + Math.max(8, Math.round(n(p.segments, 48))) + ");"];
  if (obj.type === "polyhedron") return ["polyhedron(points = " + points3Literal(p.points || []) + ", faces = " + facesLiteral(p.faces || []) + ");"];
  return ["// Unsupported object type: " + obj.type];
}

function wrapBlock(prefix, bodyLines) {
  return [prefix, ...indentLines(bodyLines, 2)];
}

export function serializeObjectToScad(obj, options = {}) {
  if (!obj || obj.visible === false) return [];
  let lines = primitiveLines(obj);
  const operations = Array.isArray(obj.operations) ? obj.operations.filter((op) => !op.disabled) : [];
  for (const op of operations) {
    if (op.type === "extrude") {
      const height = fmtNumber(op.params?.height ?? op.height ?? 10);
      lines = wrapBlock(`linear_extrude(height = ${height})`, lines);
    }
  }

  const t = obj.transform || {};
  const translate = Array.isArray(t.translate) ? t.translate : [0, 0, 0];
  const rotate = Array.isArray(t.rotate) ? t.rotate : [0, 0, 0];
  const scale = Array.isArray(t.scale) ? t.scale : [1, 1, 1];
  if (translate.some((v) => n(v, 0) !== 0)) lines = wrapBlock(`translate([${vec(translate).join(", ")}])`, lines);
  if (rotate.some((v) => n(v, 0) !== 0)) lines = wrapBlock(`rotate([${vec(rotate).join(", ")}])`, lines);
  if (scale.some((v) => n(v, 1) !== 1)) lines = wrapBlock(`scale([${vec(scale, 3, 1).join(", ")}])`, lines);

  if (options.comment !== false) {
    const label = qName(obj.name || obj.id);
    if (label) lines.unshift(`// ${label}`);
  }
  return lines;
}

function enabledTimeline(model, type) {
  return (model.timeline || []).filter((step) => step?.type === type && !step.disabled);
}

function objectById(model, id) {
  return model.objects.find((obj) => obj.id === id);
}

function activeVisibleObjects(model) {
  const layersById = new Map(model.layers.map((layer) => [layer.id, layer]));
  return model.objects.filter((obj) => obj.visible !== false && layersById.get(obj.layerId)?.visible !== false);
}

function serializeBooleanStep(model, step) {
  const ids = step.objectIds || [];
  const op = step.params?.operation || step.type;
  if (!ids.length) return [];
  const children = ids.map((id) => objectById(model, id)).filter(Boolean);
  if (!children.length) return [];
  const keyword = op === "cutout" ? "difference" : op;
  const lines = [`${keyword}() {`];
  children.forEach((child, index) => {
    const childLines = serializeObjectToScad(child, { comment: true });
    lines.push(...indentLines(childLines, 2));
    if (index < children.length - 1) lines.push("");
  });
  lines.push("}");
  return lines;
}

export function generateScadBody(modelInput) {
  const model = normalizeScadModel(modelInput);
  const emitted = new Set();
  const body = [];
  const booleanSteps = [
    ...enabledTimeline(model, "cutout"),
    ...enabledTimeline(model, "difference"),
    ...enabledTimeline(model, "union"),
    ...enabledTimeline(model, "intersection"),
    ...enabledTimeline(model, "boolean"),
  ];

  for (const step of booleanSteps) {
    const lines = serializeBooleanStep(model, step);
    if (!lines.length) continue;
    body.push(...lines, "");
    (step.objectIds || []).forEach((id) => emitted.add(id));
  }

  for (const obj of activeVisibleObjects(model)) {
    if (emitted.has(obj.id)) continue;
    body.push(...serializeObjectToScad(obj), "");
  }

  if (!body.length) body.push("// Empty Nodevision SCAD model.");
  while (body[body.length - 1] === "") body.pop();
  return body.join("\n") + "\n";
}

export function serializeScadModel(modelInput, options = {}) {
  const model = normalizeScadModel(modelInput);
  const metadata = JSON.stringify(model, null, 2);
  const header = `${MODEL_BLOCK_START}\n${metadata}\n${MODEL_BLOCK_END}\n\n`;
  const params = Object.entries(model.parameters || {}).map(([key, value]) => `${key} = ${value};`);
  const paramBlock = params.length ? params.join("\n") + "\n\n" : "";
  const body = generateScadBody(model);
  if (model.unsupportedSource && options.preserveUnsupportedSource) {
    return `${header}// Original unsupported source preserved for reference.\n/*\n${model.unsupportedSource}\n*/\n\n${paramBlock}${body}`;
  }
  return `${header}${paramBlock}${body}`;
}
