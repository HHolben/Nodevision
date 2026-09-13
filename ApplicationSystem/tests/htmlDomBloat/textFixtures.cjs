// Nodevision/ApplicationSystem/tests/htmlDomBloat/textFixtures.cjs
// This module builds deterministic synthetic HTML fixtures for the DOM bloat benchmark so performance investigations never depend on private user Notebook content.

const fs = require("node:fs");
const path = require("node:path");
const cheerio = require("cheerio");
const { FIXTURE_ROOT } = require("./config.cjs");
const { isCheerioBlankBlock, structuralMetrics } = require("./htmlMetrics.cjs");

const WORD_BANK = [
  "steady", "notebook", "analysis", "chapter", "reader", "context", "method",
  "example", "system", "careful", "signal", "revision", "paragraph", "editor",
  "document", "evidence", "neutral", "design", "process", "detail", "section",
  "visible", "result", "measure", "structure", "typing", "browser", "layout",
  "selection", "content", "sample", "ordinary", "language", "record", "stable",
  "synthetic", "prose", "benchmark", "diagnostic", "fragment", "inline",
  "blank", "block", "render", "latency", "frame", "mutation", "attribute",
  "sequence", "position", "article", "draft", "summary", "finding", "control",
  "variant", "repeatable", "window", "style", "paint", "observe", "plain",
  "sentence", "reference", "however", "therefore", "because", "between"
];

function escapeHtml(value = "") {
  return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function generatedWords(count, offset = 0) {
  const words = [];
  for (let i = 0; i < count; i += 1) words.push(WORD_BANK[(i + offset) % WORD_BANK.length]);
  return words;
}

function sentenceFromWords(words, start = 0, length = 16) {
  const slice = words.slice(start, Math.min(words.length, start + length));
  if (!slice.length) return "";
  const text = slice.join(" ");
  return text.charAt(0).toUpperCase() + text.slice(1) + ".";
}

function makeParagraphs(wordCount, options = {}) {
  const words = generatedWords(wordCount, options.offset || 0);
  const paragraphs = [];
  let cursor = 0;
  let paragraphIndex = 0;
  while (cursor < words.length) {
    const targetLength = Math.min(words.length - cursor, 82 + ((paragraphIndex * 23 + 17) % 58));
    const sentences = [];
    let remaining = targetLength;
    while (remaining > 0) {
      const len = Math.min(remaining, 13 + ((cursor + remaining + paragraphIndex) % 13));
      sentences.push(sentenceFromWords(words, cursor, len));
      cursor += len;
      remaining -= len;
    }
    paragraphs.push(sentences.join(" "));
    paragraphIndex += 1;
  }
  return paragraphs;
}

function htmlDocument(title, body, extraHead = "") {
  return [
    "<!DOCTYPE html>",
    "<html>",
    "<head>",
    "  <meta charset=\"utf-8\">",
    `  <title>${escapeHtml(title)}</title>`,
    "  <style>body{font-family:Arial,sans-serif;line-height:1.55;max-width:780px;margin:32px auto;padding:0 24px;color:#222} blockquote{border-left:3px solid #bbb;margin:18px 0;padding-left:16px;color:#444} li{margin:6px 0}</style>",
    extraHead,
    "</head>",
    "<body>",
    body,
    "</body>",
    "</html>",
  ].filter(Boolean).join("\n");
}

function cleanFixture(wordCount) {
  const body = makeParagraphs(wordCount).map((paragraph, index) =>
    `<p id="${index === 0 ? "typing-target" : `p-${index}`}">${escapeHtml(paragraph)}</p>`
  ).join("\n");
  return htmlDocument(`Clean prose ${wordCount}`, body);
}

function realisticFixture(wordCount) {
  const paragraphs = makeParagraphs(wordCount, { offset: 7 });
  const parts = ["<h1 id=\"typing-target\">Synthetic Long Form Study</h1>"];
  let linkCount = 0;
  paragraphs.forEach((paragraph, index) => {
    if (index % 12 === 0) parts.push(`<h2>Section ${Math.floor(index / 12) + 1}</h2>`);
    let text = escapeHtml(paragraph);
    if (linkCount < 8 && index > 0 && index % 15 === 0) {
      text = text.replace("document", `<a href="https://example.com/reference-${linkCount + 1}">document</a>`);
      linkCount += 1;
    }
    if (index % 31 === 10) parts.push(`<blockquote>${text}</blockquote>`);
    else if (index % 29 === 14) parts.push(`<ul>${paragraph.split(". ").slice(0, 3).map((item) => `<li>${escapeHtml(item.replace(/\.$/, ""))}</li>`).join("")}</ul>`);
    else parts.push(`<p>${text}</p>`);
  });
  return htmlDocument(`Realistic prose ${wordCount}`, parts.join("\n"));
}

function fragmentedFixture(wordCount, options = {}) {
  const paragraphs = makeParagraphs(wordCount, { offset: options.offset || 13 });
  const body = paragraphs.map((paragraph, paragraphIndex) => {
    const words = paragraph.replace(/[.]/g, " .").split(/\s+/).filter(Boolean);
    const chunks = [];
    for (let i = 0; i < words.length; i += options.spanChunk || 1) {
      const chunk = words.slice(i, i + (options.spanChunk || 1)).join(" ").replace(/\s+\./g, ".");
      const escaped = escapeHtml(chunk);
      if (options.spanChunk) chunks.push(`<span>${escaped}</span>`);
      else if ((i + paragraphIndex) % 19 === 0) chunks.push(`<em>${escaped}</em>`);
      else if ((i + paragraphIndex) % 23 === 0) chunks.push(`<strong>${escaped}</strong>`);
      else if ((i + paragraphIndex) % 37 === 0) chunks.push(`<a href="https://example.com/inline-${paragraphIndex}-${i}">${escaped}</a>`);
      else chunks.push(escaped);
    }
    return `<p id="${paragraphIndex === 0 ? "typing-target" : `${options.idPrefix || "inline"}-${paragraphIndex}`}">${chunks.join(" ").replace(/\s+\./g, ".")}</p>`;
  }).join("\n");
  return htmlDocument(options.title || `Inline fragmented ${wordCount}`, body);
}

function nodevisionBlankFixture(wordCount, density = 1, withEmptyClass = true) {
  const paragraphs = makeParagraphs(wordCount, { offset: 31 });
  const empty = withEmptyClass ? "<div class=\"\"><br></div>" : "<div><br></div>";
  const parts = [];
  paragraphs.forEach((paragraph, index) => {
    parts.push(`<div class="" id="${index === 0 ? "typing-target" : `nv-${index}`}">${escapeHtml(paragraph)}</div>`);
    let blanks = density;
    if (density >= 2 && index % 4 === 0) blanks += 1;
    if (density >= 4 && index % 7 === 0) blanks += 2;
    for (let i = 0; i < blanks; i += 1) parts.push(empty);
  });
  return htmlDocument(`Nodevision blank blocks ${wordCount} d${density}`, parts.join("\n"));
}

function oneArticleFixture(wordCount) {
  const body = `<article id="typing-target">\n${makeParagraphs(wordCount, { offset: 43 }).map((p) => `<p>${escapeHtml(p)}</p>`).join("\n")}\n</article>`;
  return htmlDocument(`One article ${wordCount}`, body);
}

function normalizedSyntheticCopy(html) {
  const $ = cheerio.load(html, { decodeEntities: false });
  $("div").each((_, el) => { const node = $(el); if (node.attr("class") === "") node.removeAttr("class"); });
  $("body").children("div").each((_, el) => {
    const node = $(el);
    if (!isCheerioBlankBlock($, node)) return;
    const prev = node.prev();
    if (prev.length && isCheerioBlankBlock($, prev)) node.remove();
  });
  return $.html();
}

function writeFixture(relativePath, html) {
  const absPath = path.join(FIXTURE_ROOT, relativePath);
  fs.mkdirSync(path.dirname(absPath), { recursive: true });
  fs.writeFileSync(absPath, html, "utf8");
  return { relativePath: "__nv_html_dom_bloat/" + relativePath.split(path.sep).join("/"), absPath, html };
}

function buildFixtures() {
  fs.mkdirSync(FIXTURE_ROOT, { recursive: true });
  const fixtures = [];
  for (const words of [1000, 5000, 10000, 20000]) {
    fixtures.push({ id: `A-clean-${words}`, family: "clean", words, ...writeFixture(`A-clean-${words}.html`, cleanFixture(words)) });
    fixtures.push({ id: `B-realistic-${words}`, family: "realistic", words, ...writeFixture(`B-realistic-${words}.html`, realisticFixture(words)) });
  }
  fixtures.push({ id: "C-inline-20000", family: "inline-fragmented", words: 20000, ...writeFixture("C-inline-20000.html", fragmentedFixture(20000)) });
  fixtures.push({ id: "D-span-20000", family: "span-fragmented", words: 20000, ...writeFixture("D-span-20000.html", fragmentedFixture(20000, { offset: 19, spanChunk: 4, idPrefix: "frag", title: "Highly fragmented 20000" })) });
  for (const words of [5000, 10000, 20000]) {
    fixtures.push({ id: `E1-blank-class-${words}`, family: "blank-e1", words, ...writeFixture(`E1-blank-class-${words}.html`, nodevisionBlankFixture(words, 1, true)) });
    fixtures.push({ id: `E2-blank-class-${words}`, family: "blank-e2", words, ...writeFixture(`E2-blank-class-${words}.html`, nodevisionBlankFixture(words, 2, true)) });
    fixtures.push({ id: `E3-blank-class-${words}`, family: "blank-e3", words, ...writeFixture(`E3-blank-class-${words}.html`, nodevisionBlankFixture(words, 4, true)) });
  }
  fixtures.push({ id: "F-blank-no-class-20000", family: "blank-no-class", words: 20000, ...writeFixture("F-blank-no-class-20000.html", nodevisionBlankFixture(20000, 2, false)) });
  fixtures.push({ id: "G-one-article-20000", family: "one-article", words: 20000, ...writeFixture("G-one-article-20000.html", oneArticleFixture(20000)) });
  const source = fixtures.find((fixture) => fixture.id === "E3-blank-class-20000");
  fixtures.push({ id: "X-normalized-E3-20000", family: "normalized-copy", words: 20000, ...writeFixture("X-normalized-E3-20000.html", normalizedSyntheticCopy(source.html)) });
  return fixtures.map((fixture) => ({ id: fixture.id, family: fixture.family, targetWords: fixture.words, relativePath: fixture.relativePath, absPath: fixture.absPath, metrics: structuralMetrics(fixture.html) }));
}

module.exports = { buildFixtures, htmlDocument, writeFixture };
