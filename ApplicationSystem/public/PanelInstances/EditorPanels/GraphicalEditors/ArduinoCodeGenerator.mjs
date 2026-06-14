// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/ArduinoCodeGenerator.mjs
// Converts the persisted Arduino block workspace into readable Arduino C++.

import { createStructureBlock } from "./ArduinoBlockDefinitions.mjs";

const STRUCTURE_ORDER = ["setup", "loop"];

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function asText(value, fallback = "") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function indent(level) {
  return "  ".repeat(Math.max(0, level));
}

function ensureSemicolon(line) {
  const trimmed = String(line || "").trim();
  if (!trimmed) return "";
  return /[;{}]$/.test(trimmed) ? trimmed : `${trimmed};`;
}

function commentLines(text, level) {
  const lines = String(text ?? "")
    .replace(/\r\n?/g, "\n")
    .split("\n");
  return lines.map((line) => `${indent(level)}// ${line}`.trimEnd());
}

function generateStatement(block, level) {
  if (!block || typeof block !== "object") return [];

  switch (block.type) {
    case "comment":
      return commentLines(block.text, level);

    case "pinMode":
      return [`${indent(level)}pinMode(${asText(block.pin, "13")}, ${asText(block.mode, "OUTPUT")});`];

    case "digitalWrite":
      return [`${indent(level)}digitalWrite(${asText(block.pin, "13")}, ${asText(block.value, "LOW")});`];

    case "analogWrite":
      return [`${indent(level)}analogWrite(${asText(block.pin, "9")}, ${asText(block.value, "0")});`];

    case "delay":
      return [`${indent(level)}delay(${asText(block.ms, "0")});`];

    case "serialBegin":
      return [`${indent(level)}Serial.begin(${asText(block.baud, "9600")});`];

    case "serialPrint":
    case "serialPrintln": {
      const method = block.type === "serialPrintln" || block.newline ? "println" : "print";
      return [`${indent(level)}Serial.${method}(${asText(block.value, "\"\"")});`];
    }

    case "setVariable":
      return [`${indent(level)}${asText(block.name, "value")} = ${asText(block.value, "0")};`];

    case "changeVariable":
      return [`${indent(level)}${asText(block.name, "value")} += ${asText(block.amount, "1")};`];

    case "if": {
      const lines = [`${indent(level)}if (${asText(block.condition, "false")}) {`];
      lines.push(...generateStatements(block.statements, level + 1));
      lines.push(`${indent(level)}}`);
      return lines;
    }

    case "ifElse": {
      const lines = [`${indent(level)}if (${asText(block.condition, "false")}) {`];
      lines.push(...generateStatements(block.thenStatements, level + 1));
      lines.push(`${indent(level)}} else {`);
      lines.push(...generateStatements(block.elseStatements, level + 1));
      lines.push(`${indent(level)}}`);
      return lines;
    }

    default:
      return [`${indent(level)}${ensureSemicolon(`/* Unsupported block: ${block.type || "unknown"} */`)}`];
  }
}

function generateStatements(statements, level) {
  if (!Array.isArray(statements) || statements.length === 0) return [];
  return statements.flatMap((block) => generateStatement(block, level));
}

function generateGlobal(block) {
  if (!block || block.type !== "defineVariable") return "";

  const varType = asText(block.varType, "int");
  const name = asText(block.name, "value");
  const value = String(block.value ?? "").trim();
  return value ? `${varType} ${name} = ${value};` : `${varType} ${name};`;
}

export function createDefaultWorkspace() {
  return {
    version: 1,
    blocks: [
      createStructureBlock("setup", []),
      createStructureBlock("loop", []),
    ],
    globals: [],
  };
}

export function normalizeWorkspace(input) {
  const source = input && typeof input === "object" ? clone(input) : {};
  const blocks = Array.isArray(source.blocks) ? source.blocks : [];
  const globals = Array.isArray(source.globals) ? source.globals : [];

  const normalized = {
    version: Number(source.version) || 1,
    blocks: [],
    globals,
  };

  for (const type of STRUCTURE_ORDER) {
    const existing = blocks.find((block) => block?.type === type);
    normalized.blocks.push(
      existing
        ? {
            ...existing,
            statements: Array.isArray(existing.statements) ? existing.statements : [],
          }
        : createStructureBlock(type, []),
    );
  }

  for (const block of blocks) {
    if (!STRUCTURE_ORDER.includes(block?.type)) normalized.blocks.push(block);
  }

  return normalized;
}

export function getStructureBlock(workspace, type) {
  const normalized = normalizeWorkspace(workspace);
  return normalized.blocks.find((block) => block.type === type) || null;
}

export function generateArduinoCode(workspace) {
  const normalized = normalizeWorkspace(workspace);
  const setup = getStructureBlock(normalized, "setup");
  const loop = getStructureBlock(normalized, "loop");
  const globals = (normalized.globals || [])
    .map(generateGlobal)
    .filter(Boolean);

  const lines = [];
  if (globals.length) {
    lines.push(...globals);
    lines.push("");
  }

  lines.push("void setup() {");
  lines.push(...generateStatements(setup?.statements || [], 1));
  lines.push("}");
  lines.push("");
  lines.push("void loop() {");
  lines.push(...generateStatements(loop?.statements || [], 1));
  lines.push("}");

  return `${lines.join("\n")}\n`;
}
