// Nodevision/ApplicationSystem/routes/api/extractEdges/extractHtmlEdges.test.mjs
// Integration smoke test for HTML Graph edge extraction from portable Notebook-relative refs.

import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { extractEdgesForFile } from "./extractHtmlEdges.js";

const notebookDir = await fs.mkdtemp(path.join(os.tmpdir(), "nodevision-html-edges-"));

async function writeNotebookFile(relativePath, content = "") {
  const fullPath = path.join(notebookDir, relativePath);
  await fs.mkdir(path.dirname(fullPath), { recursive: true });
  await fs.writeFile(fullPath, content, "utf8");
}

try {
  await writeNotebookFile("Notes/Topic/Page.html", `<!doctype html>
    <a href="../../Books/Example.html#section-two">Example</a>
    <img src="../../Media/Images/Test%20Image.png?cache=1" data-nodevision-fallback-1="../../Media/Images/Test%20Fallback.png">
    <span class="nodevision-image-text" data-nodevision-image-text="true" data-nodevision-image-src="../../Media/Images/Initial.png">A</span>
    <source srcset="../../Media/Images/Small.png 1x, ../../Media/Images/Large.png 2x">
    <div class="nodevision-circuit-reference" data-nodevision-circuit-src="../../Electronics/Circuits/Test.cir"><canvas></canvas></div>
    <map name="diagram-map"><area shape="rect" coords="0,0,20,20" href="../../Books/ImageMapTarget.html"></map>
    <a href="https://example.com/">External</a>
    <a href="mailto:someone@example.com">Mail</a>
    <img src="data:image/png;base64,AAAA">
    <a href="#local-anchor">Local</a>
  `);
  await writeNotebookFile("Books/Example.html", "Example");
  await writeNotebookFile("Books/ImageMapTarget.html", "Image map target");
  await writeNotebookFile("Media/Images/Test Image.png", "image");
  await writeNotebookFile("Media/Images/Test Fallback.png", "fallback image");
  await writeNotebookFile("Media/Images/Initial.png", "initial");
  await writeNotebookFile("Media/Images/Small.png", "small");
  await writeNotebookFile("Media/Images/Large.png", "large");
  await writeNotebookFile("Electronics/Circuits/Test.cir", "* test\n.END\n");

  const edges = await extractEdgesForFile({
    filePath: "Notes/Topic/Page.html",
    notebookDir,
  });

  assert.deepEqual([...edges].sort(), [
    "Books/Example.html",
    "Books/ImageMapTarget.html",
    "Electronics/Circuits/Test.cir",
    "Media/Images/Initial.png",
    "Media/Images/Large.png",
    "Media/Images/Small.png",
    "Media/Images/Test Fallback.png",
    "Media/Images/Test Image.png",
  ].sort());

  console.log("ok - extractEdgesForFile resolves source-relative Notebook references");
} finally {
  await fs.rm(notebookDir, { recursive: true, force: true });
}
