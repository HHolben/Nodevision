// Nodevision/ApplicationSystem/public/Sessions/SessionFlowModel.mjs
// This module converts parsed Nodevision Session source into a simple procedural flow summary for the first graphical Session editor.

import { parseSessionScript } from "./SessionScriptParser.mjs";

function expressionLabel(expr) {
  if (!expr || typeof expr === "string") return expr || "";
  return expr.kind === "call" ? `${expr.name}(...)` : expr.source || "";
}

function labelFor(statement) {
  if (statement.type === "set") return `Set Variable: ${statement.name}${statement.expr?.kind === "call" ? " = " + expressionLabel(statement.expr) : ""}`;
  if (statement.type === "assign") return `Update Variable: ${statement.name}`;
  if (statement.type === "run") return `Run Command: ${statement.args[0] || ""}`;
  if (statement.type === "wait") return `Wait For Event: ${statement.args[0] || ""}`;
  if (statement.type === "if") return `Condition: ${statement.condition}`;
  if (statement.type === "while") return `Loop: ${statement.condition}`;
  if (statement.type === "quit") return "Quit Session";
  if (statement.type === "pause") return "Pause Session";
  return statement.type || "Step";
}

function walk(statements = [], out = [], depth = 0) {
  for (const statement of statements) {
    out.push({ label: labelFor(statement), line: statement.line, depth });
    if (statement.consequent?.length) walk(statement.consequent, out, depth + 1);
    if (statement.alternate?.length) {
      out.push({ label: "Else", line: statement.line, depth });
      walk(statement.alternate, out, depth + 1);
    }
    if (statement.body?.length) walk(statement.body, out, depth + 1);
  }
  return out;
}

export function summarizeSessionFlow(source = "") {
  const program = parseSessionScript(source);
  return [{ label: "Start", line: 1, depth: 0 }, ...walk(program.body), { label: "End", line: null, depth: 0 }];
}

