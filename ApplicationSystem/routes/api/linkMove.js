// Nodevision/ApplicationSystem/routes/api/linkMove.js
// Link-aware move helpers for the File Manager + Graph Manager.

import express from "express";
import fs from "node:fs/promises";
import path from "node:path";
import { createServerContext } from "../../shared/serverContext.mjs";

const BASE_CONTEXT = createServerContext();

function normalizeNotebookRelativePath(inputPath) {
  if (!inputPath) return "";
  return String(inputPath)
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
    .replace(/^Notebook\//i, "")
    .replace(/\/+/g, "/")
    .trim();
}

function sanitizeNotebookPath(inputPath) {
  const cleaned = normalizeNotebookRelativePath(inputPath);
  return normalizeNotebookRelativeParts(cleaned);
}

function isExternalOrAnchorLink(link) {
  const value = String(link || "").trim();
  return (
    value.startsWith("http://") ||
    value.startsWith("https://") ||
    value.startsWith("//") ||
    value.startsWith("mailto:") ||
    value.startsWith("javascript:") ||
    value.startsWith("data:") ||
    value.startsWith("#")
  );
}

function splitLinkSuffix(rawLink) {
  const value = String(rawLink ?? "");
  const hashIndex = value.indexOf("#");
  const queryIndex = value.indexOf("?");
  const indices = [hashIndex, queryIndex].filter((idx) => idx >= 0);
  if (indices.length === 0) return { pathPart: value, suffix: "" };
  const cut = Math.min(...indices);
  return { pathPart: value.slice(0, cut), suffix: value.slice(cut) };
}

function normalizeNotebookRelativeParts(value) {
  const parts = [];
  for (const part of String(value || "").split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") {
      if (parts.length === 0) return null;
      parts.pop();
      continue;
    }
    parts.push(part);
  }
  return parts.join("/");
}

function resolveNotebookLink(sourceFilePath, rawLink) {
  if (typeof rawLink !== "string") return null;
  const trimmed = rawLink.trim();
  if (!trimmed || isExternalOrAnchorLink(trimmed)) return null;

  const { pathPart } = splitLinkSuffix(trimmed);
  let link = String(pathPart).trim();
  if (!link) return null;

  const source = normalizeNotebookRelativePath(sourceFilePath);
  const sourceDir = source.includes("/") ? source.slice(0, source.lastIndexOf("/")) : "";

  const isRootRelative = trimmed.startsWith("/") || trimmed.startsWith("Notebook/");
  let candidate = link.replace(/^\/+/, "");

  if (candidate.startsWith("Notebook/")) {
    candidate = candidate.slice("Notebook/".length);
  } else if (!isRootRelative && sourceDir) {
    candidate = `${sourceDir}/${candidate}`;
  }

  return normalizeNotebookRelativeParts(candidate);
}

function guessExtension(filePath) {
  const ext = path.extname(String(filePath || "")).toLowerCase();
  if (ext === ".md" || ext === ".markdown") return "md";
  if (ext === ".html" || ext === ".htm" || ext === ".xhtml" || ext === ".php") return "html";
  return null;
}

function collectLinkSpans(content, kind) {
  const spans = [];
  const text = String(content ?? "");

  if (kind === "md") {
    const mdRegex = /(!?\[[^\]]*?\])\(([^)]+)\)/g;
    let match;
    while ((match = mdRegex.exec(text))) {
      const label = match[1] || "";
      const raw = match[2] || "";
      const start = match.index + label.length + 1;
      spans.push({
        start,
        end: start + raw.length,
        raw,
      });
    }
  }

  if (kind === "html") {
    const attrRegex = /\b(?:href|src|data-src)\s*=\s*(["'])(.*?)\1/gi;
    let match;
    while ((match = attrRegex.exec(text))) {
      const full = match[0] || "";
      const raw = match[2] || "";
      const inMatchIndex = full.indexOf(raw);
      if (inMatchIndex < 0) continue;
      const start = match.index + inMatchIndex;
      spans.push({
        start,
        end: start + raw.length,
        raw,
      });
    }
  }

  return spans;
}

function applySpanReplacements(content, replacements) {
  if (!replacements.length) return content;
  const sorted = [...replacements].sort((a, b) => b.start - a.start);
  let output = String(content ?? "");
  for (const rep of sorted) {
    output = output.slice(0, rep.start) + rep.value + output.slice(rep.end);
  }
  return output;
}

function posixDirname(relPath) {
  const normalized = normalizeNotebookRelativePath(relPath);
  if (!normalized.includes("/")) return "";
  return normalized.slice(0, normalized.lastIndexOf("/"));
}

function makeRelativeLink(fromFilePath, targetPath) {
  const fromDir = posixDirname(fromFilePath);
  if (!fromDir) return normalizeNotebookRelativePath(targetPath);
  const rel = path.posix.relative(fromDir, normalizeNotebookRelativePath(targetPath));
  return rel || ".";
}

function computeBucketChar(fileName) {
  const first = String(fileName || "").trim().charAt(0);
  if (!first) return "#";
  // Must match /api/graph/save-edges bucketing: it uses the first character as-is.
  // (Do not force uppercase; lowercase buckets like "a.json" are valid.)
  if (/^[A-Za-z0-9]$/.test(first)) return first;
  return "#";
}

function computeBucketCharsToCheck(fileName) {
  const ch = computeBucketChar(fileName);
  if (ch === "#") return ["#"];
  const lower = ch.toLowerCase();
  const upper = ch.toUpperCase();
  return [...new Set([ch, lower, upper])];
}

function edgeKey(edge) {
  return `${edge?.source || ""}→${edge?.target || ""}`;
}

async function readJsonArray(filePath) {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    const trimmed = raw.trim();
    if (!trimmed) return [];
    const parsed = JSON.parse(trimmed);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    if (err?.code === "ENOENT") return [];
    throw err;
  }
}

async function listEdgeBucketFiles(edgesDir) {
  try {
    return (await fs.readdir(edgesDir)).filter((name) => name.endsWith(".json"));
  } catch {
    return [];
  }
}

async function findIncomingSourcesInBuckets({ edgesDir, oldPath, bucketChars }) {
  const sourceSet = new Set();
  const buckets = Array.isArray(bucketChars) ? bucketChars : [];
  for (const bucketChar of buckets) {
    const bucketFile = path.join(edgesDir, `${bucketChar}.json`);
    const edges = await readJsonArray(bucketFile);
    for (const edge of edges) {
      if (edge?.target === oldPath && typeof edge?.source === "string") {
        sourceSet.add(edge.source);
      }
    }
  }
  return [...sourceSet];
}

async function findIncomingSourcesAllBuckets({ edgesDir, oldPath }) {
  const files = await listEdgeBucketFiles(edgesDir);
  const sourceSet = new Set();
  for (const name of files) {
    const full = path.join(edgesDir, name);
    const edges = await readJsonArray(full);
    for (const edge of edges) {
      if (edge?.target === oldPath && typeof edge?.source === "string") {
        sourceSet.add(edge.source);
      }
    }
  }
  return [...sourceSet];
}

async function writeJsonArray(filePath, data) {
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });
  const tmp = `${filePath}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(data, null, 2), "utf8");
  await fs.rename(tmp, filePath);
}

async function fileExists(fullPath) {
  try {
    await fs.access(fullPath);
    return true;
  } catch {
    return false;
  }
}

export default function createLinkMoveRouter(ctx = BASE_CONTEXT) {
  const router = express.Router();
  const notebookDir = ctx.notebookDir;
  const edgesDir = path.join(ctx.sharedDataDir, "edges");

  router.post("/linkMove/analyze", async (req, res) => {
    const oldPath = sanitizeNotebookPath(req.body?.oldPath);
    const newPath = sanitizeNotebookPath(req.body?.newPath);
    if (!oldPath || !newPath) {
      return res.status(400).json({ error: "oldPath and newPath are required." });
    }

    const newFullPath = path.join(notebookDir, newPath);
    let stat = null;
    try {
      stat = await fs.stat(newFullPath);
    } catch (err) {
      return res.status(404).json({ error: `File not found at newPath: ${newPath}` });
    }

    if (!stat.isFile()) {
      return res.json({
        oldPath,
        newPath,
        isFile: false,
        isDirectory: stat.isDirectory(),
        outgoing: { count: 0, supported: false },
        incoming: { count: 0, sources: [] },
      });
    }

    const extKind = guessExtension(newPath);
    let outgoingTargets = [];
    let outgoingSupported = Boolean(extKind);

    if (extKind) {
      try {
        const content = await fs.readFile(newFullPath, "utf8");
        const spans = collectLinkSpans(content, extKind);
        const uniqueTargets = new Set();
        for (const span of spans) {
          const resolved = resolveNotebookLink(oldPath, span.raw);
          if (!resolved) continue;
          const exists = await fileExists(path.join(notebookDir, resolved));
          if (!exists) continue;
          uniqueTargets.add(resolved);
        }
        outgoingTargets = [...uniqueTargets];
      } catch (err) {
        outgoingSupported = false;
      }
    }

    let incomingSources = [];
    try {
      const oldBase = path.posix.basename(oldPath);
      const buckets = computeBucketCharsToCheck(oldBase);
      incomingSources = await findIncomingSourcesInBuckets({ edgesDir, oldPath, bucketChars: buckets });
      if (incomingSources.length === 0) {
        incomingSources = await findIncomingSourcesAllBuckets({ edgesDir, oldPath });
      }
    } catch (err) {
      console.warn("[linkMove/analyze] Failed reading edge bucket:", err);
    }

    res.json({
      oldPath,
      newPath,
      isFile: true,
      outgoing: {
        supported: outgoingSupported,
        count: outgoingTargets.length,
        targetsPreview: outgoingTargets.slice(0, 8),
      },
      incoming: {
        count: incomingSources.length,
        sourcesPreview: incomingSources.slice(0, 8),
      },
    });
  });

  router.post("/linkMove/update", async (req, res) => {
    const oldPath = sanitizeNotebookPath(req.body?.oldPath);
    const newPath = sanitizeNotebookPath(req.body?.newPath);
    const updateOutgoing = req.body?.updateOutgoing !== false;
    const updateIncoming = req.body?.updateIncoming !== false;
    const updateGraph = req.body?.updateGraph !== false;

    if (!oldPath || !newPath) {
      return res.status(400).json({ error: "oldPath and newPath are required." });
    }

    const newFullPath = path.join(notebookDir, newPath);
    let stat = null;
    try {
      stat = await fs.stat(newFullPath);
    } catch (err) {
      return res.status(404).json({ error: `File not found at newPath: ${newPath}` });
    }

    if (!stat.isFile()) {
      return res.status(400).json({ error: "Only file moves are supported (not directories)." });
    }

    const result = {
      success: true,
      oldPath,
      newPath,
      updatedFiles: [],
      outgoing: { changed: false, replacements: 0 },
      incoming: { filesChanged: 0, replacements: 0 },
      graph: { bucketsTouched: 0, edgesMoved: 0, edgesUpdated: 0 },
    };

    // --- Outgoing: update links inside the moved file so they still resolve to the same targets ---
    if (updateOutgoing) {
      const kind = guessExtension(newPath);
      if (kind) {
        const before = await fs.readFile(newFullPath, "utf8");
        const spans = collectLinkSpans(before, kind);
        const replacements = [];
        let replacementCount = 0;

        for (const span of spans) {
          const raw = span.raw;
          if (!raw || isExternalOrAnchorLink(raw)) continue;

          const { pathPart, suffix } = splitLinkSuffix(raw);
          const targetOld = resolveNotebookLink(oldPath, pathPart);
          if (!targetOld) continue;
          const exists = await fileExists(path.join(notebookDir, targetOld));
          if (!exists) continue;

          const targetNewInterpretation = resolveNotebookLink(newPath, pathPart);
          if (targetNewInterpretation === targetOld) continue;

          const newRel = makeRelativeLink(newPath, targetOld);
          const replacement = `${newRel}${suffix}`;

          if (replacement !== raw) {
            replacements.push({ start: span.start, end: span.end, value: replacement });
            replacementCount += 1;
          }
        }

        const after = applySpanReplacements(before, replacements);
        if (after !== before) {
          await fs.writeFile(newFullPath, after, "utf8");
          result.outgoing.changed = true;
          result.outgoing.replacements = replacementCount;
          result.updatedFiles.push(newPath);
        }
      }
    }

    // --- Incoming: update links in other files that point to oldPath ---
    let incomingSources = [];
    if (updateIncoming) {
      const sourceSet = new Set();

      const oldBase = path.posix.basename(oldPath);
      const buckets = computeBucketCharsToCheck(oldBase);
      const fromBuckets = await findIncomingSourcesInBuckets({ edgesDir, oldPath, bucketChars: buckets });
      for (const source of fromBuckets) sourceSet.add(source);
      if (sourceSet.size === 0) {
        const fromAll = await findIncomingSourcesAllBuckets({ edgesDir, oldPath });
        for (const source of fromAll) sourceSet.add(source);
      }
      incomingSources = [...sourceSet];

      for (const sourcePath of incomingSources) {
        const sourceKind = guessExtension(sourcePath);
        if (!sourceKind) continue;
        const full = path.join(notebookDir, sourcePath);
        const exists = await fileExists(full);
        if (!exists) continue;

        const before = await fs.readFile(full, "utf8");
        const spans = collectLinkSpans(before, sourceKind);
        const replacements = [];
        let replacementCount = 0;

        for (const span of spans) {
          const raw = span.raw;
          if (!raw || isExternalOrAnchorLink(raw)) continue;
          const { pathPart, suffix } = splitLinkSuffix(raw);
          const resolved = resolveNotebookLink(sourcePath, pathPart);
          if (resolved !== oldPath) continue;

          const newRel = makeRelativeLink(sourcePath, newPath);
          const replacement = `${newRel}${suffix}`;
          if (replacement !== raw) {
            replacements.push({ start: span.start, end: span.end, value: replacement });
            replacementCount += 1;
          }
        }

        const after = applySpanReplacements(before, replacements);
        if (after !== before) {
          await fs.writeFile(full, after, "utf8");
          result.incoming.filesChanged += 1;
          result.incoming.replacements += replacementCount;
          result.updatedFiles.push(sourcePath);
        }
      }
    }

    // --- Graph: update shared edge shards so GraphManagerCore stays consistent ---
    if (updateGraph) {
      let bucketFiles = [];
      try {
        bucketFiles = (await fs.readdir(edgesDir)).filter((name) => name.endsWith(".json"));
      } catch {
        bucketFiles = [];
      }

      const movedEdgesByBucket = new Map(); // bucketChar -> edges[]
      let bucketsTouched = 0;
      let edgesMoved = 0;
      let edgesUpdated = 0;

      for (const name of bucketFiles) {
        const full = path.join(edgesDir, name);
        const edges = await readJsonArray(full);
        if (!edges.length) continue;

        let changed = false;
        const kept = [];
        for (const edge of edges) {
          if (!edge || typeof edge !== "object") continue;
          let source = edge.source;
          let target = edge.target;
          let updated = false;

          if (source === oldPath) {
            source = newPath;
            updated = true;
          }

          if (target === oldPath) {
            target = newPath;
            updated = true;
            const bucketChar = computeBucketChar(path.posix.basename(newPath));
            const movedEdge = { ...edge, source, target };
            const list = movedEdgesByBucket.get(bucketChar) || [];
            list.push(movedEdge);
            movedEdgesByBucket.set(bucketChar, list);
            edgesMoved += 1;
            changed = true;
            continue;
          }

          if (updated) {
            edgesUpdated += 1;
            kept.push({ ...edge, source, target });
            changed = true;
          } else {
            kept.push(edge);
          }
        }

        if (changed) {
          bucketsTouched += 1;
          // Dedupe
          const seen = new Set();
          const deduped = [];
          for (const edge of kept) {
            const key = edgeKey(edge);
            if (!edge?.source || !edge?.target) continue;
            if (seen.has(key)) continue;
            seen.add(key);
            deduped.push(edge);
          }
          await writeJsonArray(full, deduped);
        }
      }

      for (const [bucketChar, movedEdges] of movedEdgesByBucket.entries()) {
        const targetFile = path.join(edgesDir, `${bucketChar}.json`);
        const existing = await readJsonArray(targetFile);
        const combined = [...existing, ...movedEdges];
        const seen = new Set();
        const deduped = [];
        for (const edge of combined) {
          if (!edge?.source || !edge?.target) continue;
          const key = edgeKey(edge);
          if (seen.has(key)) continue;
          seen.add(key);
          deduped.push(edge);
        }
        await writeJsonArray(targetFile, deduped);
        bucketsTouched += 1;
      }

      result.graph.bucketsTouched = bucketsTouched;
      result.graph.edgesMoved = edgesMoved;
      result.graph.edgesUpdated = edgesUpdated;
    }

    res.json(result);
  });

  return router;
}
