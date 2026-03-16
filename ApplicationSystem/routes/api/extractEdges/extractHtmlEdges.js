// Nodevision/ApplicationSystem/routes/api/extractEdges/extractHtmlEdges.js
// This file extracts intra-notebook edge targets from HTML-like files so that link graphs can be derived from markup and persisted by API routes.

import fs from "node:fs/promises";
import path from "node:path";
import * as cheerio from "cheerio";

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

function isExternalUrl(url) {
  return url.startsWith("http://") ||
    url.startsWith("https://") ||
    url.startsWith("//") ||
    url.startsWith("mailto:") ||
    url.startsWith("javascript:") ||
    url.startsWith("#") ||
    url.startsWith("data:");
}

function normalizeLink(link) {
  if (!link) return null;
  let normalized = String(link).trim();
  if (!normalized) return null;
  if (isExternalUrl(normalized)) return null;

  if (normalized.startsWith("/")) normalized = normalized.slice(1);
  if (normalized.startsWith("Notebook/")) normalized = normalized.slice("Notebook/".length);

  const hashIdx = normalized.indexOf("#");
  if (hashIdx > 0) normalized = normalized.slice(0, hashIdx);

  const queryIdx = normalized.indexOf("?");
  if (queryIdx > 0) normalized = normalized.slice(0, queryIdx);

  return normalized || null;
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
        for (const src of srcsetParts) {
          const normalized = normalizeLink(src);
          if (normalized) edgesSet.add(normalized);
        }
        return;
      }

      const normalized = normalizeLink(value);
      if (normalized) edgesSet.add(normalized);
    });
  }
  return edgesSet;
}

async function resolveExistingEdges({ filePath, fileDir, notebookDir, edgesSet }) {
  const edges = [];

  for (const link of edgesSet) {
    const candidatePaths = [
      path.resolve(fileDir, link),
      path.resolve(notebookDir, link),
    ];

    for (const targetPath of candidatePaths) {
      if (!targetPath.startsWith(notebookDir)) continue;
      try {
        await fs.access(targetPath);
        const relative = path.relative(notebookDir, targetPath).split(path.sep).join("/");
        if (relative !== filePath && !edges.includes(relative)) edges.push(relative);
        break;
      } catch {
        // try next candidate
      }
    }
  }

  return edges;
}

export async function extractEdgesForFile({ filePath, notebookDir }) {
  const fullPath = path.join(notebookDir, filePath);
  const fileDir = path.dirname(fullPath);

  const content = await fs.readFile(fullPath, "utf8");
  const $ = cheerio.load(content);
  const edgesSet = collectCandidateLinks($);

  return resolveExistingEdges({ filePath, fileDir, notebookDir, edgesSet });
}

export async function extractEdgesBatch({ files, notebookDir }) {
  const results = {};

  for (const filePath of files) {
    const fullPath = path.join(notebookDir, filePath);

    try {
      const stat = await fs.stat(fullPath);
      if (stat.isDirectory()) continue;

      const ext = path.extname(filePath).toLowerCase();
      if (![".html", ".htm", ".php", ".xhtml"].includes(ext)) continue;

      const edges = await extractEdgesForFile({ filePath, notebookDir });
      if (edges.length > 0) results[filePath] = edges;
    } catch {
      // ignore missing/invalid files
    }
  }

  return results;
}

