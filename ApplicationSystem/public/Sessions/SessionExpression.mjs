// Nodevision/ApplicationSystem/public/Sessions/SessionExpression.mjs
// This module evaluates a small JavaScript-like expression subset for Nodevision Sessions without exposing eval, Node.js globals, or browser internals.

const TOKEN_RE = /\s*(===|!==|<=|>=|&&|\|\||[()!+\-*/<>,.]|\d+(?:\.\d+)?|"(?:\\.|[^"])*"|'(?:\\.|[^'])*'|[A-Za-z_$][A-Za-z0-9_$]*|\S)/y;
const FORBIDDEN_PROPS = new Set(["__proto__", "prototype", "constructor"]);

function tokenize(source = "") {
  const tokens = [];
  TOKEN_RE.lastIndex = 0;
  while (TOKEN_RE.lastIndex < source.length) {
    const match = TOKEN_RE.exec(source);
    if (!match) throw new Error(`Invalid expression near: ${source.slice(TOKEN_RE.lastIndex, TOKEN_RE.lastIndex + 20)}`);
    tokens.push(match[1]);
  }
  return tokens;
}

function decodeString(token) {
  return JSON.parse(token.startsWith("'")
    ? `"${token.slice(1, -1).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`
    : token);
}

function isPlainObject(value) {
  return Object.prototype.toString.call(value) === "[object Object]";
}

function readSafeProperty(value, property) {
  if (!/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(property) || FORBIDDEN_PROPS.has(property)) {
    throw new Error(`Unsupported Session property: ${property}.`);
  }
  if (value === null || value === undefined) return null;
  if (property === "length" && (typeof value === "string" || Array.isArray(value))) return value.length;
  if ((isPlainObject(value) || Array.isArray(value)) && Object.prototype.hasOwnProperty.call(value, property)) {
    return value[property];
  }
  return null;
}

export function evaluateSessionExpression(source = "", state = {}) {
  const tokens = tokenize(String(source || "").trim());
  let pos = 0;
  const peek = () => tokens[pos];
  const take = (expected = null) => {
    const token = tokens[pos++];
    if (expected !== null && token !== expected) throw new Error(`Expected ${expected} but found ${token || "end of expression"}.`);
    return token;
  };

  function primaryBase() {
    const token = take();
    if (token === "(") {
      const value = logicalOr();
      take(")");
      return value;
    }
    if (/^\d/.test(token)) return Number(token);
    if (token?.startsWith("\"") || token?.startsWith("'")) return decodeString(token);
    if (token === "true") return true;
    if (token === "false") return false;
    if (token === "null") return null;
    if (/^[A-Za-z_$]/.test(token)) {
      if (!Object.prototype.hasOwnProperty.call(state, token)) throw new Error(`Unknown Session variable: ${token}.`);
      return state[token];
    }
    throw new Error(`Unexpected expression token: ${token}.`);
  }

  function primary() {
    let value = primaryBase();
    while (peek() === ".") {
      take(".");
      value = readSafeProperty(value, take());
    }
    return value;
  }

  function unary() {
    if (peek() === "!") {
      take("!");
      return !unary();
    }
    if (peek() === "-") {
      take("-");
      return -Number(unary());
    }
    return primary();
  }

  function multiplicative() {
    let value = unary();
    while (peek() === "*" || peek() === "/") {
      const op = take();
      const right = unary();
      value = op === "*" ? Number(value) * Number(right) : Number(value) / Number(right);
    }
    return value;
  }

  function additive() {
    let value = multiplicative();
    while (peek() === "+" || peek() === "-") {
      const op = take();
      const right = multiplicative();
      value = op === "+" ? value + right : Number(value) - Number(right);
    }
    return value;
  }

  function comparison() {
    let value = additive();
    while (["<", "<=", ">", ">="].includes(peek())) {
      const op = take();
      const right = additive();
      if (op === "<") value = value < right;
      else if (op === "<=") value = value <= right;
      else if (op === ">") value = value > right;
      else value = value >= right;
    }
    return value;
  }

  function equality() {
    let value = comparison();
    while (peek() === "===" || peek() === "!==") {
      const op = take();
      const right = comparison();
      value = op === "===" ? value === right : value !== right;
    }
    return value;
  }

  function logicalAnd() {
    let value = equality();
    while (peek() === "&&") {
      take("&&");
      value = Boolean(value) && Boolean(equality());
    }
    return value;
  }

  function logicalOr() {
    let value = logicalAnd();
    while (peek() === "||") {
      take("||");
      value = Boolean(value) || Boolean(logicalAnd());
    }
    return value;
  }

  const value = logicalOr();
  if (pos < tokens.length) throw new Error(`Unexpected expression token: ${tokens[pos]}.`);
  return value;
}
