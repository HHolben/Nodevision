// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/FileViewers/scad/sceneTree.mjs
// This file defines browser-side scene Tree logic for the Nodevision UI. It renders interface components and handles user interactions.
// Nodevision SCAD Editor - sceneTree.mjs
// Purpose: Scene-tree data model + pure tree operations + lightweight expression evaluation (for previews).

export const NODE_KINDS = /** @type {const} */ ({
  primitive: "primitive",
  transform: "transform",
  boolean: "boolean",
});

export const NODE_TYPES = /** @type {const} */ ({
  // Primitives
  cube: "cube",
  sphere: "sphere",
  cylinder: "cylinder",
  polyhedron: "polyhedron",
  // Transforms
  translate: "translate",
  rotate: "rotate",
  scale: "scale",
  mirror: "mirror",
  // Booleans
  union: "union",
  difference: "difference",
  intersection: "intersection",
});

export const DEFAULT_ROOT = Object.freeze({
  type: NODE_TYPES.union,
  parameters: {},
  children: [],
});

export function kindOfType(type) {
  switch (type) {
    case NODE_TYPES.cube:
    case NODE_TYPES.sphere:
    case NODE_TYPES.cylinder:
    case NODE_TYPES.polyhedron:
      return NODE_KINDS.primitive;
    case NODE_TYPES.translate:
    case NODE_TYPES.rotate:
    case NODE_TYPES.scale:
    case NODE_TYPES.mirror:
      return NODE_KINDS.transform;
    case NODE_TYPES.union:
    case NODE_TYPES.difference:
    case NODE_TYPES.intersection:
      return NODE_KINDS.boolean;
    default:
      return "unknown";
  }
}

function fallbackId() {
  return `n_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
}

export function newNodeId() {
  try {
    const bytes = new Uint8Array(8);
    crypto.getRandomValues(bytes);
    return `n_${Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("")}`;
  } catch {
    return fallbackId();
  }
}

export function createNode(type, overrides = {}) {
  return {
    id: overrides.id || newNodeId(),
    type,
    parameters: structuredClone(overrides.parameters || {}),
    children: Array.isArray(overrides.children) ? structuredClone(overrides.children) : [],
  };
}

export function cloneTree(node) {
  return structuredClone(node);
}

export function traverse(node, fn, parent = null) {
  fn(node, parent);
  for (const child of node.children || []) traverse(child, fn, node);
}

export function findNodeById(tree, id) {
  let found = null;
  traverse(tree, (node) => {
    if (node.id === id) found = node;
  });
  return found;
}

export function updateNodeById(tree, id, updater) {
  if (!tree) return tree;
  if (tree.id === id) return updater(tree);
  const children = tree.children || [];
  let changed = false;
  const nextChildren = children.map((child) => {
    const nextChild = updateNodeById(child, id, updater);
    if (nextChild !== child) changed = true;
    return nextChild;
  });
  if (!changed) return tree;
  return { ...tree, children: nextChildren };
}

export function replaceNodeById(tree, id, nextNode) {
  return updateNodeById(tree, id, (prev) => ({ ...nextNode, id: prev.id }));
}

export function addChildById(tree, parentId, childNode) {
  return updateNodeById(tree, parentId, (parent) => ({
    ...parent,
    children: [...(parent.children || []), childNode],
  }));
}

export function removeNodeById(tree, id) {
  if (!tree || tree.id === id) return tree; // never remove root

  function walk(node) {
    const children = node.children || [];
    let changed = false;
    const nextChildren = [];
    for (const child of children) {
      if (child.id === id) {
        changed = true;
        continue;
      }
      const nextChild = walk(child);
      if (nextChild !== child) changed = true;
      nextChildren.push(nextChild);
    }
    if (!changed) return node;
    return { ...node, children: nextChildren };
  }

  return walk(tree);
}

export function wrapNodeWithParent(tree, targetId, wrapperType, wrapperParams = {}) {
  const wrapperId = newNodeId();
  const wrapper = createNode(wrapperType, { id: wrapperId, parameters: wrapperParams, children: [] });

  let wrapped = false;
  function walk(node) {
    if (node.id === targetId) {
      wrapped = true;
      return { ...wrapper, children: [node] };
    }
    const children = node.children || [];
    let changed = false;
    const nextChildren = children.map((c) => {
      const n = walk(c);
      if (n !== c) changed = true;
      return n;
    });
    if (!changed) return node;
    return { ...node, children: nextChildren };
  }

  const nextTree = walk(tree);
  return { tree: nextTree, wrapperId: wrapped ? wrapperId : null };
}

export function ensureBooleanParentForSelection(tree, selectedId, booleanType = NODE_TYPES.union) {
  const selected = findNodeById(tree, selectedId);
  if (!selected) return { tree, booleanId: null };
  if (kindOfType(selected.type) !== NODE_KINDS.primitive) return { tree, booleanId: selectedId };
  const { tree: nextTree, wrapperId } = wrapNodeWithParent(tree, selectedId, booleanType);
  return { tree: nextTree, booleanId: wrapperId };
}

// ------------------------------------------------------------
// Expression evaluation (preview only; SCAD generation preserves original strings)
// Supports: numbers, identifiers, + - * /, parentheses, unary +/-, and vector literals [a,b,c].
// ------------------------------------------------------------

function tokenize(input) {
  const src = String(input ?? "").trim();
  /** @type {{t:string,v?:any}[]} */
  const tokens = [];
  let i = 0;

  const isSpace = (c) => c === " " || c === "\n" || c === "\t" || c === "\r";
  const isDigit = (c) => c >= "0" && c <= "9";
  const isIdentStart = (c) => (c >= "A" && c <= "Z") || (c >= "a" && c <= "z") || c === "_";
  const isIdent = (c) => isIdentStart(c) || isDigit(c);

  while (i < src.length) {
    const c = src[i];
    if (isSpace(c)) {
      i += 1;
      continue;
    }

    if (c === "+" || c === "-" || c === "*" || c === "/" || c === "(" || c === ")" || c === "[" || c === "]" || c === "," ) {
      tokens.push({ t: c });
      i += 1;
      continue;
    }

    if (isDigit(c) || (c === "." && isDigit(src[i + 1]))) {
      let j = i + 1;
      while (j < src.length && (isDigit(src[j]) || src[j] === ".")) j += 1;
      const raw = src.slice(i, j);
      const num = Number(raw);
      tokens.push({ t: "num", v: Number.isFinite(num) ? num : 0 });
      i = j;
      continue;
    }

    if (isIdentStart(c)) {
      let j = i + 1;
      while (j < src.length && isIdent(src[j])) j += 1;
      tokens.push({ t: "id", v: src.slice(i, j) });
      i = j;
      continue;
    }

    // Unknown token, skip
    i += 1;
  }

  tokens.push({ t: "eof" });
  return tokens;
}

function parseExpression(tokens, env) {
  let idx = 0;

  const peek = () => tokens[idx];
  const take = (t) => {
    const tok = tokens[idx];
    if (tok.t !== t) throw new Error(`Expected ${t}`);
    idx += 1;
    return tok;
  };

  function parsePrimary() {
    const tok = peek();
    if (tok.t === "num") {
      idx += 1;
      return tok.v;
    }
    if (tok.t === "id") {
      idx += 1;
      const key = tok.v;
      if (key === "PI" || key === "pi") return Math.PI;
      const v = env?.[key];
      if (typeof v === "number") return v;
      if (typeof v === "string") {
        // Allow nested expressions (bounded).
        if (v.length > 200) return 0;
        return evaluateScalar(v, env);
      }
      return 0;
    }
    if (tok.t === "(") {
      take("(");
      const v = parseAddSub();
      take(")");
      return v;
    }
    if (tok.t === "[") {
      // Vector literal; primary returns the vector as an array.
      take("[");
      /** @type {number[]} */
      const out = [];
      if (peek().t !== "]") {
        out.push(parseAddSub());
        while (peek().t === ",") {
          take(",");
          out.push(parseAddSub());
        }
      }
      take("]");
      return out;
    }
    throw new Error("Bad expression");
  }

  function parseUnary() {
    const tok = peek();
    if (tok.t === "+") {
      take("+");
      return parseUnary();
    }
    if (tok.t === "-") {
      take("-");
      const v = parseUnary();
      if (Array.isArray(v)) return v.map((x) => -x);
      return -v;
    }
    return parsePrimary();
  }

  function parseMulDiv() {
    let left = parseUnary();
    while (peek().t === "*" || peek().t === "/") {
      const op = peek().t;
      idx += 1;
      const right = parseUnary();
      const l = Array.isArray(left) ? left[0] : left;
      const r = Array.isArray(right) ? right[0] : right;
      left = op === "*" ? l * r : l / (r || 1);
    }
    return left;
  }

  function parseAddSub() {
    let left = parseMulDiv();
    while (peek().t === "+" || peek().t === "-") {
      const op = peek().t;
      idx += 1;
      const right = parseMulDiv();
      const l = Array.isArray(left) ? left[0] : left;
      const r = Array.isArray(right) ? right[0] : right;
      left = op === "+" ? l + r : l - r;
    }
    return left;
  }

  const value = parseAddSub();
  return { value, idx };
}

export function normalizeParameters(parameters = {}) {
  /** @type {Record<string, string|number>} */
  const out = {};
  for (const [k, v] of Object.entries(parameters || {})) {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(k)) continue;
    if (typeof v === "number") out[k] = v;
    else out[k] = String(v ?? "").trim();
  }
  return out;
}

export function evaluateScalar(expr, parameters = {}) {
  const env = normalizeParameters(parameters);
  const s = String(expr ?? "").trim();
  if (!s) return 0;
  try {
    const tokens = tokenize(s);
    const { value } = parseExpression(tokens, env);
    if (Array.isArray(value)) return value[0] ?? 0;
    return Number.isFinite(value) ? value : 0;
  } catch {
    const n = Number(s);
    return Number.isFinite(n) ? n : 0;
  }
}

export function evaluateVector(expr, parameters = {}, fallback = [0, 0, 0]) {
  const env = normalizeParameters(parameters);
  const s = String(expr ?? "").trim();
  if (!s) return [...fallback];
  try {
    const tokens = tokenize(s);
    const { value } = parseExpression(tokens, env);
    if (Array.isArray(value)) {
      const vec = value.map((x) => (Number.isFinite(x) ? x : 0));
      if (vec.length === 0) return [...fallback];
      if (vec.length === 1) return [vec[0], 0, 0];
      if (vec.length === 2) return [vec[0], vec[1], 0];
      return [vec[0], vec[1], vec[2]];
    }
    const num = Number.isFinite(value) ? value : 0;
    return [num, num, num];
  } catch {
    return [...fallback];
  }
}
