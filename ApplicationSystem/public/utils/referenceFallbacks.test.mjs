// Nodevision/ApplicationSystem/public/utils/referenceFallbacks.test.mjs
// Focused tests for ordered fallback reference serialization and parsing.

import assert from "node:assert/strict";
import {
  applyFallbackReferencesToElement,
  normalizeFallbackReferences,
  normalizeFallbackReferencesForSource,
  parseFallbackAttributesFromTagSource,
  readFallbackReferencesFromElement,
  referenceCandidates,
  replaceFallbackAttributesInHtmlTag,
  serializeFallbackAttributes,
} from "./referenceFallbacks.mjs";

class FakeElement {
  constructor() {
    this.map = new Map();
  }
  get attributes() {
    return [...this.map.entries()].map(([name, value]) => ({ name, value }));
  }
  getAttribute(name) {
    return this.map.get(name) ?? null;
  }
  setAttribute(name, value) {
    this.map.set(String(name), String(value));
  }
  removeAttribute(name) {
    this.map.delete(name);
  }
}

assert.deepEqual(referenceCandidates("Primary.html", []), ["Primary.html"]);
assert.deepEqual(
  referenceCandidates("Primary.html", ["Fallback.html", "Fallback.html", "", "https://example.test/book?q=1#frag"]),
  ["Primary.html", "Fallback.html", "https://example.test/book?q=1#frag"],
);

assert.deepEqual(
  normalizeFallbackReferences(["", "A.html", "javascript:alert(1)", "file:///tmp/nope", "A.html", "B.html"], { primary: "Primary.html" }),
  ["A.html", "B.html"],
);

assert.equal(
  serializeFallbackAttributes(["A&B.html", "Unicode-π.html"], { primary: "Primary.html" }),
  ' data-nodevision-fallback-1="A&amp;B.html" data-nodevision-fallback-2="Unicode-π.html"',
);

const tag = '<a href="Primary.html" data-nodevision-fallback-2="Second.html" data-nodevision-fallback-1="First &amp; Fine.html">Book</a>';
assert.deepEqual(
  parseFallbackAttributesFromTagSource(tag, 10).map((item) => item.rawTarget),
  ["First & Fine.html", "Second.html"],
);

assert.equal(
  replaceFallbackAttributesInHtmlTag(
    '<img src="Primary.png" data-nodevision-fallback-1="Old.png" alt="x">',
    ["Next.png"],
    { primary: "Primary.png" },
  ),
  '<img src="Primary.png" alt="x" data-nodevision-fallback-1="Next.png">',
);

assert.deepEqual(
  normalizeFallbackReferencesForSource(["Notebook/Library/Scans/Odyssey.pdf", "https://archive.org/details/odyssey"], {
    sourcePath: "Notebook/Library/Books/Homer/index.html",
    primary: "Notebook/Library/Books/Homer/Odyssey.html",
  }),
  ["../Scans/Odyssey.pdf", "https://archive.org/details/odyssey"],
);

const element = new FakeElement();
applyFallbackReferencesToElement(element, ["First.html", "Second.html"], { primary: "Primary.html" });
assert.deepEqual(readFallbackReferencesFromElement(element), ["First.html", "Second.html"]);
applyFallbackReferencesToElement(element, ["Second.html"], { primary: "Primary.html" });
assert.deepEqual(element.attributes.map((attr) => attr.name), ["data-nodevision-fallback-1"]);
assert.deepEqual(readFallbackReferencesFromElement(element), ["Second.html"]);

console.log("ok - ordered fallback references serialize, parse, normalize, and update");
