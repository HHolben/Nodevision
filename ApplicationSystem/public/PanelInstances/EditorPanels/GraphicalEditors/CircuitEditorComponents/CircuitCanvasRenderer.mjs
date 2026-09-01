// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/CircuitEditorComponents/CircuitCanvasRenderer.mjs
// This module renders circuit documents into HTML canvas elements for read-only embedded viewers.

import { getSymbol } from "./SymbolLibrary.mjs";
import { rotatePoint, translatePoint } from "./CircuitGeometry.mjs";
import { componentSymbolLabelText, parseShapePoints, visitSymbolShapes } from "./SchematicSymbolRenderer.mjs";

const DEFAULT_BOUNDS = { x1: 0, y1: 0, x2: 600, y2: 360, width: 600, height: 360 };
const STROKE = "#0f172a";

function finitePoint(point) {
  return Number.isFinite(point?.x) && Number.isFinite(point?.y);
}

function addPoint(points, point) {
  if (finitePoint(point)) points.push({ x: point.x, y: point.y });
}

function worldPoint(local, component) {
  return translatePoint(rotatePoint(local, component.rotation || 0), component.x || 0, component.y || 0);
}

export function circuitDocumentBounds(document = {}) {
  const points = [];
  (document.wires || []).forEach((wire) => (wire.points || []).forEach((point) => addPoint(points, point)));
  (document.components || []).forEach((component) => {
    const symbol = getSymbol(component.type);
    if (!symbol) return;
    const w = symbol.size?.w || 80;
    const h = symbol.size?.h || 40;
    [
      { x: -w / 2, y: -h / 2 },
      { x: w / 2, y: -h / 2 },
      { x: w / 2, y: h / 2 },
      { x: -w / 2, y: h / 2 },
      ...(symbol.pins || []),
    ].forEach((point) => addPoint(points, worldPoint(point, component)));
  });
  [...(document.labels || []), ...(document.texts || [])].forEach((label) => addPoint(points, label));
  if (!points.length) return { ...DEFAULT_BOUNDS };

  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const x1 = Math.min(...xs);
  const x2 = Math.max(...xs);
  const y1 = Math.min(...ys);
  const y2 = Math.max(...ys);
  return { x1, y1, x2, y2, width: Math.max(1, x2 - x1), height: Math.max(1, y2 - y1) };
}

function resourceIds(resource = {}) {
  return [resource.id, resource.componentId, resource.logicalId, resource.name].filter(Boolean).map(String);
}

function componentResourceId(component = {}) {
  return component.resourceId || component.componentId || component.properties?.resourceId || component.properties?.componentId || "";
}

export function collectCircuitRenderDiagnostics(document = {}, { componentResources = [] } = {}) {
  const diagnostics = [];
  const availableIds = new Set((componentResources || []).flatMap(resourceIds));
  (document.components || []).forEach((component) => {
    if (!getSymbol(component.type)) diagnostics.push(`Missing schematic symbol: ${component.type || component.id || "component"}`);
    const resourceId = componentResourceId(component);
    if (resourceId && !availableIds.has(String(resourceId))) {
      diagnostics.push(`Missing component resource: ${resourceId}`);
    }
  });
  return diagnostics;
}

function cssSize(canvas, options = {}) {
  const rect = canvas.getBoundingClientRect?.() || {};
  return {
    width: Math.max(120, Math.floor(options.width || rect.width || canvas.clientWidth || 480)),
    height: Math.max(120, Math.floor(options.height || rect.height || canvas.clientHeight || 320)),
  };
}

function prepareCanvas(canvas, options = {}) {
  const context = canvas?.getContext?.("2d");
  if (!context) return null;
  const { width, height } = cssSize(canvas, options);
  const ratio = Math.max(1, Math.min(3, options.devicePixelRatio || globalThis.devicePixelRatio || 1));
  if (canvas.width !== Math.round(width * ratio)) canvas.width = Math.round(width * ratio);
  if (canvas.height !== Math.round(height * ratio)) canvas.height = Math.round(height * ratio);
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  context.clearRect(0, 0, width, height);
  return { context, width, height };
}

function drawPolyline(context, points, close = false) {
  if (!points.length) return;
  context.beginPath();
  context.moveTo(points[0].x, points[0].y);
  points.slice(1).forEach((point) => context.lineTo(point.x, point.y));
  if (close) context.closePath();
  context.stroke();
}

function drawShape(context, shape) {
  context.strokeStyle = STROKE;
  context.lineWidth = 2;
  if (shape.type === "line") drawPolyline(context, [{ x: shape.x1, y: shape.y1 }, { x: shape.x2, y: shape.y2 }]);
  if (shape.type === "polyline") drawPolyline(context, parseShapePoints(shape.points));
  if (shape.type === "polygon") drawPolyline(context, parseShapePoints(shape.points), true);
  if (shape.type === "circle") {
    context.beginPath();
    context.arc(shape.cx, shape.cy, shape.r, 0, Math.PI * 2);
    context.stroke();
  }
  if (shape.type === "rect") context.strokeRect(shape.x, shape.y, shape.width, shape.height);
  if (shape.type === "arc") {
    context.beginPath();
    context.arc(shape.cx, shape.cy, shape.r, shape.start, shape.end, shape.end < shape.start);
    context.stroke();
  }
}

function drawComponent(context, component) {
  const symbol = getSymbol(component.type);
  if (!symbol) return;
  context.save();
  context.translate(component.x || 0, component.y || 0);
  context.rotate(((component.rotation || 0) * Math.PI) / 180);
  visitSymbolShapes(symbol, (shape) => drawShape(context, shape));
  (symbol.pins || []).forEach((pin) => {
    context.beginPath();
    context.fillStyle = "#0ea5e9";
    context.strokeStyle = STROKE;
    context.lineWidth = 1;
    context.arc(pin.x, pin.y, 4, 0, Math.PI * 2);
    context.fill();
    context.stroke();
  });
  const label = componentSymbolLabelText(component);
  if (label) {
    context.fillStyle = STROKE;
    context.font = "12px Inter, sans-serif";
    context.textAlign = "center";
    context.textBaseline = "alphabetic";
    context.fillText(label, 0, -(symbol.size?.h || 40) / 2 - 6);
  }
  context.restore();
}

function drawStatus(context, width, y, message, color = "#64748b") {
  context.save();
  context.fillStyle = color;
  context.font = "13px Inter, sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(String(message || "").slice(0, 120), width / 2, Math.max(22, y));
  context.restore();
}

export function drawCircuitDocumentToCanvas(canvas, document = {}, options = {}) {
  const prepared = prepareCanvas(canvas, options);
  if (!prepared) return { ok: false, diagnostics: ["Canvas context unavailable."] };
  const { context, width, height } = prepared;
  context.fillStyle = options.background || "#ffffff";
  context.fillRect(0, 0, width, height);

  const bounds = circuitDocumentBounds(document);
  const padding = 32;
  const scale = Math.max(0.08, Math.min(2, (width - padding * 2) / bounds.width, (height - padding * 2) / bounds.height));
  const offsetX = (width - bounds.width * scale) / 2 - bounds.x1 * scale;
  const offsetY = (height - bounds.height * scale) / 2 - bounds.y1 * scale;

  context.save();
  context.translate(offsetX, offsetY);
  context.scale(scale, scale);
  context.strokeStyle = STROKE;
  context.lineWidth = 2;
  (document.wires || []).forEach((wire) => drawPolyline(context, (wire.points || []).filter(finitePoint)));
  (document.components || []).forEach((component) => drawComponent(context, component));
  [...(document.labels || []), ...(document.texts || [])].forEach((label) => {
    context.fillStyle = STROKE;
    context.font = "12px Inter, sans-serif";
    context.fillText(String(label.text || ""), label.x || 0, label.y || 0);
  });
  context.restore();

  const hasContent = (document.components || []).length || (document.wires || []).length;
  const diagnostics = collectCircuitRenderDiagnostics(document, options);
  if (!hasContent) drawStatus(context, width, height - 18, "Blank circuit");
  if (diagnostics.length) drawStatus(context, width, height - 18, diagnostics[0], "#b45309");
  return { ok: diagnostics.length === 0, diagnostics, bounds };
}

export function renderCircuitErrorToCanvas(canvas, message, options = {}) {
  const prepared = prepareCanvas(canvas, options);
  if (!prepared) return;
  const { context, width, height } = prepared;
  context.fillStyle = "#fff7f7";
  context.fillRect(0, 0, width, height);
  context.strokeStyle = "#dc2626";
  context.setLineDash([6, 4]);
  context.strokeRect(8, 8, width - 16, height - 16);
  context.setLineDash([]);
  drawStatus(context, width, height / 2, message || "Circuit unavailable.", "#b91c1c");
}
