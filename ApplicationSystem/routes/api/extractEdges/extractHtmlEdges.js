// Nodevision/ApplicationSystem/routes/api/extractEdges/extractHtmlEdges.js
// Extract HTML/PHP Notebook references into normalized Graph edge targets.

import fs from "node:fs/promises";
import path from "node:path";
import * as cheerio from "cheerio";
import {
  normalizeNotebookRelativePath,
  resolveNotebookReference,
} from "../../../public/utils/notebookPath.mjs";

const LINK_ATTRIBUTES = [
  { selector: "a", attr: "href" },
  { selector: "img", attr: "src" },
  { selector: "script", attr: "src" },
  { selector: "link", attr: "href" },
  { selector: "iframe", attr: "src" },
  { selector: "audio", attr: "src" },
  { selector: "video", attr: "src" },
  { selector: "source", attr: "src" },
  { selector: "embed", attr: "src" },
  { selector: "object", attr: "data" },
  { selector: "[data-src]", attr: "data-src" },
  { selector: "[srcset]", attr: "srcset" },
  { selector: "form", attr: "action" },
];

function addCandidate(edgesSet, value) {
  const trimmed = String(value || "").trim();
  if (trimmed) edgesSet.add(trimmed);
}

function collectCandidateLinks($) {
  const edgesSet = new Set();
  for (const { selector, attr } of LINK_ATTRIBUTES) {
    $(selector).each((i, el) => {
      const value = $(el).attr(attr);
      if (!value) return;

      if (attr === "srcset") {
        const srcsetParts = String(value)
          .split(",")
          .map((s) => s.trim().split(/\s+/)[0])
          .filter(Boolean);
        for (const src of srcsetParts) addCandidate(edgesSet, src);
        return;
      }

      addCandidate(edgesSet, value);
    });
  }
  return edgesSet;
}

function isWithinNotebook(targetPath, notebookDir) {
  const relative = path.relative(notebookDir, targetPath);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

async function resolveExistingEdges({ filePath, notebookDir, edgesSet }) {
  const edges = [];
  const sourcePath = normalizeNotebookRelativePath(filePath);

  for (const reference of edgesSet) {
    const relative = resolveNotebookReference({ sourcePath, reference });
    if (!relative || relative === sourcePath || edges.includes(relative)) continue;

    const targetPath = path.resolve(notebookDir, relative);
    if (!isWithinNotebook(targetPath, notebookDir)) continue;

    try {
      await fs.access(targetPath);
      edges.push(relative);
    } catch {
      // ignore missing targets; the Graph records existing Notebook files only here
    }
  }

  return edges;
}

export async function extractEdgesForFile({ filePath, notebookDir }) {
  const sourcePath = normalizeNotebookRelativePath(filePath);
  const fullPath = path.resolve(notebookDir, sourcePath);
  if (!isWithinNotebook(fullPath, notebookDir)) return [];

  const content = await fs.readFile(fullPath, "utf8");
  const $ = cheerio.load(content);
  const edgesSet = collectCandidateLinks($);

  return resolveExistingEdges({ filePath: sourcePath, notebookDir, edgesSet });
}

export async function extractEdgesBatch({ files, notebookDir }) {
  const results = {};

  for (const filePath of files) {
    const sourcePath = normalizeNotebookRelativePath(filePath);
    const fullPath = path.resolve(notebookDir, sourcePath);
    if (!sourcePath || !isWithinNotebook(fullPath, notebookDir)) continue;

    try {
      const stat = await fs.stat(fullPath);
      if (stat.isDirectory()) continue;

      const ext = path.extname(sourcePath).toLowerCase();
      if (![".html", ".htm", ".php", ".xhtml"].includes(ext)) continue;

      const edges = await extractEdgesForFile({ filePath: sourcePath, notebookDir });
      if (edges.length > 0) results[sourcePath] = edges;
    } catch {
      // ignore missing/invalid files
    }
  }

  return results;
}
