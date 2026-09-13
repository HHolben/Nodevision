// Nodevision/ApplicationSystem/tests/htmlDomBloat/config.cjs
// This module centralizes configuration and deterministic text shared by the HTML DOM bloat benchmark so that the Electron runner and helper modules can stay small, readable, and offline-first.

const path = require("node:path");

const ROOT = process.cwd();
const PORT = Number(process.env.NODEVISION_HTML_DOM_BLOAT_PORT || 39463);
const FIXTURE_ROOT = path.join(ROOT, "Notebook", "__nv_html_dom_bloat");
const PUBLIC_HARNESS = path.join(ROOT, "ApplicationSystem/public/__html-dom-bloat-harness.html");
const REPORT_PATH = process.env.NODEVISION_HTML_DOM_BLOAT_REPORT ||
  path.join(ROOT, "ApplicationSystem/tests/htmlDomBloatBenchmark.report.json");
const RUN_FULL = process.env.NODEVISION_HTML_DOM_BLOAT_FULL === "1";
const OPS_ONLY = process.env.NODEVISION_HTML_DOM_BLOAT_OPS_ONLY === "1";
const ATTACH_LAYERS = process.env.NODEVISION_HTML_DOM_BLOAT_ATTACH_LAYERS === "1";

const TYPING_TEXT = [
  " careful synthetic typing keeps this benchmark deterministic while still",
  " resembling a fast human edit in a long prose document."
].join("");

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = {
  ATTACH_LAYERS,
  FIXTURE_ROOT,
  OPS_ONLY,
  PORT,
  PUBLIC_HARNESS,
  REPORT_PATH,
  ROOT,
  RUN_FULL,
  TYPING_TEXT,
  delay,
};
