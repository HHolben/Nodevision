// Nodevision/ApplicationSystem/public/ScadEditor/ScadShapeTools.mjs
// Factories used by toolbar and pointer tools in the graphical SCAD editor.

export function shapeFromTool(tool, point = [0, 0], dragPoint = null) {
  const [x, y] = point;
  const dx = dragPoint ? dragPoint[0] - x : 20;
  const dy = dragPoint ? dragPoint[1] - y : 10;
  if (tool === "circle") {
    const radius = Math.max(1, Math.hypot(dx, dy) || 5);
    return { type: "circle", name: "Circle", params: { radius }, transform: { translate: [x, y, 0] } };
  }
  if (tool === "rectangle") {
    return { type: "rectangle", name: "Rectangle", params: { width: Math.max(1, Math.abs(dx)), height: Math.max(1, Math.abs(dy)), center: false }, transform: { translate: [Math.min(x, x + dx), Math.min(y, y + dy), 0] } };
  }
  if (tool === "triangle") {
    return { type: "triangle", name: "Triangle", params: { points: [[0, 0], [12, 0], [6, 10]] }, transform: { translate: [x, y, 0] } };
  }
  if (tool === "vertex") {
    return { type: "vertexPath", name: "Vertex", params: { points: [[0, 0]], closed: false }, transform: { translate: [x, y, 0] } };
  }
  return { type: "polygon", name: "Polygon", params: { points: [[0, 0], [14, 0], [14, 10], [0, 10]], closed: true }, transform: { translate: [x, y, 0] } };
}

export function polygonFromPoints(points = []) {
  return { type: "polygon", name: "Polygon", params: { points: points.map(([x, y]) => [x, y]), closed: true }, transform: { translate: [0, 0, 0] } };
}
