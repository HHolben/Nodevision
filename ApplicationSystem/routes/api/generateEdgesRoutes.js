// Nodevision/ApplicationSystem/routes/api/generateEdgesRoutes.js
// Edge generation helpers for older Graph workflows.

import express from "express";
import fs from "node:fs/promises";
import path from "node:path";
import * as cheerio from "cheerio";
import { createServerContext } from "../../shared/serverContext.mjs";
import {
  normalizeNotebookRelativePath,
  resolveNotebookReference,
} from "../../public/utils/notebookPath.mjs";

const BASE_CONTEXT = createServerContext();

async function getAllFiles(dir) {
  let files = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const subFiles = await getAllFiles(fullPath);
      files = files.concat(subFiles);
    } else {
      files.push(fullPath);
    }
  }
  return files;
}

function extractHyperlinksFromContent(content) {
  const $ = cheerio.load(content);
  const links = [];
  const attrs = [
    ["a, area, link", "href"],
    ["img, script, iframe, audio, video, source, embed", "src"],
    ["object", "data"],
    ["form", "action"],
    ["[data-src]", "data-src"],
    ["[data-nodevision-image-src]", "data-nodevision-image-src"],
    ["[data-nodevision-citation-source]", "data-nodevision-citation-source"],
    ["[data-nodevision-font-src]", "data-nodevision-font-src"],
    ["[data-nodevision-font-stylesheet]", "data-nodevision-font-stylesheet"],
    ["[data-nodevision-circuit-src]", "data-nodevision-circuit-src"],
  ];
  for (const [selector, attr] of attrs) {
    $(selector).each((i, el) => {
      const value = $(el).attr(attr);
      if (value) links.push(value);
    });
  }
  $("*").each((i, el) => {
    for (const [name, value] of Object.entries(el?.attribs || {})) {
      if (/^data-nodevision-fallback-\d+$/i.test(name) && value) links.push(value);
    }
  });
  return links;
}

function isWithinNotebook(targetPath, notebookDir) {
  const relative = path.relative(notebookDir, targetPath);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

export default function createGenerateEdgesRouter(ctx = BASE_CONTEXT) {
  const router = express.Router();
  const notebookDir = ctx.notebookDir;

  async function generateEdges() {
    console.log("Generating edges...");
    const allFiles = await getAllFiles(notebookDir);
    console.log("Found files:", allFiles);
    const edges = [];

    for (const filePath of allFiles) {
      try {
        const content = await fs.readFile(filePath, "utf8");
        const links = extractHyperlinksFromContent(content);
        console.log(`File: ${filePath}`);
        console.log("Extracted links:", links);

        const relativeSource = normalizeNotebookRelativePath(path.relative(notebookDir, filePath));

        for (const link of links) {
          const relativeTarget = resolveNotebookReference({ sourcePath: relativeSource, reference: link });
          if (!relativeTarget || relativeTarget === relativeSource) continue;

          const targetPath = path.resolve(notebookDir, relativeTarget);
          if (!isWithinNotebook(targetPath, notebookDir)) continue;

          try {
            await fs.access(targetPath);
            console.log(`Edge found: ${relativeSource} -> ${relativeTarget}`);
            edges.push({ source: relativeSource, target: relativeTarget });
          } catch {
            console.warn(`Target file ${targetPath} does not exist.`);
          }
        }
      } catch (err) {
        console.error(`Error processing file ${filePath}:`, err);
      }
    }

    console.log("Generated edges:", edges);
    return edges;
  }

  router.post("/generateEdges", async (req, res) => {
    try {
      const edges = await generateEdges();
      res.status(200).json({ message: "Edges generated successfully", edges });
    } catch (error) {
      console.error("Error generating edges:", error);
      res.status(500).send("Failed to generate edges");
    }
  });

  return router;
}
