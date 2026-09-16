// Nodevision/ApplicationSystem/public/Graph/LinkExtractor.fallbacks.test.mjs
// Verifies the older Graph link extractor emits ordered fallback edges from HTML attributes.

import assert from "node:assert/strict";
import { writeFile, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { extractLinksFromFile } from "./LinkExtractor.mjs";

const dir = await mkdtemp(path.join(tmpdir(), "nv-link-extractor-"));
const file = path.join(dir, "page.html");
await writeFile(file, `<a href = "../Library/A.html" data-nodevision-fallback-1 = "../Archive/A.html">A</a>`, "utf8");
const edges = await extractLinksFromFile(file, "Notes/Page.html");

assert.deepEqual(edges.map((edge) => edge.destination), ["Library/A.html", "Archive/A.html"]);
assert.deepEqual(edges.map((edge) => edge.referenceRole), ["primary", "fallback"]);
assert.equal(edges[1].fallbackPriority, 1);

console.log("ok - Graph LinkExtractor emits fallback edge metadata");
