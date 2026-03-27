// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/SVGeditorComponents/BezierModel.mjs
// This module defines a lightweight editable Bezier path model and helpers to convert between SVG path data and the internal structure. This module keeps node and handle data explicit so pointer interactions never mutate raw path strings directly. This module helps other tools keep node type constraints consistent.

const NODE_TYPES = ["corner", "smooth", "symmetric"];

export function createEmptyModel(id = "path") {
  return { id, closed: false, nodes: [] };
}

export function cloneModel(model) {
  return {
    id: model.id,
    closed: !!model.closed,
    nodes: model.nodes.map((n) => ({
      x: n.x,
      y: n.y,
      inHandle: n.inHandle ? { ...n.inHandle } : null,
      outHandle: n.outHandle ? { ...n.outHandle } : null,
      type: NODE_TYPES.includes(n.type) ? n.type : "corner",
    })),
  };
}

function ensureHandle(node, kind, value) {
  if (!value) return null;
  return { x: value.x, y: value.y };
}

function parseNumbers(str) {
  return str
    .trim()
    .replace(/\s+/g, " ")
    .split(/[ ,]+/)
    .map((v) => Number.parseFloat(v))
    .filter((v) => Number.isFinite(v));
}

export function parsePathToModel(pathEl) {
  const d = (pathEl.getAttribute("d") || "").trim();
  const tokens = d.match(/[a-zA-Z]|[-+]?[0-9]*\.?[0-9]+(?:e[-+]?\d+)?/g) || [];
  let i = 0;
  const take = () => tokens[i++];
  const model = createEmptyModel(pathEl.id || "path");
  let cursor = { x: 0, y: 0 };
  let start = { x: 0, y: 0 };

  const readPoint = (relative = false) => {
    const x = Number.parseFloat(take());
    const y = Number.parseFloat(take());
    if (!Number.isFinite(x) || !Number.isFinite(y)) return cursor;
    const pt = relative ? { x: cursor.x + x, y: cursor.y + y } : { x, y };
    cursor = pt;
    return pt;
  };

  while (i < tokens.length) {
    const cmd = take();
    if (!cmd) break;
    const lower = cmd.toLowerCase();
    const relative = cmd === lower;
    if (lower === "m") {
      const p = readPoint(relative);
      model.nodes.push({ x: p.x, y: p.y, inHandle: null, outHandle: null, type: "corner" });
      start = p;
    } else if (lower === "l") {
      const p = readPoint(relative);
      model.nodes.push({ x: p.x, y: p.y, inHandle: null, outHandle: null, type: "corner" });
    } else if (lower === "c") {
      const h1 = readPoint(relative);
      const h2 = readPoint(relative);
      const p = readPoint(relative);
      const node = { x: p.x, y: p.y, inHandle: h2, outHandle: null, type: "smooth" };
      // attach outgoing handle to previous if present
      const prev = model.nodes[model.nodes.length - 1];
      if (prev) prev.outHandle = h1;
      model.nodes.push(node);
    } else if (lower === "z") {
      model.closed = true;
      cursor = start;
    } else {
      // skip unsupported commands by consuming numbers they might include
      const rest = parseNumbers(tokens.slice(i).join(" "));
      if (rest.length % 2 === 0) {
        for (let j = 0; j < rest.length; j += 2) cursor = { x: rest[j], y: rest[j + 1] };
      }
      i = tokens.length;
    }
  }
  return model;
}

export function modelToPathD(model) {
  if (!model.nodes.length) return "";
  const parts = [];
  const first = model.nodes[0];
  parts.push(`M ${first.x} ${first.y}`);
  for (let idx = 1; idx < model.nodes.length; idx++) {
    const prev = model.nodes[idx - 1];
    const curr = model.nodes[idx];
    if (prev?.outHandle || curr?.inHandle) {
      const h1 = prev?.outHandle || prev;
      const h2 = curr?.inHandle || curr;
      parts.push(`C ${h1.x} ${h1.y} ${h2.x} ${h2.y} ${curr.x} ${curr.y}`);
    } else {
      parts.push(`L ${curr.x} ${curr.y}`);
    }
  }
  if (model.closed && model.nodes.length > 1) {
    const last = model.nodes[model.nodes.length - 1];
    const firstNode = model.nodes[0];
    if (last.outHandle || firstNode.inHandle) {
      const h1 = last.outHandle || last;
      const h2 = firstNode.inHandle || firstNode;
      parts.push(`C ${h1.x} ${h1.y} ${h2.x} ${h2.y} ${firstNode.x} ${firstNode.y}`);
    }
    parts.push("Z");
  }
  return parts.join(" ");
}

export function applyNodeTypeConstraints(node, moved) {
  if (!node) return;
  const kind = node.type || "corner";
  if (kind === "corner") return;
  const inVec = node.inHandle ? { x: node.inHandle.x - node.x, y: node.inHandle.y - node.y } : null;
  const outVec = node.outHandle ? { x: node.outHandle.x - node.x, y: node.outHandle.y - node.y } : null;
  if (kind === "smooth") {
    if (moved === "in" && inVec) {
      const len = Math.hypot(inVec.x, inVec.y) || 0;
      if (!len) return;
      const dir = { x: -inVec.x / len, y: -inVec.y / len };
      const outLen = outVec ? Math.hypot(outVec.x, outVec.y) : len;
      node.outHandle = { x: node.x + dir.x * outLen, y: node.y + dir.y * outLen };
    } else if (moved === "out" && outVec) {
      const len = Math.hypot(outVec.x, outVec.y) || 0;
      if (!len) return;
      const dir = { x: -outVec.x / len, y: -outVec.y / len };
      const inLen = inVec ? Math.hypot(inVec.x, inVec.y) : len;
      node.inHandle = { x: node.x + dir.x * inLen, y: node.y + dir.y * inLen };
    }
  } else if (kind === "symmetric") {
    const src = moved === "in" ? inVec : outVec;
    if (!src) return;
    const len = Math.hypot(src.x, src.y) || 0;
    if (!len) return;
    const dir = { x: -src.x / len, y: -src.y / len };
    if (moved === "in") {
      node.outHandle = { x: node.x + dir.x * len, y: node.y + dir.y * len };
    } else {
      node.inHandle = { x: node.x + dir.x * len, y: node.y + dir.y * len };
    }
  }
}

export function ensureNodeType(node, type) {
  if (!NODE_TYPES.includes(type)) return;
  node.type = type;
  if (type === "corner") return;
  if (!node.inHandle && node.outHandle) node.inHandle = { x: node.x - (node.outHandle.x - node.x), y: node.y - (node.outHandle.y - node.y) };
  if (!node.outHandle && node.inHandle) node.outHandle = { x: node.x - (node.inHandle.x - node.x), y: node.y - (node.inHandle.y - node.y) };
}

export function moveNode(node, dx, dy) {
  node.x += dx;
  node.y += dy;
  if (node.inHandle) {
    node.inHandle.x += dx;
    node.inHandle.y += dy;
  }
  if (node.outHandle) {
    node.outHandle.x += dx;
    node.outHandle.y += dy;
  }
}

export function deleteNode(model, index) {
  if (!model || index < 0 || index >= model.nodes.length) return model;
  const next = cloneModel(model);
  next.nodes.splice(index, 1);
  if (next.nodes.length < 2) next.closed = false;
  return next;
}

export function insertNodeOnSegment(model, index, point) {
  const next = cloneModel(model);
  next.nodes.splice(index + 1, 0, { x: point.x, y: point.y, inHandle: null, outHandle: null, type: "smooth" });
  return next;
}

export function setPathFromModel(pathEl, model) {
  if (!pathEl || !model) return;
  pathEl.setAttribute("d", modelToPathD(model));
}
