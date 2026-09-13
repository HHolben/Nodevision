// Nodevision/ApplicationSystem/tests/htmlDomBloat/editorSourceScan.cjs
// This module scans known editor source files for DOM operations relevant to benchmark reports while keeping the main Electron runner focused on orchestration.

const fs = require("node:fs");
const path = require("node:path");
const { ROOT } = require("./config.cjs");

function inspectEditorSource() {
  const targets = [
    "ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditorComponents/HTMLeditorImpl.mjs",
    "ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditorComponents/WysiwygProgrammaticHistory.mjs",
    "ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditor.mjs",
  ];
  const patterns = [
    { key: "setAttributeClass", re: /setAttribute\(["']class["']/ },
    { key: "emptyClassLiteral", re: /class(Name)?\s*=\s*["']["']/ },
    { key: "createDiv", re: /createElement\(["']div["']\)/ },
    { key: "createBr", re: /createElement\(["']br["']\)/ },
    { key: "execCommandInsertHTML", re: /execCommand\(["']insertHTML["']/ },
    { key: "execCommandInsertText", re: /execCommand\(["']insertText["']/ },
    { key: "pasteListeners", re: /addEventListener\(["']paste["']/ },
    { key: "beforeInputListeners", re: /addEventListener\(["']beforeinput["']/ },
    { key: "inputListeners", re: /addEventListener\(["']input["']/ },
  ];
  const findings = [];
  for (const target of targets) {
    const abs = path.join(ROOT, target);
    const text = fs.existsSync(abs) ? fs.readFileSync(abs, "utf8") : "";
    const lines = text.split(/\r?\n/);
    for (const [index, line] of lines.entries()) {
      for (const pattern of patterns) {
        if (pattern.re.test(line)) findings.push({ file: target, line: index + 1, kind: pattern.key, text: line.trim().slice(0, 220) });
      }
    }
  }
  return findings;
}

module.exports = { inspectEditorSource };
