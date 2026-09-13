// Nodevision/ApplicationSystem/tests/htmlDomBloat/rendererSetup.cjs
// This module combines small renderer-side benchmark fragments into the single script string injected into the Electron BrowserWindow.

const { rendererEditorHarness } = require("./rendererEditorHarness.cjs");
const { rendererExperiments } = require("./rendererExperiments.cjs");
const { rendererMetricsPatch } = require("./rendererMetricsPatch.cjs");
const { rendererOperations } = require("./rendererOperations.cjs");
const { rendererSelectionTyping } = require("./rendererSelectionTyping.cjs");

const rendererSetup = [
  rendererMetricsPatch,
  rendererEditorHarness,
  rendererSelectionTyping,
  rendererOperations,
  rendererExperiments,
].join("\n");

module.exports = { rendererSetup };
