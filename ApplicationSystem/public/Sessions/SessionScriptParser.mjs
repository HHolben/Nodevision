// Nodevision/ApplicationSystem/public/Sessions/SessionScriptParser.mjs
// This module parses the initial Nodevision Session JavaScript subset into a small execution tree that can be interpreted safely.

function stripComment(line = "") {
  let quote = "";
  for (let i = 0; i < line.length - 1; i += 1) {
    const ch = line[i];
    if (quote) {
      if (ch === "\\" && i + 1 < line.length) i += 1;
      else if (ch === quote) quote = "";
      continue;
    }
    if (ch === "\"" || ch === "'") quote = ch;
    else if (ch === "/" && line[i + 1] === "/") return line.slice(0, i);
  }
  return line;
}

function sourceLines(source = "") {
  return String(source || "")
    .split(/\r?\n/)
    .map((raw, index) => ({ raw, text: stripComment(raw).trim(), line: index + 1 }))
    .filter((line) => line.text);
}

function syntax(line, message) {
  const err = new Error(`${message} at line ${line?.line || "?"}.`);
  err.name = "SessionSyntaxError";
  err.line = line?.line || null;
  return err;
}

function splitArgs(text = "") {
  const args = [];
  let start = 0;
  let depth = 0;
  let quote = "";
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quote) {
      if (ch === "\\" && i + 1 < text.length) i += 1;
      else if (ch === quote) quote = "";
    } else if (ch === "\"" || ch === "'") quote = ch;
    else if (ch === "(") depth += 1;
    else if (ch === ")") depth -= 1;
    else if (ch === "," && depth === 0) {
      args.push(text.slice(start, i).trim());
      start = i + 1;
    }
  }
  const tail = text.slice(start).trim();
  if (tail) args.push(tail);
  return args;
}

function blockHeader(line, keyword) {
  const match = new RegExp(`^${keyword}\\s*\\((.+)\\)\\s*\\{\\s*;?$`).exec(line.text);
  return match ? match[1].trim() : null;
}

function parseCall(line, name) {
  const match = new RegExp(`^(?:await\\s+)?${name}\\s*\\((.*)\\)\\s*;?$`).exec(line.text);
  return match ? splitArgs(match[1]) : null;
}

function expressionNode(expr = "") {
  const text = String(expr || "null").trim().replace(/;$/, "");
  const call = /^(?:await\s+)?(run|wait)\s*\((.*)\)$/.exec(text);
  return call ? { kind: "call", name: call[1], args: splitArgs(call[2]) } : { kind: "expr", source: text };
}

function parseStatements(lines, index = 0, stopOnElse = false) {
  const body = [];
  let i = index;
  while (i < lines.length) {
    const line = lines[i];
    if (line.text === "}" || line.text === "};") return { body, index: i + 1, closed: true };
    if (stopOnElse && /^}\s*else\s*\{\s*;?$/.test(line.text)) return { body, index: i, closed: true };

    const ifCondition = blockHeader(line, "if");
    if (ifCondition !== null) {
      const consequent = parseStatements(lines, i + 1, true);
      if (!consequent.closed) throw syntax(line, "Unclosed if block");
      let alternate = [];
      i = consequent.index;
      if (i < lines.length && /^}\s*else\s*\{\s*;?$/.test(lines[i].text)) {
        const parsedAlt = parseStatements(lines, i + 1, false);
        if (!parsedAlt.closed) throw syntax(lines[i], "Unclosed else block");
        alternate = parsedAlt.body;
        i = parsedAlt.index;
      }
      body.push({ type: "if", condition: ifCondition, consequent: consequent.body, alternate, line: line.line });
      continue;
    }

    const whileCondition = blockHeader(line, "while");
    if (whileCondition !== null) {
      const parsed = parseStatements(lines, i + 1, false);
      if (!parsed.closed) throw syntax(line, "Unclosed while block");
      body.push({ type: "while", condition: whileCondition, body: parsed.body, line: line.line });
      i = parsed.index;
      continue;
    }

    const declaration = /^(?:let|const|var)\s+([A-Za-z_$][A-Za-z0-9_$]*)(?:\s*=\s*(.+?))?\s*;?$/.exec(line.text);
    if (declaration) {
      body.push({ type: "set", name: declaration[1], expr: expressionNode(declaration[2] || "null"), line: line.line });
      i += 1;
      continue;
    }

    const assignment = /^([A-Za-z_$][A-Za-z0-9_$]*)\s*(=|\+=|-=)\s*(.+?)\s*;?$/.exec(line.text);
    if (assignment) {
      body.push({ type: "assign", name: assignment[1], op: assignment[2], expr: expressionNode(assignment[3]), line: line.line });
      i += 1;
      continue;
    }

    const runArgs = parseCall(line, "run");
    if (runArgs) body.push({ type: "run", args: runArgs, line: line.line });
    else {
      const waitArgs = parseCall(line, "wait");
      if (waitArgs) body.push({ type: "wait", args: waitArgs, line: line.line });
      else if (/^quit\s*\(\s*\)\s*;?$/.test(line.text)) body.push({ type: "quit", line: line.line });
      else if (/^pause\s*\(\s*\)\s*;?$/.test(line.text)) body.push({ type: "pause", line: line.line });
      else throw syntax(line, "Unsupported Session statement");
    }
    i += 1;
  }
  return { body, index: i, closed: false };
}

export function parseSessionScript(source = "") {
  const parsed = parseStatements(sourceLines(source), 0, false);
  if (parsed.closed) throw new Error("Unexpected closing brace in Session source.");
  return { type: "program", body: parsed.body };
}

