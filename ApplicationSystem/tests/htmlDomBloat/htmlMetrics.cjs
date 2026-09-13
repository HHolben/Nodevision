// Nodevision/ApplicationSystem/tests/htmlDomBloat/htmlMetrics.cjs
// This module measures synthetic HTML structure and inline fragmentation for the DOM bloat benchmark without reading user Notebook documents or contacting external services.

const cheerio = require("cheerio");

function wordCount(text = "") {
  return (String(text).match(/[A-Za-z0-9]+(?:[-'][A-Za-z0-9]+)?/g) || []).length;
}

function isCheerioBlankBlock($, node) {
  const tag = String(node.prop("tagName") || "").toLowerCase();
  if (!["div", "p"].includes(tag)) return false;
  const children = node.contents().toArray().filter((child) => {
    if (child.type === "text") return /\S/.test(child.data || "");
    return true;
  });
  if (!children.length) return true;
  return children.length === 1 && children[0].type === "tag" && String(children[0].name || "").toLowerCase() === "br";
}

function structuralMetrics(html) {
  const $ = cheerio.load(html, { decodeEntities: false });
  const body = $("body");
  const htmlBytes = Buffer.byteLength(html, "utf8");
  const bodyText = body.text();
  const metrics = {
    wordCount: wordCount(bodyText),
    characterCount: bodyText.length,
    htmlBytes,
    totalDomNodes: 0,
    elementNodes: 0,
    textNodes: 0,
    attributeCount: 0,
    topLevelEditableChildren: body.contents().filter((_, el) => el.type === "tag" || (el.type === "text" && /\S/.test(el.data || ""))).length,
    paragraphCount: $("p").length,
    divCount: $("div").length,
    spanCount: $("span").length,
    brCount: $("br").length,
    emptyDivCount: 0,
    divBrCount: 0,
    divClassBrCount: 0,
    consecutiveEmptyBlockRunCount: 0,
    longestEmptyBlockRun: 0,
    linkCount: $("a").length,
    headingCount: $("h1,h2,h3,h4,h5,h6").length,
    maximumDomDepth: 0,
    emptyBlockCategories: { divBr: 0, divClassBr: 0, pBr: 0, emptyDivNoBr: 0, emptyPNoBr: 0, otherVisuallyEmptyBlock: 0 },
  };

  function visit(node, depth) {
    if (!node) return;
    metrics.totalDomNodes += 1;
    metrics.maximumDomDepth = Math.max(metrics.maximumDomDepth, depth);
    if (node.type === "tag" || node.type === "script" || node.type === "style") {
      metrics.elementNodes += 1;
      metrics.attributeCount += Object.keys(node.attribs || {}).length;
      for (const child of node.children || []) visit(child, depth + 1);
    } else if (node.type === "text") {
      metrics.textNodes += 1;
    }
  }
  for (const child of body.toArray()) visit(child, 1);

  $("div,p").each((_, el) => {
    const node = $(el);
    if (!isCheerioBlankBlock($, node)) return;
    const tag = String(node.prop("tagName") || "").toLowerCase();
    const classValue = node.attr("class");
    const significantChildren = node.contents().toArray().filter((child) => child.type !== "text" || /\S/.test(child.data || ""));
    const onlyBr = significantChildren.length === 1 && significantChildren[0].type === "tag" && String(significantChildren[0].name || "").toLowerCase() === "br";
    if (tag === "div") metrics.emptyDivCount += 1;
    if (tag === "div" && onlyBr) {
      metrics.divBrCount += 1;
      metrics.emptyBlockCategories.divBr += 1;
      if (classValue === "") {
        metrics.divClassBrCount += 1;
        metrics.emptyBlockCategories.divClassBr += 1;
      }
    } else if (tag === "p" && onlyBr) metrics.emptyBlockCategories.pBr += 1;
    else if (tag === "div") metrics.emptyBlockCategories.emptyDivNoBr += 1;
    else if (tag === "p") metrics.emptyBlockCategories.emptyPNoBr += 1;
    else metrics.emptyBlockCategories.otherVisuallyEmptyBlock += 1;
  });

  let currentRun = 0;
  body.children().each((_, el) => {
    if (isCheerioBlankBlock($, $(el))) {
      currentRun += 1;
      metrics.longestEmptyBlockRun = Math.max(metrics.longestEmptyBlockRun, currentRun);
    } else {
      if (currentRun > 0) metrics.consecutiveEmptyBlockRunCount += 1;
      currentRun = 0;
    }
  });
  if (currentRun > 0) metrics.consecutiveEmptyBlockRunCount += 1;
  return metrics;
}

function inlineFragmentationMetrics(html) {
  const $ = cheerio.load(html, { decodeEntities: false });
  const bodyText = $("body").text();
  const words = Math.max(1, wordCount(bodyText));
  const metrics = {
    wordCount: words,
    inlineElementCount: 0,
    inlineElementsPer1000Words: 0,
    spanCount: $("span").length,
    adjacentMergeableSpans: 0,
    nestedRedundantSpans: 0,
    emptySpans: 0,
    spansWrappingOnlyOneTextNode: 0,
    veryShortInlineWrappers: 0,
    shortInlineWrapperMaxChars: 10,
    styledInlineElements: 0,
    links: $("a").length,
  };
  const inlineTags = new Set(["span", "b", "strong", "i", "em", "u", "s", "strike", "font", "a", "small", "mark", "code", "sup", "sub"]);
  function signature(node) {
    const tag = String(node.prop("tagName") || "").toLowerCase();
    if (tag !== "span") return "";
    const attrs = { ...(node.attr() || {}) };
    delete attrs.id;
    return JSON.stringify(Object.keys(attrs).sort().map((key) => [key, attrs[key]]));
  }
  $(Array.from(inlineTags).join(",")).each((_, el) => {
    const node = $(el);
    metrics.inlineElementCount += 1;
    if (node.attr("style")) metrics.styledInlineElements += 1;
    const text = node.text() || "";
    if (text.length > 0 && text.length <= metrics.shortInlineWrapperMaxChars) metrics.veryShortInlineWrappers += 1;
  });
  $("span").each((_, el) => {
    const node = $(el);
    if (!node.text().trim() && node.children().length === 0) metrics.emptySpans += 1;
    const contents = node.contents().toArray().filter((child) => child.type !== "text" || child.data.length > 0);
    if (contents.length === 1 && contents[0].type === "text") metrics.spansWrappingOnlyOneTextNode += 1;
    const childSpan = node.children("span");
    const meaningfulChildren = node.contents().toArray().filter((child) => child.type !== "text" || /\S/.test(child.data || ""));
    if (childSpan.length === 1 && meaningfulChildren.length === 1 && signature(node) === signature(childSpan.eq(0))) metrics.nestedRedundantSpans += 1;
    const next = node.next();
    if (next.length && String(next.prop("tagName") || "").toLowerCase() === "span" && signature(node) === signature(next)) metrics.adjacentMergeableSpans += 1;
  });
  metrics.inlineElementsPer1000Words = Math.round((metrics.inlineElementCount / words) * 10000) / 10;
  return metrics;
}

module.exports = { inlineFragmentationMetrics, isCheerioBlankBlock, structuralMetrics, wordCount };
