// Nodevision/scripts/audit-dirty-standards.mjs
// This development tool audits dirty native JavaScript files against Nodevision's line-count and opening-comment requirements, while reporting inherited violations separately from newly introduced ones.

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

// Acorn token locations exclude comments without misclassifying URL or shader strings.
const { tokenizer } = createRequire(import.meta.url)("acorn");
const root = fileURLToPath(new URL("../", import.meta.url));
const baselineRevision = process.argv.find(arg => arg.startsWith("--base="))?.slice(7) || "HEAD";
const git = (...args) => execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
const paths = [...new Set([
  ...git("diff", "--name-only", "-z", baselineRevision).split("\0"),
  ...git("ls-files", "--others", "--exclude-standard", "-z").split("\0"),
])].filter(path => path.startsWith("ApplicationSystem/") && !path.startsWith("ApplicationSystem/public/vendor/") && existsSync(root + path)).sort();

function codeLineCount(source) {
  const lines = source.split(/\r?\n/);
  const codeLines = new Set();
  for (const token of tokenizer(source, { ecmaVersion: "latest", sourceType: "module", locations: true, allowHashBang: true })) {
    for (let number = token.loc.start.line; number <= token.loc.end.line; number++) {
      if (lines[number - 1]?.trim()) codeLines.add(number);
    }
  }
  return codeLines.size;
}

// Header shape is mechanical; description quality and architecture still need review.
function audit(path) {
  const source = readFileSync(root + path, "utf8");
  const lines = source.split(/\r?\n/);
  let baseline = null;
  try { baseline = codeLineCount(git("show", baselineRevision + ":" + path)); } catch {}
  const violations = [];
  let codeLines = null;
  try { codeLines = codeLineCount(source); } catch (error) { violations.push("Parse error: " + error.message); }
  if (codeLines >= 200) violations.push("Must contain fewer than 200 nonblank, noncomment lines");
  if (lines[0] !== "// Nodevision/" + path) violations.push("Missing first-line repository path");
  if (!/^\/\/ [A-Z].*\.$/.test(lines[1] || "")) violations.push("Missing second-line description or sentence punctuation");
  return { path, codeLines, baselineCodeLines: baseline, inheritedLengthViolation: baseline >= 200, violations };
}

const exempt = paths.filter(path => /\.(json|yaml|csv)$/i.test(path));
const javascript = paths.filter(path => /\.(mjs|cjs|js)$/i.test(path));
const manualReview = paths.filter(path => !exempt.includes(path) && !javascript.includes(path));
const files = javascript.map(audit);
const failed = files.filter(file => file.violations.length);
const report = { checked: files.length, failed: failed.length, exempt, manualReview, files };
if (process.argv.includes("--json")) console.log(JSON.stringify(report, null, 2));
else {
  for (const file of files) {
    const status = file.violations.length ? "FAIL" : "PASS";
    console.log(`${status} ${String(file.codeLines).padStart(5)} lines (${baselineRevision}: ${file.baselineCodeLines ?? "new"}) ${file.path}`);
    for (const violation of file.violations) console.log("       " + violation);
  }
  console.log(`\n${files.length} files checked; ${failed.length} fail mechanical checks. ${manualReview.length} non-JavaScript files need manual review.`);
}
process.exitCode = failed.length || manualReview.length ? 1 : 0;
