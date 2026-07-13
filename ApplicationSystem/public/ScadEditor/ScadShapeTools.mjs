// Nodevision/ApplicationSystem/public/ScadEditor/ScadShapeTools.mjs
// Factories used by toolbar and pointer tools in the graphical SCAD editor.

export function shapeFromTool(tool, point = [0, 0], dragPoint = null) {
  const [x, y] = point;
  const dx = dragPoint ? dragPoint[0] - x : 20;
  const dy = dragPoint ? dragPoint[1] - y : 10;
  const absDx = Math.max(1, Math.abs(dx));
  const absDy = Math.max(1, Math.abs(dy));
  const size = Math.max(absDx, absDy);
  if (tool === "circle") {
    const radius = Math.max(1, Math.hypot(dx, dy) || 5);
    return { type: "circle", name: "Circle", params: { radius }, transform: { translate: [x, y, 0] } };
  }
  if (tool === "rectangle") {
    return { type: "rectangle", name: "Rectangle", params: { width: absDx, height: absDy, center: false }, transform: { translate: [Math.min(x, x + dx), Math.min(y, y + dy), 0] } };
  }
  if (tool === "square") {
    return { type: "square", name: "Square", params: { size, center: false }, transform: { translate: [Math.min(x, x + dx), Math.min(y, y + dy), 0] } };
  }
  if (tool === "line") {
    const end = dragPoint || [x + 20, y];
    return { type: "line", name: "Line", params: { points: [[0, 0], [Number((end[0] - x).toFixed(2)), Number((end[1] - y).toFixed(2))]], strokeWidth: 0.5, closed: false }, transform: { translate: [x, y, 0] } };
  }
  if (tool === "triangle") {
    return { type: "triangle", name: "Triangle", params: { points: [[0, 0], [12, 0], [6, 10]] }, transform: { translate: [x, y, 0] } };
  }
  if (tool === "text") {
    return { type: "text", name: "Text", params: { text: "Text", size: Math.max(4, Math.min(48, size)), font: "Liberation Sans", halign: "center", valign: "center" }, transform: { translate: [x, y, 0] } };
  }
  if (tool === "sphere") {
    return { type: "sphere", name: "Sphere", params: { radius: Math.max(1, Math.hypot(dx, dy) || 6), segments: 48 }, transform: { translate: [x, y, 0] } };
  }
  if (tool === "cube") {
    return { type: "cube", name: "Cube", params: { size: [absDx, absDy, Math.max(1, size)], center: true }, transform: { translate: [x, y, Math.max(1, size) / 2] } };
  }
  if (tool === "cylinder") {
    return { type: "cylinder", name: "Cylinder", params: { height: Math.max(1, size), radius: Math.max(1, Math.min(absDx, absDy) / 2 || 5), segments: 48, center: true }, transform: { translate: [x, y, Math.max(1, size) / 2] } };
  }
  if (tool === "polyhedron") {
    return { type: "polyhedron", name: "Polyhedron", params: { points: [[0, 0, 0], [size, 0, 0], [size / 2, size * 0.82, 0], [size / 2, size * 0.35, size]], faces: [[0, 1, 2], [0, 3, 1], [1, 3, 2], [2, 3, 0]] }, transform: { translate: [x, y, 0] } };
  }
  if (tool === "vertex") {
    return { type: "vertexPath", name: "Vertex", params: { points: [[0, 0]], closed: false }, transform: { translate: [x, y, 0] } };
  }
  return { type: "polygon", name: "Polygon", params: { points: [[0, 0], [14, 0], [14, 10], [0, 10]], closed: true }, transform: { translate: [x, y, 0] } };
}

export function polygonFromPoints(points = []) {
  return { type: "polygon", name: "Polygon", params: { points: points.map(([x, y]) => [x, y]), closed: true }, transform: { translate: [0, 0, 0] } };
}
