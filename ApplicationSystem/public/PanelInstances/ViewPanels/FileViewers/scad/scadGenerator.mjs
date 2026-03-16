// Nodevision SCAD Editor - scadGenerator.mjs
// Purpose: Generate readable OpenSCAD from a scene tree + parameters; parse simple parameter assignments from SCAD.

import { kindOfType, NODE_KINDS, NODE_TYPES, normalizeParameters } from "./sceneTree.mjs";

function isScadIdentifier(name) {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(String(name || ""));
}

function formatBoolean(v) {
  if (typeof v === "boolean") return v ? "true" : "false";
  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    if (s === "true" || s === "false") return s;
  }
  return undefined;
}

function formatValue(v) {
  if (v === null || v === undefined) return "0";
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : "0";
  if (typeof v === "boolean") return v ? "true" : "false";
  if (typeof v === "string") {
    const s = v.trim();
    if (!s) return "0";
    return s;
  }
  if (Array.isArray(v)) return `[${v.map(formatValue).join(", ")}]`;
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

function indentLines(text, indent) {
  const pad = " ".repeat(indent);
  return String(text)
    .split("\n")
    .map((l) => (l ? pad + l : l))
    .join("\n");
}

function emitStmt(stmt, indent) {
  return indentLines(stmt, indent);
}

function emitBlock(header, bodyLines, indent) {
  const pad = " ".repeat(indent);
  const inner = bodyLines
    .filter((l) => l !== null && l !== undefined)
    .map((l) => (l === "" ? "" : " ".repeat(indent + 4) + l))
    .join("\n");
  return `${pad}${header} {\n${inner}\n${pad}}`;
}

function primitiveToSCAD(node) {
  const p = node.parameters || {};
  switch (node.type) {
    case NODE_TYPES.cube: {
      const size = p.size ?? p.v ?? p.dim ?? [10, 10, 10];
      const center = formatBoolean(p.center);
      const args = [];
      args.push(formatValue(size));
      if (center !== undefined) args.push(`center=${center}`);
      return `cube(${args.join(", ")});`;
    }
    case NODE_TYPES.sphere: {
      const r = p.r ?? p.radius ?? 10;
      const d = p.d ?? p.diameter;
      const fn = p.$fn ?? p.fn;
      const args = [];
      if (d !== undefined) args.push(`d=${formatValue(d)}`);
      else args.push(`r=${formatValue(r)}`);
      if (fn !== undefined) args.push(`$fn=${formatValue(fn)}`);
      return `sphere(${args.join(", ")});`;
    }
    case NODE_TYPES.cylinder: {
      const h = p.h ?? p.height ?? 10;
      const center = formatBoolean(p.center);
      const fn = p.$fn ?? p.fn;

      const args = [`h=${formatValue(h)}`];
      if (p.r !== undefined) args.push(`r=${formatValue(p.r)}`);
      else if (p.d !== undefined) args.push(`d=${formatValue(p.d)}`);
      else if (p.r1 !== undefined || p.r2 !== undefined) {
        if (p.r1 !== undefined) args.push(`r1=${formatValue(p.r1)}`);
        if (p.r2 !== undefined) args.push(`r2=${formatValue(p.r2)}`);
      } else if (p.d1 !== undefined || p.d2 !== undefined) {
        if (p.d1 !== undefined) args.push(`d1=${formatValue(p.d1)}`);
        if (p.d2 !== undefined) args.push(`d2=${formatValue(p.d2)}`);
      } else {
        args.push(`r=${formatValue(5)}`);
      }

      if (center !== undefined) args.push(`center=${center}`);
      if (fn !== undefined) args.push(`$fn=${formatValue(fn)}`);
      return `cylinder(${args.join(", ")});`;
    }
    case NODE_TYPES.polyhedron: {
      const points = p.points ?? [];
      const faces = p.faces ?? [];
      const convexity = p.convexity;
      const args = [`points=${formatValue(points)}`, `faces=${formatValue(faces)}`];
      if (convexity !== undefined) args.push(`convexity=${formatValue(convexity)}`);
      return `polyhedron(${args.join(", ")});`;
    }
    default:
      return `/* unsupported primitive: ${node.type} */`;
  }
}

function transformHeader(node) {
  const p = node.parameters || {};
  switch (node.type) {
    case NODE_TYPES.translate: {
      const v = p.v ?? p.vec ?? p.xyz ?? [0, 0, 0];
      return `translate(${formatValue(v)})`;
    }
    case NODE_TYPES.rotate: {
      const a = p.a ?? p.angles ?? p.xyz ?? 0;
      return `rotate(${formatValue(a)})`;
    }
    case NODE_TYPES.scale: {
      const v = p.v ?? p.vec ?? [1, 1, 1];
      return `scale(${formatValue(v)})`;
    }
    case NODE_TYPES.mirror: {
      const v = p.v ?? p.vec ?? [1, 0, 0];
      return `mirror(${formatValue(v)})`;
    }
    default:
      return `${node.type}()`;
  }
}

function booleanHeader(node) {
  switch (node.type) {
    case NODE_TYPES.union:
    case NODE_TYPES.difference:
    case NODE_TYPES.intersection:
      return `${node.type}()`;
    default:
      return `${node.type}()`;
  }
}

function nodeToSCADLines(node, indent) {
  const kind = kindOfType(node.type);
  const children = node.children || [];

  if (kind === NODE_KINDS.primitive) {
    return [emitStmt(primitiveToSCAD(node), indent)];
  }

  if (kind === NODE_KINDS.transform) {
    const head = transformHeader(node);
    if (children.length === 0) return [emitStmt(`${head} { }`, indent)];
    if (children.length === 1) {
      const childLines = nodeToSCADLines(children[0], indent + 4);
      const joined = childLines.join("\n");
      // Prefer brace-less when single primitive line.
      if (childLines.length === 1 && childLines[0].trimEnd().endsWith(";")) {
        return [emitStmt(`${head}\n${joined}`, indent)];
      }
      return [emitBlock(head, childLines.map((l) => l.trimStart()), indent)];
    }
    const body = children.flatMap((c) => nodeToSCADLines(c, 0)).map((l) => l.trimStart());
    return [emitBlock(head, body, indent)];
  }

  if (kind === NODE_KINDS.boolean) {
    const head = booleanHeader(node);
    const body = children.flatMap((c) => nodeToSCADLines(c, 0)).map((l) => l.trimStart());
    return [emitBlock(head, body, indent)];
  }

  return [emitStmt(`/* unknown node: ${node.type} */`, indent)];
}

export function generateSCAD(sceneTree, parameters = {}) {
  const params = normalizeParameters(parameters);
  const names = Object.keys(params).filter(isScadIdentifier).sort((a, b) => a.localeCompare(b));
  const paramLines = names.map((name) => `${name} = ${formatValue(params[name])};`);

  const bodyTree = sceneTree || { type: NODE_TYPES.union, parameters: {}, children: [] };
  const bodyLines = nodeToSCADLines(bodyTree, 0);

  const out = [];
  if (paramLines.length) {
    out.push(...paramLines);
    out.push("");
  }
  out.push(...bodyLines);
  out.push("");
  return out.join("\n");
}

// ------------------------------------------------------------
// Minimal SCAD parser for variable assignments.
// - Extracts top-level `name = expr;` ignoring lines with `//` comments.
// - Does not attempt to parse geometry.
// ------------------------------------------------------------

function stripLineComment(line) {
  const idx = line.indexOf("//");
  if (idx === -1) return line;
  return line.slice(0, idx);
}

export function parseParametersFromSCAD(scadCode = "") {
  /** @type {Record<string, string>} */
  const params = {};
  const lines = String(scadCode || "").split("\n");
  for (const raw of lines) {
    const line = stripLineComment(raw).trim();
    if (!line) continue;
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*([^;]+);\s*$/);
    if (!m) continue;
    const name = m[1];
    const expr = m[2].trim();
    params[name] = expr;
  }
  return params;
}

// ------------------------------------------------------------
// Minimal SCAD parser for a *restricted* subset of OpenSCAD geometry.
// Supports:
// - parameters: `name = expr;` (top-level, before first geometry stmt)
// - primitives: cube/sphere/cylinder/polyhedron
// - transforms: translate/rotate/scale/mirror
// - booleans: union/difference/intersection
// Notes:
// - Preserves expressions as strings (no evaluation).
// - Will NOT parse modules/for/if/let/include/use, etc.
// ------------------------------------------------------------

function makeTokenizer(src) {
  const s = String(src || "");
  let i = 0;

  function isSpace(c) {
    return c === " " || c === "\n" || c === "\t" || c === "\r";
  }
  function isDigit(c) {
    return c >= "0" && c <= "9";
  }
  function isIdentStart(c) {
    return (c >= "A" && c <= "Z") || (c >= "a" && c <= "z") || c === "_";
  }
  function isIdent(c) {
    return isIdentStart(c) || isDigit(c);
  }

  function peekChar(n = 0) {
    return s[i + n] || "";
  }

  function skipWhitespaceAndComments() {
    while (i < s.length) {
      const c = peekChar();
      if (isSpace(c)) {
        i += 1;
        continue;
      }
      // line comment
      if (c === "/" && peekChar(1) === "/") {
        i += 2;
        while (i < s.length && s[i] !== "\n") i += 1;
        continue;
      }
      // block comment
      if (c === "/" && peekChar(1) === "*") {
        i += 2;
        while (i < s.length && !(s[i] === "*" && s[i + 1] === "/")) i += 1;
        i += 2;
        continue;
      }
      break;
    }
  }

  function next() {
    skipWhitespaceAndComments();
    if (i >= s.length) return { t: "eof", v: "", start: i, end: i };

    const start = i;
    const c = peekChar();

    if (isIdentStart(c)) {
      i += 1;
      while (i < s.length && isIdent(s[i])) i += 1;
      return { t: "id", v: s.slice(start, i), start, end: i };
    }

    if (isDigit(c) || (c === "." && isDigit(peekChar(1)))) {
      i += 1;
      while (i < s.length && (isDigit(s[i]) || s[i] === ".")) i += 1;
      return { t: "num", v: s.slice(start, i), start, end: i };
    }

    if (c === "\"") {
      i += 1;
      while (i < s.length) {
        const ch = s[i];
        i += 1;
        if (ch === "\\") i += 1;
        else if (ch === "\"") break;
      }
      return { t: "str", v: s.slice(start, i), start, end: i };
    }

    i += 1;
    return { t: "sym", v: c, start, end: i };
  }

  const buf = [];
  function peek(k = 0) {
    while (buf.length <= k) buf.push(next());
    return buf[k];
  }
  function take() {
    const t = peek(0);
    buf.shift();
    return t;
  }

  return { peek, take };
}

function joinTokensAsExpr(tokens) {
  return tokens.map((t) => t.v).join("").trim();
}

function splitTopLevelCommas(expr) {
  const s = String(expr || "").trim();
  let depthP = 0;
  let depthB = 0;
  let depthC = 0;
  let cur = "";
  /** @type {string[]} */
  const parts = [];
  for (let i = 0; i < s.length; i += 1) {
    const c = s[i];
    if (c === "(") depthP += 1;
    else if (c === ")") depthP = Math.max(0, depthP - 1);
    else if (c === "[") depthB += 1;
    else if (c === "]") depthB = Math.max(0, depthB - 1);
    else if (c === "{") depthC += 1;
    else if (c === "}") depthC = Math.max(0, depthC - 1);

    if (c === "," && depthP === 0 && depthB === 0 && depthC === 0) {
      parts.push(cur.trim());
      cur = "";
      continue;
    }
    cur += c;
  }
  if (cur.trim()) parts.push(cur.trim());
  return parts;
}

function parseVectorLiteral(expr) {
  const s = String(expr || "").trim();
  if (!s.startsWith("[") || !s.endsWith("]")) return null;
  const inner = s.slice(1, -1).trim();
  if (!inner) return [];
  return splitTopLevelCommas(inner).map((p) => p.trim());
}

function parseArgs(tok) {
  // assumes current token is '('
  const args = [];
  const named = {};
  tok.take(); // (

  while (tok.peek().t !== "eof") {
    if (tok.peek().t === "sym" && tok.peek().v === ")") {
      tok.take();
      break;
    }

    // named arg: id '=' expr
    if (tok.peek().t === "id" && tok.peek(1).t === "sym" && tok.peek(1).v === "=") {
      const name = tok.take().v;
      tok.take(); // =
      const exprTokens = [];
      let depthP = 0;
      let depthB = 0;
      while (tok.peek().t !== "eof") {
        const p = tok.peek();
        if (p.t === "sym") {
          if (p.v === "(") depthP += 1;
          else if (p.v === ")") {
            if (depthP === 0 && depthB === 0) break;
            depthP = Math.max(0, depthP - 1);
          } else if (p.v === "[") depthB += 1;
          else if (p.v === "]") depthB = Math.max(0, depthB - 1);
          else if (p.v === "," && depthP === 0 && depthB === 0) break;
        }
        exprTokens.push(tok.take());
      }
      named[name] = joinTokensAsExpr(exprTokens);
    } else {
      const exprTokens = [];
      let depthP = 0;
      let depthB = 0;
      while (tok.peek().t !== "eof") {
        const p = tok.peek();
        if (p.t === "sym") {
          if (p.v === "(") depthP += 1;
          else if (p.v === ")") {
            if (depthP === 0 && depthB === 0) break;
            depthP = Math.max(0, depthP - 1);
          } else if (p.v === "[") depthB += 1;
          else if (p.v === "]") depthB = Math.max(0, depthB - 1);
          else if (p.v === "," && depthP === 0 && depthB === 0) break;
        }
        exprTokens.push(tok.take());
      }
      args.push(joinTokensAsExpr(exprTokens));
    }

    if (tok.peek().t === "sym" && tok.peek().v === ",") tok.take();
  }

  return { args, named };
}

function parseRequiredSym(tok, sym) {
  const t = tok.take();
  if (t.t !== "sym" || t.v !== sym) throw new Error(`Expected '${sym}'`);
}

function parseStatement(tok) {
  const head = tok.peek();
  if (head.t !== "id") throw new Error("Expected identifier");
  const type = tok.take().v;

  if (tok.peek().t !== "sym" || tok.peek().v !== "(") throw new Error("Expected '('");
  const { args, named } = parseArgs(tok);

  const isPrimitive = type === NODE_TYPES.cube || type === NODE_TYPES.sphere || type === NODE_TYPES.cylinder || type === NODE_TYPES.polyhedron;
  const isTransform = type === NODE_TYPES.translate || type === NODE_TYPES.rotate || type === NODE_TYPES.scale || type === NODE_TYPES.mirror;
  const isBoolean = type === NODE_TYPES.union || type === NODE_TYPES.difference || type === NODE_TYPES.intersection;

  /** @type {any} */
  const node = { id: undefined, type, parameters: {}, children: [] };

  if (isPrimitive) {
    // must end with ;
    parseRequiredSym(tok, ";");
    if (type === NODE_TYPES.cube) {
      const sizeExpr = named.size ?? args[0] ?? "[10,10,10]";
      const vec = parseVectorLiteral(sizeExpr);
      node.parameters.size = vec ?? sizeExpr;
      if (named.center !== undefined) node.parameters.center = named.center.trim();
    } else if (type === NODE_TYPES.sphere) {
      if (named.r !== undefined) node.parameters.r = named.r.trim();
      else if (named.d !== undefined) node.parameters.d = named.d.trim();
      else if (args[0] !== undefined) node.parameters.r = args[0].trim();
    } else if (type === NODE_TYPES.cylinder) {
      if (named.h !== undefined) node.parameters.h = named.h.trim();
      if (named.r !== undefined) node.parameters.r = named.r.trim();
      if (named.d !== undefined) node.parameters.d = named.d.trim();
      if (named.r1 !== undefined) node.parameters.r1 = named.r1.trim();
      if (named.r2 !== undefined) node.parameters.r2 = named.r2.trim();
      if (named.d1 !== undefined) node.parameters.d1 = named.d1.trim();
      if (named.d2 !== undefined) node.parameters.d2 = named.d2.trim();
      if (named.center !== undefined) node.parameters.center = named.center.trim();
      if (named.$fn !== undefined) node.parameters.$fn = named.$fn.trim();
    } else if (type === NODE_TYPES.polyhedron) {
      if (named.points !== undefined) node.parameters.points = named.points.trim();
      if (named.faces !== undefined) node.parameters.faces = named.faces.trim();
      if (named.convexity !== undefined) node.parameters.convexity = named.convexity.trim();
    }
    return node;
  }

  if (isTransform || isBoolean) {
    if (isTransform) {
      if (type === NODE_TYPES.rotate) {
        const aExpr = named.a ?? args[0] ?? "[0,0,0]";
        const vec = parseVectorLiteral(aExpr);
        node.parameters.a = vec ?? aExpr;
      } else {
        const vExpr = named.v ?? args[0] ?? "[0,0,0]";
        const vec = parseVectorLiteral(vExpr);
        node.parameters.v = vec ?? vExpr;
      }
    }

    // body: block or single statement
    if (tok.peek().t === "sym" && tok.peek().v === "{") {
      tok.take(); // {
      while (tok.peek().t !== "eof") {
        if (tok.peek().t === "sym" && tok.peek().v === "}") {
          tok.take();
          break;
        }
        node.children.push(parseStatement(tok));
      }
    } else if (tok.peek().t === "sym" && tok.peek().v === ";") {
      tok.take(); // empty
    } else {
      node.children.push(parseStatement(tok));
    }

    return node;
  }

  // Unsupported statement (modules/for/if/etc.)
  throw new Error(`Unsupported statement: ${type}`);
}

export function parseProjectFromSCAD(scadCode = "") {
  const tok = makeTokenizer(scadCode);
  /** @type {Record<string,string>} */
  const parameters = {};
  /** @type {any[]} */
  const statements = [];
  const warnings = [];

  let sawGeometry = false;

  try {
    while (tok.peek().t !== "eof") {
      // top-level assignment only, before first geometry statement
      if (!sawGeometry && tok.peek().t === "id" && tok.peek(1).t === "sym" && tok.peek(1).v === "=") {
        const name = tok.take().v;
        tok.take(); // =
        const exprTokens = [];
        while (tok.peek().t !== "eof" && !(tok.peek().t === "sym" && tok.peek().v === ";")) {
          exprTokens.push(tok.take());
        }
        parseRequiredSym(tok, ";");
        parameters[name] = joinTokensAsExpr(exprTokens);
        continue;
      }

      // otherwise, geometry statement (restricted subset)
      sawGeometry = true;
      statements.push(parseStatement(tok));
    }

    if (statements.length === 0) {
      return { ok: false, error: "No geometry statements found", warnings, parameters };
    }

    let sceneTree;
    if (statements.length === 1) sceneTree = statements[0];
    else sceneTree = { type: NODE_TYPES.union, parameters: {}, children: statements };

    return { ok: true, parameters, sceneTree, warnings };
  } catch (err) {
    const msg = err?.message || String(err);
    warnings.push(msg);
    return { ok: false, error: msg, warnings, parameters };
  }
}
