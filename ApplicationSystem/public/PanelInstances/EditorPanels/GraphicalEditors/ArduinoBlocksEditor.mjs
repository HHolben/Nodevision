// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/ArduinoBlocksEditor.mjs
// Blockly-powered graphical block placement panel for Arduino .ino sketches.

import { updateToolbarState } from "/panels/createToolbar.mjs";
import {
  resetEditorHooks,
  ensureNodevisionState,
  createBaseLayout,
  fetchText,
  saveText,
} from "./FamilyEditorCommon.mjs";

const METADATA_TOKEN = "@nodevision-arduino-blocks";
const BLOCKLY_SCRIPT_URLS = [
  "https://unpkg.com/blockly/blockly_compressed.js",
  "https://unpkg.com/blockly/blocks_compressed.js",
  "https://unpkg.com/blockly/msg/en.js",
];

const CATEGORY_ACTIONS = {
  arduinoShowLoopBlocks: "Loop",
  arduinoShowPinBlocks: "Pins",
  arduinoShowTimingBlocks: "Timing",
  arduinoShowLogicBlocks: "Logic",
  arduinoShowSerialBlocks: "Serial",
  arduinoShowVariableBlocks: "Variables",
  arduinoShowMathBlocks: "Math",
};

const INSERT_ACTIONS = {
  arduinoInsertComment: "arduino_comment",
  arduinoInsertPinMode: "arduino_pin_mode",
  arduinoInsertDigitalWrite: "arduino_digital_write",
  arduinoInsertAnalogWrite: "arduino_analog_write",
  arduinoInsertDigitalRead: "arduino_digital_read",
  arduinoInsertAnalogRead: "arduino_analog_read",
  arduinoInsertDelay: "arduino_delay",
  arduinoInsertMillis: "arduino_millis",
  arduinoInsertIf: "arduino_if",
  arduinoInsertIfElse: "arduino_if_else",
  arduinoInsertCompare: "arduino_compare",
  arduinoInsertLogicOp: "arduino_logic_op",
  arduinoInsertNot: "arduino_not",
  arduinoInsertSerialBegin: "arduino_serial_begin",
  arduinoInsertSerialPrint: "arduino_serial_print",
  arduinoInsertSerialPrintln: "arduino_serial_println",
  arduinoInsertDefineVariable: "arduino_define_variable",
  arduinoInsertSetVariable: "arduino_set_variable",
  arduinoInsertChangeVariable: "arduino_change_variable",
  arduinoInsertGetVariable: "arduino_variable_get",
  arduinoInsertNumber: "arduino_number",
  arduinoInsertText: "arduino_text",
  arduinoInsertArithmetic: "arduino_arithmetic",
  arduinoInsertMap: "arduino_map",
  arduinoInsertConstrain: "arduino_constrain",
};

const BLOCK_LABELS = {
  arduino_comment: "comment",
  arduino_pin_mode: "pinMode",
  arduino_digital_write: "digitalWrite",
  arduino_analog_write: "analogWrite",
  arduino_digital_read: "digitalRead",
  arduino_analog_read: "analogRead",
  arduino_delay: "delay",
  arduino_millis: "millis",
  arduino_if: "if",
  arduino_if_else: "if / else",
  arduino_compare: "comparison",
  arduino_logic_op: "logic",
  arduino_not: "not",
  arduino_serial_begin: "Serial.begin",
  arduino_serial_print: "Serial.print",
  arduino_serial_println: "Serial.println",
  arduino_define_variable: "define variable",
  arduino_set_variable: "set variable",
  arduino_change_variable: "change variable",
  arduino_variable_get: "get variable",
  arduino_number: "number",
  arduino_text: "text",
  arduino_arithmetic: "arithmetic",
  arduino_map: "map",
  arduino_constrain: "constrain",
};

const SETUP_BLOCKS = new Set(["arduino_pin_mode", "arduino_serial_begin"]);
const GLOBAL_BLOCKS = new Set(["arduino_define_variable"]);
const STATEMENT_BLOCKS = new Set([
  "arduino_comment",
  "arduino_pin_mode",
  "arduino_digital_write",
  "arduino_analog_write",
  "arduino_delay",
  "arduino_if",
  "arduino_if_else",
  "arduino_serial_begin",
  "arduino_serial_print",
  "arduino_serial_println",
  "arduino_define_variable",
  "arduino_set_variable",
  "arduino_change_variable",
]);

let blocklyLoadPromise = null;
let blocksRegistered = false;

function encodeJson(value) {
  const json = JSON.stringify(value);
  const bytes = new TextEncoder().encode(json);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

function decodeJson(encoded) {
  const binary = atob(String(encoded || "").replace(/\s+/g, ""));
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes));
}

function hasLoadedBlocklyCore() {
  return Boolean(window.Blockly?.inject);
}

function removeStaleBlocklyScripts() {
  document.querySelectorAll("script[data-nv-blockly-src]").forEach((script) => script.remove());
}

function temporarilyDisableAmd() {
  const originalDefine = window.define;
  const hadOwnDefine = Object.prototype.hasOwnProperty.call(window, "define");
  if (!originalDefine?.amd) return () => {};

  try {
    window.define = undefined;
  } catch {
    return () => {};
  }

  return () => {
    try {
      if (hadOwnDefine) window.define = originalDefine;
      else delete window.define;
    } catch {
      window.define = originalDefine;
    }
  };
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[data-nv-blockly-src="${src}"]`);
    if (existing?.dataset.loaded === "true") {
      resolve();
      return;
    }
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error(`Failed to load ${src}`)), { once: true });
      return;
    }

    const script = document.createElement("script");
    const restoreAmd = temporarilyDisableAmd();
    script.src = src;
    script.async = false;
    script.dataset.nvBlocklySrc = src;
    script.addEventListener("load", () => {
      restoreAmd();
      script.dataset.loaded = "true";
      resolve();
    }, { once: true });
    script.addEventListener("error", () => {
      restoreAmd();
      reject(new Error(`Failed to load ${src}`));
    }, { once: true });
    document.head.appendChild(script);
  });
}

async function loadBlockly() {
  if (hasLoadedBlocklyCore()) return window.Blockly;
  if (!blocklyLoadPromise) {
    removeStaleBlocklyScripts();
    blocklyLoadPromise = BLOCKLY_SCRIPT_URLS.reduce(
      (promise, src) => promise.then(() => loadScript(src)),
      Promise.resolve(),
    ).then(() => {
      if (!hasLoadedBlocklyCore()) {
        throw new Error("Blockly loaded but did not expose Blockly.inject.");
      }
      return window.Blockly;
    }).catch((err) => {
      blocklyLoadPromise = null;
      throw err;
    });
  }
  return blocklyLoadPromise;
}


function registerArduinoBlocks(Blockly) {
  if (blocksRegistered) return;

  const blockDefs = [
    {
      type: "arduino_comment",
      message0: "comment %1",
      args0: [{ type: "field_input", name: "TEXT", text: "comment" }],
      previousStatement: null,
      nextStatement: null,
      colour: 110,
    },
    {
      type: "arduino_pin_mode",
      message0: "pinMode pin %1 mode %2",
      args0: [
        { type: "field_input", name: "PIN", text: "13" },
        { type: "field_dropdown", name: "MODE", options: [["OUTPUT", "OUTPUT"], ["INPUT", "INPUT"], ["INPUT_PULLUP", "INPUT_PULLUP"]] },
      ],
      previousStatement: null,
      nextStatement: null,
      colour: 210,
    },
    {
      type: "arduino_digital_write",
      message0: "digitalWrite pin %1 value %2",
      args0: [
        { type: "field_input", name: "PIN", text: "13" },
        { type: "field_dropdown", name: "VALUE", options: [["HIGH", "HIGH"], ["LOW", "LOW"]] },
      ],
      previousStatement: null,
      nextStatement: null,
      colour: 210,
    },
    {
      type: "arduino_analog_write",
      message0: "analogWrite pin %1 value %2",
      args0: [
        { type: "field_input", name: "PIN", text: "9" },
        { type: "input_value", name: "VALUE" },
      ],
      previousStatement: null,
      nextStatement: null,
      colour: 210,
    },
    {
      type: "arduino_digital_read",
      message0: "digitalRead pin %1",
      args0: [{ type: "field_input", name: "PIN", text: "2" }],
      output: null,
      colour: 210,
    },
    {
      type: "arduino_analog_read",
      message0: "analogRead pin %1",
      args0: [{ type: "field_input", name: "PIN", text: "A0" }],
      output: "Number",
      colour: 210,
    },
    {
      type: "arduino_delay",
      message0: "delay %1 ms",
      args0: [{ type: "input_value", name: "MS" }],
      previousStatement: null,
      nextStatement: null,
      colour: 35,
    },
    {
      type: "arduino_millis",
      message0: "millis",
      output: "Number",
      colour: 35,
    },
    {
      type: "arduino_if",
      message0: "if %1 then %2",
      args0: [
        { type: "input_value", name: "COND" },
        { type: "input_statement", name: "DO" },
      ],
      previousStatement: null,
      nextStatement: null,
      colour: 290,
    },
    {
      type: "arduino_if_else",
      message0: "if %1 then %2 else %3",
      args0: [
        { type: "input_value", name: "COND" },
        { type: "input_statement", name: "THEN" },
        { type: "input_statement", name: "ELSE" },
      ],
      previousStatement: null,
      nextStatement: null,
      colour: 290,
    },
    {
      type: "arduino_compare",
      message0: "%1 %2 %3",
      args0: [
        { type: "input_value", name: "LEFT" },
        { type: "field_dropdown", name: "OP", options: [["=", "=="], ["not =", "!="], ["<", "<"], ["<=", "<="], [">", ">"], [">=", ">="]] },
        { type: "input_value", name: "RIGHT" },
      ],
      output: "Boolean",
      colour: 290,
    },
    {
      type: "arduino_logic_op",
      message0: "%1 %2 %3",
      args0: [
        { type: "input_value", name: "LEFT" },
        { type: "field_dropdown", name: "OP", options: [["and", "&&"], ["or", "||"]] },
        { type: "input_value", name: "RIGHT" },
      ],
      output: "Boolean",
      colour: 290,
    },
    {
      type: "arduino_not",
      message0: "not %1",
      args0: [{ type: "input_value", name: "VALUE" }],
      output: "Boolean",
      colour: 290,
    },
    {
      type: "arduino_serial_begin",
      message0: "Serial.begin %1",
      args0: [{ type: "field_input", name: "BAUD", text: "9600" }],
      previousStatement: null,
      nextStatement: null,
      colour: 20,
    },
    {
      type: "arduino_serial_print",
      message0: "Serial.print %1",
      args0: [{ type: "input_value", name: "VALUE" }],
      previousStatement: null,
      nextStatement: null,
      colour: 20,
    },
    {
      type: "arduino_serial_println",
      message0: "Serial.println %1",
      args0: [{ type: "input_value", name: "VALUE" }],
      previousStatement: null,
      nextStatement: null,
      colour: 20,
    },
    {
      type: "arduino_define_variable",
      message0: "define %1 %2 = %3",
      args0: [
        { type: "field_dropdown", name: "VAR_TYPE", options: [["int", "int"], ["float", "float"], ["bool", "bool"], ["String", "String"], ["long", "long"], ["unsigned long", "unsigned long"]] },
        { type: "field_input", name: "NAME", text: "counter" },
        { type: "input_value", name: "VALUE" },
      ],
      previousStatement: null,
      nextStatement: null,
      colour: 150,
    },
    {
      type: "arduino_set_variable",
      message0: "set %1 = %2",
      args0: [
        { type: "field_input", name: "NAME", text: "counter" },
        { type: "input_value", name: "VALUE" },
      ],
      previousStatement: null,
      nextStatement: null,
      colour: 150,
    },
    {
      type: "arduino_change_variable",
      message0: "change %1 by %2",
      args0: [
        { type: "field_input", name: "NAME", text: "counter" },
        { type: "input_value", name: "AMOUNT" },
      ],
      previousStatement: null,
      nextStatement: null,
      colour: 150,
    },
    {
      type: "arduino_variable_get",
      message0: "get %1",
      args0: [{ type: "field_input", name: "NAME", text: "counter" }],
      output: null,
      colour: 150,
    },
    {
      type: "arduino_number",
      message0: "number %1",
      args0: [{ type: "field_number", name: "VALUE", value: 0 }],
      output: "Number",
      colour: 55,
    },
    {
      type: "arduino_text",
      message0: "text %1",
      args0: [{ type: "field_input", name: "TEXT", text: "hello" }],
      output: "String",
      colour: 55,
    },
    {
      type: "arduino_arithmetic",
      message0: "%1 %2 %3",
      args0: [
        { type: "input_value", name: "LEFT" },
        { type: "field_dropdown", name: "OP", options: [["+", "+"], ["-", "-"], ["x", "*"], ["/", "/"], ["%", "%"]] },
        { type: "input_value", name: "RIGHT" },
      ],
      output: "Number",
      colour: 55,
    },
    {
      type: "arduino_map",
      message0: "map %1 from %2 - %3 to %4 - %5",
      args0: [
        { type: "input_value", name: "VALUE" },
        { type: "input_value", name: "FROM_LOW" },
        { type: "input_value", name: "FROM_HIGH" },
        { type: "input_value", name: "TO_LOW" },
        { type: "input_value", name: "TO_HIGH" },
      ],
      output: "Number",
      colour: 55,
    },
    {
      type: "arduino_constrain",
      message0: "constrain %1 between %2 and %3",
      args0: [
        { type: "input_value", name: "VALUE" },
        { type: "input_value", name: "LOW" },
        { type: "input_value", name: "HIGH" },
      ],
      output: "Number",
      colour: 55,
    },
  ];

  const defineBlocks = Blockly.common?.defineBlocksWithJsonArray || Blockly.defineBlocksWithJsonArray;
  if (typeof defineBlocks !== "function") throw new Error("Blockly JSON block definitions are unavailable.");
  defineBlocks.call(Blockly.common || Blockly, blockDefs);
  blocksRegistered = true;
}

function readWorkspaceStateFromSketch(text) {
  const match = String(text || "").match(/\/\*\s*@nodevision-arduino-blocks\s*([\s\S]*?)\*\//);
  if (!match) return null;

  try {
    const decoded = decodeJson(match[1]);
    if (decoded?.engine === "blockly") return decoded.blockly || null;
    if (Array.isArray(decoded?.blocks)) return legacyWorkspaceToBlocklyState(decoded);
    return decoded?.blockly || decoded || null;
  } catch (err) {
    console.warn("[ArduinoBlocksEditor] Could not read embedded Blockly workspace:", err);
    return null;
  }
}

function createSketchText(blocklyState, code) {
  const payload = {
    version: 2,
    engine: "blockly",
    blockly: blocklyState || emptyBlocklyState(),
  };
  return [
    `/* ${METADATA_TOKEN}`,
    encodeJson(payload),
    "*/",
    "",
    code,
  ].join("\n");
}

function emptyBlocklyState() {
  return { blocks: { languageVersion: 0, blocks: [] } };
}

function legacyWorkspaceToBlocklyState(legacy) {
  const blocks = [];
  let y = 24;
  const sections = ["setup", "loop"];
  sections.forEach((sectionType) => {
    const section = legacy.blocks?.find((block) => block?.type === sectionType);
    (section?.statements || []).forEach((statement) => {
      const converted = legacyStatementToBlocklyBlock(statement, 24, y);
      if (converted) {
        blocks.push(converted);
        y += 72;
      }
    });
  });
  (legacy.globals || []).forEach((statement) => {
    const converted = legacyStatementToBlocklyBlock(statement, 24, y);
    if (converted) {
      blocks.push(converted);
      y += 72;
    }
  });
  return { blocks: { languageVersion: 0, blocks } };
}

function legacyValueBlock(value, fallback = "0") {
  const text = String(value ?? fallback);
  const numeric = Number(text);
  if (Number.isFinite(numeric) && text.trim() !== "") {
    return { type: "arduino_number", fields: { VALUE: numeric } };
  }
  if (/^".*"$/.test(text.trim())) {
    return { type: "arduino_text", fields: { TEXT: text.trim().slice(1, -1) } };
  }
  return { type: "arduino_variable_get", fields: { NAME: text || fallback } };
}

function legacyStatementToBlocklyBlock(statement, x, y) {
  if (!statement?.type) return null;
  const common = { x, y };
  switch (statement.type) {
    case "comment":
      return { ...common, type: "arduino_comment", fields: { TEXT: statement.text || "comment" } };
    case "pinMode":
      return { ...common, type: "arduino_pin_mode", fields: { PIN: statement.pin || "13", MODE: statement.mode || "OUTPUT" } };
    case "digitalWrite":
      return { ...common, type: "arduino_digital_write", fields: { PIN: statement.pin || "13", VALUE: statement.value || "LOW" } };
    case "analogWrite":
      return { ...common, type: "arduino_analog_write", fields: { PIN: statement.pin || "9" }, inputs: { VALUE: { block: legacyValueBlock(statement.value, "0") } } };
    case "delay":
      return { ...common, type: "arduino_delay", inputs: { MS: { block: legacyValueBlock(statement.ms, "1000") } } };
    case "serialBegin":
      return { ...common, type: "arduino_serial_begin", fields: { BAUD: statement.baud || "9600" } };
    case "serialPrint":
      return { ...common, type: "arduino_serial_print", inputs: { VALUE: { block: legacyValueBlock(statement.value, "\"hello\"") } } };
    case "serialPrintln":
      return { ...common, type: "arduino_serial_println", inputs: { VALUE: { block: legacyValueBlock(statement.value, "\"hello\"") } } };
    case "defineVariable":
      return { ...common, type: "arduino_define_variable", fields: { VAR_TYPE: statement.varType || "int", NAME: statement.name || "counter" }, inputs: { VALUE: { block: legacyValueBlock(statement.value, "0") } } };
    case "setVariable":
      return { ...common, type: "arduino_set_variable", fields: { NAME: statement.name || "counter" }, inputs: { VALUE: { block: legacyValueBlock(statement.value, "0") } } };
    case "changeVariable":
      return { ...common, type: "arduino_change_variable", fields: { NAME: statement.name || "counter" }, inputs: { AMOUNT: { block: legacyValueBlock(statement.amount, "1") } } };
    default:
      return { ...common, type: "arduino_comment", fields: { TEXT: `Unsupported legacy block: ${statement.type}` } };
  }
}

function asText(value, fallback = "") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function quoteString(value) {
  return JSON.stringify(String(value ?? ""));
}

function indent(level) {
  return "  ".repeat(Math.max(0, level));
}

function field(block, name, fallback = "") {
  return asText(block?.getFieldValue?.(name), fallback);
}

function valueCode(block, inputName, fallback = "0") {
  const child = block?.getInputTargetBlock?.(inputName);
  return child ? expressionCode(child, fallback) : fallback;
}

function statementInputLines(block, inputName, level) {
  return statementChainLines(block?.getInputTargetBlock?.(inputName), level);
}

function commentLines(text, level) {
  return String(text ?? "")
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => `${indent(level)}// ${line}`.trimEnd());
}

function expressionCode(block, fallback = "0") {
  if (!block) return fallback;

  switch (block.type) {
    case "arduino_digital_read":
      return `digitalRead(${field(block, "PIN", "2")})`;
    case "arduino_analog_read":
      return `analogRead(${field(block, "PIN", "A0")})`;
    case "arduino_millis":
      return "millis()";
    case "arduino_variable_get":
      return field(block, "NAME", "value");
    case "arduino_number":
      return field(block, "VALUE", "0");
    case "arduino_text":
      return quoteString(block.getFieldValue("TEXT") || "");
    case "arduino_compare":
      return `(${valueCode(block, "LEFT", "0")} ${field(block, "OP", "==")} ${valueCode(block, "RIGHT", "0")})`;
    case "arduino_logic_op":
      return `(${valueCode(block, "LEFT", "false")} ${field(block, "OP", "&&")} ${valueCode(block, "RIGHT", "false")})`;
    case "arduino_not":
      return `(!${valueCode(block, "VALUE", "false")})`;
    case "arduino_arithmetic":
      return `(${valueCode(block, "LEFT", "0")} ${field(block, "OP", "+")} ${valueCode(block, "RIGHT", "0")})`;
    case "arduino_map":
      return `map(${valueCode(block, "VALUE", "0")}, ${valueCode(block, "FROM_LOW", "0")}, ${valueCode(block, "FROM_HIGH", "1023")}, ${valueCode(block, "TO_LOW", "0")}, ${valueCode(block, "TO_HIGH", "255")})`;
    case "arduino_constrain":
      return `constrain(${valueCode(block, "VALUE", "0")}, ${valueCode(block, "LOW", "0")}, ${valueCode(block, "HIGH", "255")})`;
    default:
      return fallback;
  }
}

function statementLines(block, level) {
  if (!block) return [];

  switch (block.type) {
    case "arduino_comment":
      return commentLines(block.getFieldValue("TEXT"), level);
    case "arduino_pin_mode":
      return [`${indent(level)}pinMode(${field(block, "PIN", "13")}, ${field(block, "MODE", "OUTPUT")});`];
    case "arduino_digital_write":
      return [`${indent(level)}digitalWrite(${field(block, "PIN", "13")}, ${field(block, "VALUE", "LOW")});`];
    case "arduino_analog_write":
      return [`${indent(level)}analogWrite(${field(block, "PIN", "9")}, ${valueCode(block, "VALUE", "0")});`];
    case "arduino_delay":
      return [`${indent(level)}delay(${valueCode(block, "MS", "1000")});`];
    case "arduino_serial_begin":
      return [`${indent(level)}Serial.begin(${field(block, "BAUD", "9600")});`];
    case "arduino_serial_print":
      return [`${indent(level)}Serial.print(${valueCode(block, "VALUE", quoteString("hello"))});`];
    case "arduino_serial_println":
      return [`${indent(level)}Serial.println(${valueCode(block, "VALUE", quoteString("hello"))});`];
    case "arduino_define_variable":
      return [`${indent(level)}${field(block, "VAR_TYPE", "int")} ${field(block, "NAME", "counter")} = ${valueCode(block, "VALUE", "0")};`];
    case "arduino_set_variable":
      return [`${indent(level)}${field(block, "NAME", "counter")} = ${valueCode(block, "VALUE", "0")};`];
    case "arduino_change_variable":
      return [`${indent(level)}${field(block, "NAME", "counter")} += ${valueCode(block, "AMOUNT", "1")};`];
    case "arduino_if": {
      const lines = [`${indent(level)}if (${valueCode(block, "COND", "false")}) {`];
      lines.push(...statementInputLines(block, "DO", level + 1));
      lines.push(`${indent(level)}}`);
      return lines;
    }
    case "arduino_if_else": {
      const lines = [`${indent(level)}if (${valueCode(block, "COND", "false")}) {`];
      lines.push(...statementInputLines(block, "THEN", level + 1));
      lines.push(`${indent(level)}} else {`);
      lines.push(...statementInputLines(block, "ELSE", level + 1));
      lines.push(`${indent(level)}}`);
      return lines;
    }
    default:
      return [`${indent(level)}// Unsupported block: ${block.type || "unknown"}`];
  }
}

function statementChainLines(startBlock, level) {
  const lines = [];
  const seen = new Set();
  let current = startBlock;
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    lines.push(...statementLines(current, level));
    current = current.getNextBlock?.() || null;
  }
  return lines;
}

function topLevelStatementBlocks(workspace) {
  return (workspace?.getTopBlocks?.(true) || []).filter((block) => {
    return STATEMENT_BLOCKS.has(block.type) && !block.getParent?.();
  });
}

function generateArduinoCodeFromWorkspace(workspace) {
  const globals = [];
  const setup = [];
  const loop = [];

  topLevelStatementBlocks(workspace).forEach((topBlock) => {
    const seen = new Set();
    let current = topBlock;
    while (current && !seen.has(current.id)) {
      seen.add(current.id);
      if (GLOBAL_BLOCKS.has(current.type)) globals.push(...statementLines(current, 0));
      else if (SETUP_BLOCKS.has(current.type)) setup.push(...statementLines(current, 1));
      else loop.push(...statementLines(current, 1));
      current = current.getNextBlock?.() || null;
    }
  });

  const lines = [];
  if (globals.length) {
    lines.push(...globals);
    lines.push("");
  }
  lines.push("void setup() {");
  lines.push(...setup);
  lines.push("}");
  lines.push("");
  lines.push("void loop() {");
  lines.push(...loop);
  lines.push("}");
  return `${lines.join("\n")}\n`;
}

function serializeBlocklyWorkspace(Blockly, workspace) {
  if (!workspace) return emptyBlocklyState();
  if (Blockly.serialization?.workspaces?.save) {
    return Blockly.serialization.workspaces.save(workspace);
  }
  const xml = Blockly.Xml.workspaceToDom(workspace);
  return { xml: Blockly.Xml.domToText(xml) };
}

function loadBlocklyWorkspaceState(Blockly, workspace, state) {
  if (!state) return;
  try {
    if (state.xml && Blockly.Xml?.textToDom) {
      Blockly.Xml.domToWorkspace(Blockly.Xml.textToDom(state.xml), workspace);
      return;
    }
    if (Blockly.serialization?.workspaces?.load) {
      Blockly.serialization.workspaces.load(state, workspace);
    }
  } catch (err) {
    console.warn("[ArduinoBlocksEditor] Could not load Blockly workspace state:", err);
  }
}

function installStyles(host) {
  const style = document.createElement("style");
  style.textContent = `
    .nv-arduino-panel {
      display: grid;
      grid-template-columns: minmax(320px, 1fr) minmax(240px, 320px);
      gap: 10px;
      height: 100%;
      min-height: 0;
      color: #102030;
    }
    .nv-arduino-placement-panel,
    .nv-arduino-side-panel {
      min-width: 0;
      min-height: 0;
      border: 1px solid #c7d1dc;
      border-radius: 8px;
      background: #fff;
      overflow: hidden;
    }
    .nv-arduino-placement-panel {
      display: flex;
      flex-direction: column;
    }
    .nv-arduino-blockly-host {
      flex: 1;
      min-height: 0;
      width: 100%;
      background: #fff;
    }
    .nv-arduino-side-panel {
      display: grid;
      grid-template-rows: auto minmax(0, 1fr);
    }
    .nv-arduino-side-title {
      margin: 0;
      padding: 10px;
      border-bottom: 1px solid #dbe3eb;
      font: 700 13px/1.2 system-ui, sans-serif;
    }
    .nv-arduino-preview-wrap { min-height: 0; padding: 10px; }
    .nv-arduino-preview {
      width: 100%;
      height: 100%;
      min-height: 220px;
      box-sizing: border-box;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 7px;
      resize: none;
      font: 12px/1.4 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      color: #111827;
      background: #fff;
    }
    .nv-arduino-convert {
      margin: 10px;
      padding: 10px;
      border: 1px solid #e2c56e;
      border-radius: 8px;
      background: #fff8df;
      color: #5c4310;
      font: 12px/1.4 system-ui, sans-serif;
    }
    .nv-arduino-convert button {
      margin-left: 8px;
      border: 1px solid #a8b4c1;
      border-radius: 6px;
      background: #eef5fb;
      color: #102030;
      cursor: pointer;
      min-height: 28px;
      font: 12px/1.2 system-ui, sans-serif;
    }
    @media (max-width: 900px) {
      .nv-arduino-panel { grid-template-columns: 1fr; }
    }
  `;
  host.appendChild(style);
}

function button(label, onClick) {
  const el = document.createElement("button");
  el.type = "button";
  el.textContent = label;
  el.addEventListener("click", onClick);
  return el;
}

export async function renderEditor(filePath, container) {
  if (!container) throw new Error("Container required");

  resetEditorHooks();
  ensureNodevisionState("ArduinoBlockEditing");

  const { status, body } = createBaseLayout(container, `Arduino Blocks - ${filePath}`);
  body.style.overflow = "hidden";
  status.textContent = "Loading Blockly...";

  let originalText = "";
  let Blockly = null;
  try {
    [originalText, Blockly] = await Promise.all([fetchText(filePath), loadBlockly()]);
    registerArduinoBlocks(Blockly);
  } catch (err) {
    body.innerHTML = `<div style="color:#b00020;font:13px monospace;">Failed to load Arduino block editor: ${err.message}</div>`;
    status.textContent = "Load failed";
    return;
  }

  const loadedBlocklyState = readWorkspaceStateFromSketch(originalText);
  const state = {
    blocklyState: loadedBlocklyState || emptyBlocklyState(),
    blocklyWorkspace: null,
    resizeObserver: null,
    originalText,
    protectOriginal: !loadedBlocklyState && originalText.trim().length > 0,
    dirty: false,
    preview: null,
  };

  function openCategory(heading) {
    window.dispatchEvent(new CustomEvent("nv-show-subtoolbar", {
      detail: { heading, force: true, toggle: false },
    }));
    status.textContent = `${heading} blocks ready`;
    updateToolbar();
  }

  function refreshPreview() {
    if (!state.preview) return;
    state.preview.value = state.protectOriginal
      ? state.originalText
      : generateArduinoCodeFromWorkspace(state.blocklyWorkspace);
  }

  function currentBlocklyState() {
    return serializeBlocklyWorkspace(Blockly, state.blocklyWorkspace);
  }

  function sketchTextForSave() {
    return state.protectOriginal
      ? state.originalText
      : createSketchText(currentBlocklyState(), generateArduinoCodeFromWorkspace(state.blocklyWorkspace));
  }

  function syncSaveHooks() {
    window.getEditorMarkdown = undefined;
    window.saveMDFile = async (path = filePath) => {
      await saveText(path, sketchTextForSave());
      state.dirty = false;
      updateToolbarState({ fileIsDirty: false });
      status.textContent = `Saved ${path || filePath}`;
    };
    window.saveWYSIWYGFile = window.saveMDFile;
  }

  function updateToolbar(extra = {}) {
    window.NodevisionState = window.NodevisionState || {};
    window.NodevisionState.activeActionHandler = handleArduinoToolbarAction;
    updateToolbarState({
      currentMode: "ArduinoBlockEditing",
      activePanelType: "GraphicalEditor",
      activeActionHandler: handleArduinoToolbarAction,
      selectedFile: filePath,
      activeEditorFilePath: filePath,
      ...extra,
    });
  }

  function markDirty(message) {
    state.protectOriginal = false;
    state.dirty = true;
    status.textContent = message || "Arduino sketch changed";
    refreshPreview();
    syncSaveHooks();
    updateToolbarState({ fileIsDirty: true });
  }

  function positionNewBlock(block) {
    const others = state.blocklyWorkspace.getTopBlocks(false).filter((item) => item.id !== block.id);
    const row = others.length;
    const x = 24 + (row % 3) * 32;
    const y = 24 + row * 56;
    block.moveBy(x, y);
  }

  function insertBlocklyBlock(type) {
    if (!state.blocklyWorkspace || !type) return;
    const block = state.blocklyWorkspace.newBlock(type);
    block.initSvg();
    block.render(false);
    positionNewBlock(block);
    block.select();
    Blockly.svgResize(state.blocklyWorkspace);
    markDirty(`Inserted ${BLOCK_LABELS[type] || "block"}`);
  }

  function handleArduinoToolbarAction(callbackKey) {
    const heading = CATEGORY_ACTIONS[callbackKey];
    if (heading) {
      openCategory(heading);
      return;
    }

    const type = INSERT_ACTIONS[callbackKey];
    if (type) insertBlocklyBlock(type);
  }

  function disposeBlocklyWorkspace() {
    if (state.resizeObserver) {
      state.resizeObserver.disconnect();
      state.resizeObserver = null;
    }
    if (state.blocklyWorkspace) {
      state.blocklyWorkspace.dispose();
      state.blocklyWorkspace = null;
    }
  }

  function renderAll() {
    disposeBlocklyWorkspace();
    body.innerHTML = "";
    installStyles(body);

    const root = document.createElement("div");
    root.className = "nv-arduino-panel";

    const placement = document.createElement("main");
    placement.className = "nv-arduino-placement-panel";

    if (state.protectOriginal) {
      const convert = document.createElement("div");
      convert.className = "nv-arduino-convert";
      convert.textContent = "Existing code is loaded without block data.";
      convert.appendChild(button("Start block sketch", () => {
        state.protectOriginal = false;
        markDirty("Started block sketch");
        renderAll();
      }));
      placement.appendChild(convert);
    }

    const blocklyHost = document.createElement("div");
    blocklyHost.className = "nv-arduino-blockly-host";
    placement.appendChild(blocklyHost);
    root.appendChild(placement);

    const side = document.createElement("aside");
    side.className = "nv-arduino-side-panel";

    const title = document.createElement("h3");
    title.className = "nv-arduino-side-title";
    title.textContent = "Arduino Code";
    side.appendChild(title);

    const previewWrap = document.createElement("div");
    previewWrap.className = "nv-arduino-preview-wrap";
    const preview = document.createElement("textarea");
    preview.className = "nv-arduino-preview";
    preview.readOnly = true;
    previewWrap.appendChild(preview);
    side.appendChild(previewWrap);
    state.preview = preview;

    root.appendChild(side);
    body.appendChild(root);

    state.blocklyWorkspace = Blockly.inject(blocklyHost, {
      toolbox: null,
      trashcan: true,
      sounds: false,
      grid: { spacing: 20, length: 3, colour: "#dbe3eb", snap: true },
      move: { scrollbars: true, drag: true, wheel: true },
      zoom: { controls: true, wheel: true, startScale: 0.9, maxScale: 1.8, minScale: 0.45, scaleSpeed: 1.1 },
    });
    loadBlocklyWorkspaceState(Blockly, state.blocklyWorkspace, state.blocklyState);
    state.blocklyWorkspace.addChangeListener((event) => {
      if (event?.isUiEvent) return;
      if (event?.type === Blockly.Events?.FINISHED_LOADING) return;
      state.blocklyState = currentBlocklyState();
      markDirty("Arduino blocks changed");
    });
    state.resizeObserver = new ResizeObserver(() => Blockly.svgResize(state.blocklyWorkspace));
    state.resizeObserver.observe(blocklyHost);
    setTimeout(() => Blockly.svgResize(state.blocklyWorkspace), 0);

    refreshPreview();
    syncSaveHooks();
  }

  container.__nvActiveEditorCleanup = () => {
    disposeBlocklyWorkspace();
    if (window.NodevisionState?.activeActionHandler === handleArduinoToolbarAction) {
      window.NodevisionState.activeActionHandler = null;
      updateToolbarState({ activeActionHandler: null });
    }
  };

  renderAll();
  syncSaveHooks();
  updateToolbar({ fileIsDirty: false });
  status.textContent = state.protectOriginal ? "Existing sketch loaded" : "Arduino Blockly panel ready";
}
