// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/ArduinoBlockDefinitions.mjs
// Block palette definitions for the local Arduino blocks MVP.

let nextBlockId = 1;

export const STRUCTURE_BLOCK_TYPES = new Set(["setup", "loop"]);

export const STATEMENT_BLOCKS = {
  defineVariable: {
    category: "Variables",
    label: "define variable",
    defaults: { varType: "int", name: "counter", value: "0" },
  },
  comment: {
    category: "Structure",
    label: "comment",
    defaults: { text: "comment" },
  },
  pinMode: {
    category: "Pins",
    label: "pinMode",
    defaults: { pin: "13", mode: "OUTPUT" },
  },
  digitalWrite: {
    category: "Pins",
    label: "digitalWrite",
    defaults: { pin: "13", value: "HIGH" },
  },
  analogWrite: {
    category: "Pins",
    label: "analogWrite",
    defaults: { pin: "9", value: "128" },
  },
  delay: {
    category: "Timing",
    label: "delay",
    defaults: { ms: "1000" },
  },
  if: {
    category: "Logic",
    label: "if",
    defaults: { condition: "digitalRead(2) == HIGH", statements: [] },
  },
  ifElse: {
    category: "Logic",
    label: "if / else",
    defaults: { condition: "digitalRead(2) == HIGH", thenStatements: [], elseStatements: [] },
  },
  setVariable: {
    category: "Variables",
    label: "set variable",
    defaults: { name: "counter", value: "0" },
  },
  changeVariable: {
    category: "Variables",
    label: "change variable",
    defaults: { name: "counter", amount: "1" },
  },
  serialBegin: {
    category: "Serial",
    label: "Serial.begin",
    defaults: { baud: "9600" },
  },
  serialPrint: {
    category: "Serial",
    label: "Serial.print",
    defaults: { value: "\"hello\"", newline: false },
  },
  serialPrintln: {
    category: "Serial",
    label: "Serial.println",
    defaults: { value: "\"hello\"", newline: true },
  },
};

export const EXPRESSION_BLOCKS = [
  {
    category: "Pins",
    label: "digitalRead(pin)",
    value: "digitalRead(2)",
  },
  {
    category: "Pins",
    label: "analogRead(pin)",
    value: "analogRead(A0)",
  },
  {
    category: "Timing",
    label: "millis()",
    value: "millis()",
  },
  {
    category: "Logic",
    label: "comparison",
    value: "value == 0",
  },
  {
    category: "Logic",
    label: "and",
    value: "(left && right)",
  },
  {
    category: "Logic",
    label: "or",
    value: "(left || right)",
  },
  {
    category: "Logic",
    label: "not",
    value: "!(condition)",
  },
  {
    category: "Variables",
    label: "get variable",
    value: "counter",
  },
  {
    category: "Math",
    label: "number",
    value: "0",
  },
  {
    category: "Math",
    label: "arithmetic",
    value: "(a + b)",
  },
  {
    category: "Math",
    label: "map()",
    value: "map(value, 0, 1023, 0, 255)",
  },
  {
    category: "Math",
    label: "constrain()",
    value: "constrain(value, 0, 255)",
  },
];

export const TOOLBOX_CATEGORIES = [
  {
    id: "structure",
    label: "Structure",
    statements: ["comment"],
    actions: [
      { id: "selectSetup", label: "setup block", target: "setup" },
      { id: "selectLoop", label: "loop block", target: "loop" },
    ],
  },
  {
    id: "pins",
    label: "Pins",
    statements: ["pinMode", "digitalWrite", "analogWrite"],
    expressions: ["digitalRead(pin)", "analogRead(pin)"],
  },
  {
    id: "timing",
    label: "Timing",
    statements: ["delay"],
    expressions: ["millis()"],
  },
  {
    id: "logic",
    label: "Logic",
    statements: ["if", "ifElse"],
    expressions: ["comparison", "and", "or", "not"],
  },
  {
    id: "variables",
    label: "Variables",
    statements: ["defineVariable", "setVariable", "changeVariable"],
    expressions: ["get variable"],
  },
  {
    id: "serial",
    label: "Serial",
    statements: ["serialBegin", "serialPrint", "serialPrintln"],
  },
  {
    id: "math",
    label: "Math",
    expressions: ["number", "arithmetic", "map()", "constrain()"],
  },
];

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function createBlock(type) {
  const definition = STATEMENT_BLOCKS[type];
  if (!definition) {
    throw new Error(`Unknown Arduino block type: ${type}`);
  }

  return {
    id: `arduino-block-${Date.now()}-${nextBlockId++}`,
    type,
    ...clone(definition.defaults || {}),
  };
}

export function createStructureBlock(type, statements = []) {
  if (!STRUCTURE_BLOCK_TYPES.has(type)) {
    throw new Error(`Unknown Arduino structure block: ${type}`);
  }
  return {
    id: `arduino-${type}-${Date.now()}-${nextBlockId++}`,
    type,
    statements: Array.isArray(statements) ? statements : [],
  };
}

export function expressionBlocksForCategory(categoryId) {
  const category = TOOLBOX_CATEGORIES.find((item) => item.id === categoryId);
  const labels = new Set(category?.expressions || []);
  return EXPRESSION_BLOCKS.filter((item) => labels.has(item.label));
}

export function statementBlocksForCategory(categoryId) {
  const category = TOOLBOX_CATEGORIES.find((item) => item.id === categoryId);
  return (category?.statements || [])
    .map((type) => ({ type, ...STATEMENT_BLOCKS[type] }))
    .filter((item) => Boolean(item.label));
}
