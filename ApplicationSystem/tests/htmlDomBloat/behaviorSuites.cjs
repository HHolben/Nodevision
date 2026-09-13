// Nodevision/ApplicationSystem/tests/htmlDomBloat/behaviorSuites.cjs
// This module runs focused editor behavior experiments for the HTML DOM bloat benchmark using synthetic fixtures and shared metric helpers.

const { mount } = require("./electronHarness.cjs");
const { structuralMetrics } = require("./htmlMetrics.cjs");
const { htmlDocument, writeFixture } = require("./textFixtures.cjs");

async function runRoundTripGrowth(win, fixture, cycles = [0, 1, 5, 10]) {
  await mount(win, fixture.relativePath, { spellcheck: true });
  let html = await win.webContents.executeJavaScript("window.getEditorHTML()", true);
  const rows = [];
  for (let cycle = 0; cycle <= Math.max(...cycles); cycle += 1) {
    if (cycles.includes(cycle)) rows.push({ cycle, metrics: structuralMetrics(html) });
    if (cycle === Math.max(...cycles)) break;
    await win.webContents.executeJavaScript("window.__nvDomBloatSelectPosition('middle')", true);
    await win.webContents.executeJavaScript(`window.__nvDomBloatTypeChars(${JSON.stringify(" x")}, { delayMs: 18 })`, true);
    html = await win.webContents.executeJavaScript("window.getEditorHTML()", true);
    await win.webContents.executeJavaScript(`window.__nvDomBloatSetEditorHtml(${JSON.stringify(html)})`, true);
    html = await win.webContents.executeJavaScript("window.getEditorHTML()", true);
  }
  return { fixtureId: fixture.id, rows };
}

async function runDomBehaviorExperiments(win) {
  const simple = writeFixture("Z-simple-enter.html", htmlDocument("Simple enter behavior", "<p id=\"typing-target\">Alpha beta gamma delta epsilon.</p><p>Second paragraph for context.</p>"));
  const fixture = { id: "Z-simple-enter", family: "behavior", relativePath: simple.relativePath, metrics: structuralMetrics(simple.html) };
  await mount(win, fixture.relativePath, { spellcheck: true });
  const enterOnce = await win.webContents.executeJavaScript("window.__nvDomBloatEnterExperiment(1, '')", true);
  await mount(win, fixture.relativePath, { spellcheck: true });
  const enterTwice = await win.webContents.executeJavaScript("window.__nvDomBloatEnterExperiment(2, '')", true);
  await mount(win, fixture.relativePath, { spellcheck: true });
  const enterManyType = await win.webContents.executeJavaScript("window.__nvDomBloatEnterExperiment(5, 'after blanks')", true);
  await mount(win, fixture.relativePath, { spellcheck: true });
  const backspaceCleanup = await win.webContents.executeJavaScript("window.__nvDomBloatDeleteExperiment('backspace')", true);
  await mount(win, fixture.relativePath, { spellcheck: true });
  const deleteCleanup = await win.webContents.executeJavaScript("window.__nvDomBloatDeleteExperiment('delete')", true);
  await mount(win, fixture.relativePath, { spellcheck: true });
  const pasteHtml = await win.webContents.executeJavaScript(
    `window.__nvDomBloatPasteExperiment(${JSON.stringify("One line\nwrapped line\n\nSecond paragraph\n\n\nFourth paragraph after extra blanks")})`,
    true
  );
  return {
    fixtureId: fixture.id,
    enterOnce: { html: enterOnce.slice(0, 1000), metrics: structuralMetrics(htmlDocument("fragment", enterOnce)) },
    enterTwice: { html: enterTwice.slice(0, 1000), metrics: structuralMetrics(htmlDocument("fragment", enterTwice)) },
    enterManyType: { html: enterManyType.slice(0, 1000), metrics: structuralMetrics(htmlDocument("fragment", enterManyType)) },
    backspaceCleanup: { html: backspaceCleanup.slice(0, 1000), metrics: structuralMetrics(htmlDocument("fragment", backspaceCleanup)) },
    deleteCleanup: { html: deleteCleanup.slice(0, 1000), metrics: structuralMetrics(htmlDocument("fragment", deleteCleanup)) },
    paste: { html: pasteHtml.slice(0, 1000), metrics: structuralMetrics(htmlDocument("fragment", pasteHtml)) },
  };
}

async function runSaveReloadStability(win) {
  const variants = [
    { id: "div-br", body: "<div id=\"typing-target\"><br></div><p>Visible paragraph follows.</p>" },
    { id: "div-class-br", body: "<div class=\"\" id=\"typing-target\"><br></div><p>Visible paragraph follows.</p>" },
    { id: "p-br", body: "<p id=\"typing-target\"><br></p><p>Visible paragraph follows.</p>" },
  ];
  const output = [];
  for (const variant of variants) {
    const written = writeFixture(`Z-stability-${variant.id}.html`, htmlDocument(`Stability ${variant.id}`, variant.body));
    await mount(win, written.relativePath, { spellcheck: true });
    let html = await win.webContents.executeJavaScript("window.getEditorHTML()", true);
    const rows = [{ cycle: 0, metrics: structuralMetrics(html) }];
    for (let cycle = 1; cycle <= 5; cycle += 1) {
      await win.webContents.executeJavaScript(`window.__nvDomBloatSetEditorHtml(${JSON.stringify(html)})`, true);
      html = await win.webContents.executeJavaScript("window.getEditorHTML()", true);
      rows.push({ cycle, metrics: structuralMetrics(html) });
    }
    output.push({ representation: variant.id, rows });
  }
  return output;
}

module.exports = { runDomBehaviorExperiments, runRoundTripGrowth, runSaveReloadStability };
