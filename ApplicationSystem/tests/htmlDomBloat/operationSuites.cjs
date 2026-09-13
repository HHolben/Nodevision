// Nodevision/ApplicationSystem/tests/htmlDomBloat/operationSuites.cjs
// This module runs editing-operation fragmentation suites for the HTML DOM bloat benchmark and summarizes fixture metadata for the final report.

const { mount, runTypingPass } = require("./electronHarness.cjs");
const { inlineFragmentationMetrics, structuralMetrics } = require("./htmlMetrics.cjs");
const { writeFixture } = require("./textFixtures.cjs");
const { RUN_FULL } = require("./config.cjs");

async function collectEditorFragmentationSnapshot(win, label, operation = "") {
  const html = await win.webContents.executeJavaScript("window.__nvDomBloatCurrentEditorHtml()", true);
  return { label, operation, structural: structuralMetrics(html), inline: inlineFragmentationMetrics(html) };
}

async function runSingleOperationGrowth(win, fixture, operation, options = {}) {
  const batchSize = Number(options.batchSize || 25);
  const batches = Number(options.batches || 8);
  await mount(win, fixture.relativePath, { spellcheck: true });
  const snapshots = [await collectEditorFragmentationSnapshot(win, "cycle-0", operation)];
  for (let batch = 1; batch <= batches; batch += 1) {
    await win.webContents.executeJavaScript(
      "window.__nvDomBloatRunOperationBatch(" + JSON.stringify({ operation, iterations: batchSize, start: (batch - 1) * batchSize }) + ")",
      true
    );
    snapshots.push(await collectEditorFragmentationSnapshot(win, "cycle-" + (batch * batchSize), operation));
  }
  const finalHtml = await win.webContents.executeJavaScript("window.getEditorHTML()", true);
  const finalFixture = writeFixture("ops-final-" + operation + ".html", finalHtml);
  const finalTypingFixture = {
    id: "ops-final-" + operation,
    family: "ops-final",
    relativePath: finalFixture.relativePath,
    metrics: structuralMetrics(finalHtml),
  };
  const typing = await runTypingPass(win, finalTypingFixture, { spellcheck: true, position: "end" });
  return { operation, batchSize, batches, snapshots, finalTyping: typing };
}

async function runMixedEditingGrowth(win, fixture, options = {}) {
  const operations = options.operations || [
    "selection-only",
    "bold-toggle",
    "italic-toggle",
    "nodevision-style-toggle",
    "plain-type",
    "enter-delete",
    "link-toggle",
    "paste-plain",
    "undo-redo",
    "nodevision-font-toggle",
  ];
  const total = Number(options.total || 300);
  const checkpointEvery = Number(options.checkpointEvery || 50);
  await mount(win, fixture.relativePath, { spellcheck: true });
  const snapshots = [await collectEditorFragmentationSnapshot(win, "op-0", "mixed")];
  for (let i = 0; i < total; i += 1) {
    const operation = operations[i % operations.length];
    await win.webContents.executeJavaScript(
      "window.__nvDomBloatApplyOperation(" + JSON.stringify(operation) + ", " + JSON.stringify(i) + ")",
      true
    );
    if ((i + 1) % checkpointEvery === 0) {
      if ((i + 1) % (checkpointEvery * 2) === 0) {
        const html = await win.webContents.executeJavaScript("window.getEditorHTML()", true);
        await win.webContents.executeJavaScript("window.__nvDomBloatSetEditorHtml(" + JSON.stringify(html) + ")", true);
      }
      snapshots.push(await collectEditorFragmentationSnapshot(win, "op-" + (i + 1), "mixed"));
    }
  }
  const finalHtml = await win.webContents.executeJavaScript("window.getEditorHTML()", true);
  const finalFixture = writeFixture("ops-final-mixed.html", finalHtml);
  const finalTypingFixture = { id: "ops-final-mixed", family: "ops-final", relativePath: finalFixture.relativePath, metrics: structuralMetrics(finalHtml) };
  const typing = await runTypingPass(win, finalTypingFixture, { spellcheck: true, position: "end" });
  return { operations, total, checkpointEvery, snapshots, finalTyping: typing };
}

async function runOperationFragmentationSuite(win, fixtures) {
  const clean20k = fixtures.find((item) => item.id === "A-clean-20000");
  const operations = [
    "selection-only", "plain-type", "enter-delete", "bold-toggle",
    "bold-apply", "italic-toggle", "italic-apply", "nodevision-style-toggle",
    "nodevision-style-apply", "nodevision-font-toggle", "nodevision-font-apply",
    "link-toggle", "link-apply", "paste-plain", "copy-paste-html", "undo-redo",
  ];
  const operationRuns = [];
  for (const operation of operations) {
    console.log("[dom-bloat] operation growth " + operation);
    operationRuns.push(await runSingleOperationGrowth(win, clean20k, operation, { batchSize: 20, batches: 5 }));
  }
  console.log("[dom-bloat] mixed editing growth");
  const mixed = await runMixedEditingGrowth(win, clean20k, { total: 300, checkpointEvery: 50 });
  console.log("[dom-bloat] persisted mixed editing growth");
  const persistedMixed = await runMixedEditingGrowth(win, clean20k, {
    total: 300,
    checkpointEvery: 50,
    operations: [
      "selection-only", "bold-apply", "italic-apply", "nodevision-style-apply",
      "plain-type", "enter-delete", "link-apply", "paste-plain",
      "undo-redo", "nodevision-font-apply", "copy-paste-html",
    ],
  });
  return { baselineFixtureId: clean20k.id, operationRuns, mixed, persistedMixed };
}

function chooseBenchmarkFixtures(fixtures) {
  const wanted = RUN_FULL ? fixtures.map((fixture) => fixture.id) : [
    "A-clean-1000", "A-clean-5000", "A-clean-10000", "A-clean-20000",
    "B-realistic-1000", "B-realistic-5000", "B-realistic-10000", "B-realistic-20000",
    "C-inline-20000", "D-span-20000", "E1-blank-class-5000", "E1-blank-class-10000",
    "E1-blank-class-20000", "E2-blank-class-20000", "E3-blank-class-20000",
    "F-blank-no-class-20000", "X-normalized-E3-20000", "G-one-article-20000",
  ];
  const wantedSet = new Set(wanted);
  return fixtures.filter((fixture) => wantedSet.has(fixture.id));
}

function compactFixtureMetrics(fixtures) {
  return fixtures.map((fixture) => ({
    id: fixture.id,
    family: fixture.family,
    targetWords: fixture.targetWords,
    path: fixture.relativePath,
    metrics: fixture.metrics,
  }));
}

module.exports = { chooseBenchmarkFixtures, compactFixtureMetrics, runOperationFragmentationSuite };
