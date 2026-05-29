// Nodevision/ApplicationSystem/public/MetaWorld/Expressions/ExpressionParser.mjs
// This module parses restricted math expressions for MetaWorld expression layers. The parser evaluates safe arithmetic without using eval or Function.

const FUNCTIONS = {
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
  sqrt: Math.sqrt,
  abs: Math.abs,
  floor: Math.floor,
  ceil: Math.ceil,
  min: Math.min,
  max: Math.max,
  exp: Math.exp,
  log: Math.log,
};

const CONSTANTS = {
  pi: Math.PI,
  e: Math.E,
  tau: Math.PI * 2,
  phi: (1 + Math.sqrt(5)) / 2,
  sqrt2: Math.SQRT2,
  ln2: Math.LN2,
  ln10: Math.LN10,
  alpha: 1,
  beta: 1,
  gamma: 1,
  theta: 0,
  sigma: 1,
};

const UNICODE_CONSTANT_ALIASES = {
  π: "pi",
  τ: "tau",
  φ: "phi",
  α: "alpha",
  β: "beta",
  γ: "gamma",
  θ: "theta",
  σ: "sigma",
};

function syntaxError(message, token = null) {
  const suffix = token ? ` near "${token.value}"` : "";
  return new Error(`${message}${suffix}`);
}

function splitTopLevel(value, separator = ",") {
  const parts = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < value.length; i += 1) {
    const ch = value[i];
    if (ch === "(") depth += 1;
    else if (ch === ")") depth -= 1;
    else if (ch === separator && depth === 0) {
      parts.push(value.slice(start, i).trim());
      start = i + 1;
    }
  }
  parts.push(value.slice(start).trim());
  return parts.filter(Boolean);
}

function splitAssignment(value) {
  let depth = 0;
  for (let i = 0; i < value.length; i += 1) {
    const ch = value[i];
    if (ch === "(") depth += 1;
    else if (ch === ")") depth -= 1;
    else if (ch === "=" && depth === 0) {
      return [value.slice(0, i).trim().toLowerCase(), value.slice(i + 1).trim()];
    }
  }
  return ["", value.trim()];
}

function isValidConstantName(name) {
  return /^[a-z_][a-z0-9_]*$/.test(name)
    && !Object.prototype.hasOwnProperty.call(FUNCTIONS, name)
    && !Object.prototype.hasOwnProperty.call(CONSTANTS, name)
    && !["x", "y", "z", "t", "time"].includes(name);
}

function compileScopedExpression(expression, variables, localConstants = {}) {
  const constantNames = Object.keys(localConstants);
  const compiler = compileMathExpression(expression, variables.concat(constantNames));
  return {
    source: compiler.source,
    evaluate(scope = {}) {
      return compiler.evaluate({ ...localConstants, ...scope });
    },
  };
}

function compileConstantAssignments(assignments) {
  const constants = {};
  assignments.forEach(([name, expression]) => {
    if (!isValidConstantName(name)) {
      throw new Error(`Invalid constant name ${name}. Use names such as a, amplitude, or offset.`);
    }
    if (!expression) throw new Error(`Constant ${name} needs a value.`);
    const compiler = compileScopedExpression(expression, [], constants);
    const value = compiler.evaluate({});
    if (!Number.isFinite(value)) throw new Error(`Constant ${name} did not produce a finite number.`);
    constants[name] = value;
  });
  return constants;
}

function tokenize(input) {
  const tokens = [];
  let i = 0;
  while (i < input.length) {
    const ch = input[i];
    if (/\s/.test(ch)) {
      i += 1;
      continue;
    }
    if (/[0-9.]/.test(ch)) {
      const start = i;
      let sawDot = ch === ".";
      i += 1;
      while (i < input.length) {
        const next = input[i];
        if (/[0-9]/.test(next)) {
          i += 1;
        } else if (next === "." && !sawDot) {
          sawDot = true;
          i += 1;
        } else {
          break;
        }
      }
      if (/[eE]/.test(input[i] || "")) {
        const expStart = i;
        i += 1;
        if (/[+-]/.test(input[i] || "")) i += 1;
        const digitStart = i;
        while (/[0-9]/.test(input[i] || "")) i += 1;
        if (digitStart === i) i = expStart;
      }
      const raw = input.slice(start, i);
      const number = Number(raw);
      if (!Number.isFinite(number)) throw syntaxError(`Invalid number ${raw}`);
      tokens.push({ type: "number", value: raw, number });
      continue;
    }
    if (/[A-Za-z_]/.test(ch)) {
      const start = i;
      i += 1;
      while (/[A-Za-z0-9_]/.test(input[i] || "")) i += 1;
      tokens.push({ type: "identifier", value: input.slice(start, i).toLowerCase() });
      continue;
    }
    if (UNICODE_CONSTANT_ALIASES[ch]) {
      tokens.push({ type: "identifier", value: UNICODE_CONSTANT_ALIASES[ch] });
      i += 1;
      continue;
    }
    if ("+-*/^(),".includes(ch)) {
      tokens.push({ type: ch, value: ch });
      i += 1;
      continue;
    }
    throw syntaxError(`Unsupported character ${ch}`);
  }
  tokens.push({ type: "eof", value: "" });
  return tokens;
}

class Parser {
  constructor(tokens, variables) {
    this.tokens = tokens;
    this.index = 0;
    this.variables = new Set(variables);
  }

  peek() {
    return this.tokens[this.index];
  }

  consume(type = null) {
    const token = this.peek();
    if (type && token.type !== type) throw syntaxError(`Expected ${type}`, token);
    this.index += 1;
    return token;
  }

  parse() {
    const ast = this.parseAdditive();
    if (this.peek().type !== "eof") throw syntaxError("Unexpected token", this.peek());
    return ast;
  }

  parseAdditive() {
    let node = this.parseMultiplicative();
    while (["+", "-"].includes(this.peek().type)) {
      const op = this.consume().type;
      node = { type: "binary", op, left: node, right: this.parseMultiplicative() };
    }
    return node;
  }

  parseMultiplicative() {
    let node = this.parsePower();
    while (["*", "/"].includes(this.peek().type)) {
      const op = this.consume().type;
      node = { type: "binary", op, left: node, right: this.parsePower() };
    }
    return node;
  }

  parsePower() {
    let node = this.parseUnary();
    if (this.peek().type === "^") {
      this.consume("^");
      node = { type: "binary", op: "^", left: node, right: this.parsePower() };
    }
    return node;
  }

  parseUnary() {
    if (this.peek().type === "+") {
      this.consume("+");
      return this.parseUnary();
    }
    if (this.peek().type === "-") {
      this.consume("-");
      return { type: "unary", op: "-", value: this.parseUnary() };
    }
    return this.parsePrimary();
  }

  parsePrimary() {
    const token = this.peek();
    if (token.type === "number") {
      this.consume();
      return { type: "number", value: token.number };
    }
    if (token.type === "identifier") {
      const name = this.consume().value;
      if (this.peek().type === "(") {
        if (!FUNCTIONS[name]) throw syntaxError(`Unsupported function ${name}`);
        this.consume("(");
        const args = [];
        if (this.peek().type !== ")") {
          do {
            args.push(this.parseAdditive());
            if (this.peek().type !== ",") break;
            this.consume(",");
          } while (true);
        }
        this.consume(")");
        return { type: "call", name, args };
      }
      if (this.variables.has(name)) return { type: "variable", name };
      if (Object.prototype.hasOwnProperty.call(CONSTANTS, name)) return { type: "number", value: CONSTANTS[name] };
      throw syntaxError(`Unknown symbol ${name}`);
    }
    if (token.type === "(") {
      this.consume("(");
      const node = this.parseAdditive();
      this.consume(")");
      return node;
    }
    throw syntaxError("Expected expression", token);
  }
}

function evaluateAst(ast, scope) {
  switch (ast.type) {
    case "number": return ast.value;
    case "variable": return Number(scope[ast.name]);
    case "unary": return -evaluateAst(ast.value, scope);
    case "binary": {
      const left = evaluateAst(ast.left, scope);
      const right = evaluateAst(ast.right, scope);
      if (ast.op === "+") return left + right;
      if (ast.op === "-") return left - right;
      if (ast.op === "*") return left * right;
      if (ast.op === "/") return left / right;
      if (ast.op === "^") return Math.pow(left, right);
      throw new Error(`Unsupported operator ${ast.op}`);
    }
    case "call": {
      const fn = FUNCTIONS[ast.name];
      const args = ast.args.map((arg) => evaluateAst(arg, scope));
      return fn(...args);
    }
    default:
      throw new Error("Unsupported expression node");
  }
}

export function compileMathExpression(expression, variables = []) {
  const source = String(expression || "").trim();
  if (!source) throw new Error("Expression is empty.");
  const parser = new Parser(tokenize(source), variables);
  const ast = parser.parse();
  return {
    source,
    evaluate(scope = {}) {
      const value = evaluateAst(ast, scope);
      if (!Number.isFinite(value)) return NaN;
      return value;
    },
  };
}

export function parseExpressionLayerExpression(expression) {
  const source = String(expression || "").trim();
  const assignments = splitTopLevel(source).map(splitAssignment);
  const namedAssignments = assignments.filter(([lhs]) => lhs);
  const map = new Map(namedAssignments);
  const outputNames = new Set();
  if (map.has("x") && map.has("y")) {
    outputNames.add("x");
    outputNames.add("y");
    outputNames.add("z");
  } else if (map.has("z")) {
    outputNames.add("z");
  } else if (map.has("y")) {
    outputNames.add("y");
  }

  const constantAssignments = namedAssignments.filter(([lhs]) => !outputNames.has(lhs));
  const localConstants = compileConstantAssignments(constantAssignments);
  const variables = ["x", "y", "z", "t", "time"];

  if (map.has("x") && map.has("y")) {
    return {
      kind: "parametricCurve",
      constants: localConstants,
      compilers: {
        x: compileScopedExpression(map.get("x"), variables, localConstants),
        y: compileScopedExpression(map.get("y"), variables, localConstants),
        z: compileScopedExpression(map.get("z") || "0", variables, localConstants),
      },
    };
  }

  if (map.has("z")) {
    return { kind: "functionSurface", constants: localConstants, compiler: compileScopedExpression(map.get("z"), variables, localConstants) };
  }
  if (map.has("y")) {
    return { kind: "functionCurve", constants: localConstants, compiler: compileScopedExpression(map.get("y"), variables, localConstants) };
  }
  const unnamedExpression = assignments.find(([lhs, rhs]) => !lhs && rhs)?.[1] || "";
  if (unnamedExpression) {
    return { kind: "functionSurface", constants: localConstants, compiler: compileScopedExpression(unnamedExpression, variables, localConstants) };
  }
  throw new Error("Use constants like a = 2 before z = f(x, y), y = f(x), or x/y/z parametric assignments.");
}
