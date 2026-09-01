// Nodevision/ApplicationSystem/routes/api/linkMove.js
// Link-aware move helpers for the File Manager and Graph Manager.

import express from "express";
import fs from "node:fs/promises";
import path from "node:path";
import { createServerContext } from "../../shared/serverContext.mjs";
import {
  computeEdgeBucketChar,
  computeEdgeBucketCharsToCheck,
  readEdgeBucket,
  writeEdgeBucket,
} from "../../shared/graphEdgeBucketUtils.mjs";
import {
  getRelativeNotebookReference,
  isExternalNotebookReference,
  normalizeNotebookFilePath,
  resolveNotebookReference,
  splitNotebookReferenceSuffix,
} from "../../public/utils/notebookPath.mjs";

const BASE_CONTEXT = createServerContext();

function normalizeNotebookRelativePath(inputPath) {
  return normalizeNotebookFilePath(inputPath);
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

function sanitizeNotebookPath(inputPath) {
  const cleaned = normalizeNotebookRelativePath(inputPath);
  return normalizeNotebookRelativeParts(cleaned) || "";
}

function isExternalOrAnchorLink(link) {
  return isExternalNotebookReference(link);
}

function splitLinkSuffix(rawLink) {
  return splitNotebookReferenceSuffix(rawLink);
}

function resolveNotebookLink(sourceFilePath, rawLink) {
  return resolveNotebookReference({ sourcePath: sourceFilePath, reference: rawLink });
}

function guessExtension(filePath) {
  const ext = path.extname(String(filePath || "")).toLowerCase();
  if (ext === ".md" || ext === ".markdown") return "md";
  if (ext === ".html" || ext === ".htm" || ext === ".xhtml" || ext === ".php") return "html";
  return null;
}

function parseMarkdownDestination(raw = "") {
  const body = String(raw || "");
  const trimmedStart = body.search(/\S/);
  if (trimmedStart < 0) return null;

  const trimmed = body.slice(trimmedStart);
  if (trimmed.startsWith("<")) {
    const close = trimmed.indexOf(">", 1);
    if (close > 1) {
      return { target: trimmed.slice(1, close), offset: trimmedStart + 1 };
    }
  }

  const match = trimmed.match(/^\S+/);
  if (!match) return null;
  return { target: match[0], offset: trimmedStart };
}

function collectLinkSpans(content, kind) {
  const spans = [];
  const text = String(content ?? "");

  if (kind === "md") {
    const mdRegex = /(!?)\[([^\]\n]*)\]\(([^)\n]+)\)/g;
    let match;
    while ((match = mdRegex.exec(text))) {
      const bang = match[1] || "";
      const label = match[2] || "";
      const destination = parseMarkdownDestination(match[3] || "");
      if (!destination?.target) continue;
      const start = match.index + bang.length + 1 + label.length + 2 + destination.offset;
      spans.push({ start, end: start + destination.target.length, raw: destination.target });
    }
  }

  if (kind === "html") {
    const attrRegex = /\b(?:href|src|data-src|data-nodevision-font-src|data-nodevision-circuit-src)\s*=\s*(["\x27])(.*?)\1/gi;
    let match;
    while ((match = attrRegex.exec(text))) {
      const full = match[0] || "";
      const raw = match[2] || "";
      const inMatchIndex = full.indexOf(raw);
      if (inMatchIndex < 0) continue;
      const start = match.index + inMatchIndex;
      spans.push({ start, end: start + raw.length, raw });
    }

    const cssUrlRegex = /url\(\s*(?:"([^"]+)"|\x27([^\x27]+)\x27|([^\x27"\)]+))\s*\)/gi;
    while ((match = cssUrlRegex.exec(text))) {
      const raw = String(match[1] || match[2] || match[3] || "");
      const target = raw.trim();
      if (!target) continue;
      const inMatchIndex = match[0].indexOf(raw);
      if (inMatchIndex < 0) continue;
      const trimOffset = raw.indexOf(target);
      const start = match.index + inMatchIndex + Math.max(0, trimOffset);
      spans.push({ start, end: start + target.length, raw: target });
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

function makeRelativeLink(fromFilePath, targetPath) {
  return getRelativeNotebookReference({ sourcePath: fromFilePath, targetPath });
}

function getMovedPathInfo(candidatePath, oldRoot, newRoot) {
  const clean = sanitizeNotebookPath(candidatePath);
  const oldClean = sanitizeNotebookPath(oldRoot);
  const newClean = sanitizeNotebookPath(newRoot);

  if (!clean || !oldClean || !newClean) {
    return { clean, changed: false, path: clean };
  }

  if (clean === oldClean) {
    return { clean, changed: true, path: newClean };
  }

  if (clean.startsWith(`${oldClean}/`)) {
    return {
      clean,
      changed: true,
      path: `${newClean}/${clean.slice(oldClean.length + 1)}`,
    };
  }

  return { clean, changed: false, path: clean };
}

function remapCleanMovedPath(candidatePath, oldRoot, newRoot) {
  const info = getMovedPathInfo(candidatePath, oldRoot, newRoot);
  return info.changed ? info.path : info.clean;
}

function remapGraphPath(candidatePath, oldRoot, newRoot) {
  const info = getMovedPathInfo(candidatePath, oldRoot, newRoot);
  return info.changed ? info.path : candidatePath;
}

function recordUpdatedFile(result, filePath) {
  if (!filePath) return;
  if (!result.updatedFiles.includes(filePath)) {
    result.updatedFiles.push(filePath);
  }
}

async function fileExists(fullPath) {
  try {
    await fs.access(fullPath);
    return true;
  } catch {
    return false;
  }
}

async function listEdgeBucketFiles(edgesDir) {
  try {
    return (await fs.readdir(edgesDir))
      .filter((name) => name.endsWith(".json"))
      .sort((a, b) => a.localeCompare(b));
  } catch (err) {
    if (err?.code === "ENOENT") return [];
    throw err;
  }
}

async function listFilesUnderDirectory(fullDir, relativeDir) {
  const files = [];
  const entries = await fs.readdir(fullDir, { withFileTypes: true });
  entries.sort((a, b) => a.name.localeCompare(b.name));

  for (const entry of entries) {
    const childRelative = [relativeDir, entry.name].filter(Boolean).join("/");
    const childFull = path.join(fullDir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await listFilesUnderDirectory(childFull, childRelative));
    } else if (entry.isFile()) {
      const clean = sanitizeNotebookPath(childRelative);
      if (clean) files.push(clean);
    }
  }

  return files;
}

async function listMovedFilePaths({ notebookDir, newPath, stat }) {
  if (stat.isFile()) return [newPath];
  if (!stat.isDirectory()) return [];
  return listFilesUnderDirectory(path.join(notebookDir, newPath), newPath);
}

async function collectOutgoingTargetsForSources({ notebookDir, oldPath, newPath, sourcePaths }) {
  const targets = new Set();
  let supportedFiles = 0;
  let readFailures = 0;

  for (const sourcePath of sourcePaths) {
    const kind = guessExtension(sourcePath);
    if (!kind) continue;
    supportedFiles += 1;

    try {
      const before = await fs.readFile(path.join(notebookDir, sourcePath), "utf8");
      const oldSourcePath = remapCleanMovedPath(sourcePath, newPath, oldPath);
      for (const span of collectLinkSpans(before, kind)) {
        if (!span.raw || isExternalOrAnchorLink(span.raw)) continue;
        const { pathPart } = splitLinkSuffix(span.raw);
        const targetBeforeMove = resolveNotebookLink(oldSourcePath, pathPart);
        if (!targetBeforeMove) continue;
        const targetAfterMove = remapCleanMovedPath(targetBeforeMove, oldPath, newPath);
        if (await fileExists(path.join(notebookDir, targetAfterMove))) {
          targets.add(targetAfterMove);
        }
      }
    } catch {
      readFailures += 1;
    }
  }

  return {
    supported: supportedFiles > 0,
    supportedFiles,
    readFailures,
    targets: [...targets],
  };
}

async function collectIncomingSourcesFromBucket({ edgesDir, bucketName, oldPath, newPath, warnings }) {
  const sourceSet = new Set();
  const edges = await readEdgeBucket(path.join(edgesDir, bucketName), { repair: true, warnings });
  for (const edge of edges) {
    const targetInfo = getMovedPathInfo(edge?.target, oldPath, newPath);
    if (targetInfo.changed && typeof edge?.source === "string") {
      sourceSet.add(edge.source);
    }
  }
  return sourceSet;
}

async function findIncomingSourcesForMovedTarget({ edgesDir, oldPath, newPath, isDirectory, warnings = null }) {
  const sourceSet = new Set();
  const scanned = new Set();

  const scanBucket = async (bucketName) => {
    if (!bucketName || scanned.has(bucketName)) return;
    scanned.add(bucketName);
    const sources = await collectIncomingSourcesFromBucket({ edgesDir, bucketName, oldPath, newPath, warnings });
    for (const source of sources) sourceSet.add(source);
  };

  if (!isDirectory) {
    const bucketChars = computeEdgeBucketCharsToCheck(path.posix.basename(oldPath));
    for (const char of bucketChars) {
      await scanBucket(`${char}.json`);
    }
  }

  if (isDirectory || sourceSet.size === 0) {
    const allBuckets = await listEdgeBucketFiles(edgesDir);
    for (const bucketName of allBuckets) {
      await scanBucket(bucketName);
    }
  }

  return [...sourceSet];
}

async function updateOutgoingLinks({ notebookDir, oldPath, newPath, sourcePaths, result }) {
  for (const sourcePath of sourcePaths) {
    const kind = guessExtension(sourcePath);
    if (!kind) continue;

    const sourceFullPath = path.join(notebookDir, sourcePath);
    const before = await fs.readFile(sourceFullPath, "utf8");
    const oldSourcePath = remapCleanMovedPath(sourcePath, newPath, oldPath);
    const replacements = [];
    let replacementCount = 0;

    for (const span of collectLinkSpans(before, kind)) {
      const raw = span.raw;
      if (!raw || isExternalOrAnchorLink(raw)) continue;

      const { pathPart, suffix } = splitLinkSuffix(raw);
      const targetBeforeMove = resolveNotebookLink(oldSourcePath, pathPart);
      if (!targetBeforeMove) continue;

      const targetAfterMove = remapCleanMovedPath(targetBeforeMove, oldPath, newPath);
      if (!targetAfterMove) continue;
      if (!(await fileExists(path.join(notebookDir, targetAfterMove)))) continue;

      const targetCurrentInterpretation = resolveNotebookLink(sourcePath, pathPart);
      if (targetCurrentInterpretation === targetAfterMove) continue;

      const replacement = `${makeRelativeLink(sourcePath, targetAfterMove)}${suffix}`;
      if (replacement !== raw) {
        replacements.push({ start: span.start, end: span.end, value: replacement });
        replacementCount += 1;
      }
    }

    const after = applySpanReplacements(before, replacements);
    if (after !== before) {
      await fs.writeFile(sourceFullPath, after, "utf8");
      result.outgoing.changed = true;
      result.outgoing.filesChanged += 1;
      result.outgoing.replacements += replacementCount;
      recordUpdatedFile(result, sourcePath);
    }
  }
}

async function updateIncomingLinks({ notebookDir, oldPath, newPath, sourcePaths, result }) {
  for (const sourcePathBeforeRaw of sourcePaths) {
    const sourcePathBefore = sanitizeNotebookPath(sourcePathBeforeRaw);
    if (!sourcePathBefore) continue;

    const sourcePathCurrent = remapCleanMovedPath(sourcePathBefore, oldPath, newPath);
    const sourceKind = guessExtension(sourcePathCurrent);
    if (!sourceKind) continue;

    const full = path.join(notebookDir, sourcePathCurrent);
    if (!(await fileExists(full))) continue;

    const before = await fs.readFile(full, "utf8");
    const replacements = [];
    let replacementCount = 0;

    for (const span of collectLinkSpans(before, sourceKind)) {
      const raw = span.raw;
      if (!raw || isExternalOrAnchorLink(raw)) continue;

      const { pathPart, suffix } = splitLinkSuffix(raw);
      const targetBeforeMove = resolveNotebookLink(sourcePathBefore, pathPart);
      if (!targetBeforeMove) continue;

      const targetInfo = getMovedPathInfo(targetBeforeMove, oldPath, newPath);
      if (!targetInfo.changed || !targetInfo.path) continue;
      if (!(await fileExists(path.join(notebookDir, targetInfo.path)))) continue;

      const currentTarget = resolveNotebookLink(sourcePathCurrent, pathPart);
      if (currentTarget === targetInfo.path) continue;

      const replacement = `${makeRelativeLink(sourcePathCurrent, targetInfo.path)}${suffix}`;
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
      recordUpdatedFile(result, sourcePathCurrent);
    }
  }
}

async function updateGraphEdgeBuckets({ edgesDir, oldPath, newPath, result }) {
  const bucketFiles = await listEdgeBucketFiles(edgesDir);
  const touchedBuckets = new Set();
  const movedEdgesByBucket = new Map();

  for (const name of bucketFiles) {
    const full = path.join(edgesDir, name);
    const edges = await readEdgeBucket(full, { repair: true, warnings: result.warnings });
    if (!edges.length) continue;

    const kept = [];
    let changed = false;

    for (const edge of edges) {
      const sourceInfo = getMovedPathInfo(edge?.source, oldPath, newPath);
      const targetInfo = getMovedPathInfo(edge?.target, oldPath, newPath);

      if (!sourceInfo.changed && !targetInfo.changed) {
        kept.push(edge);
        continue;
      }

      const updatedEdge = {
        ...edge,
        source: sourceInfo.changed ? sourceInfo.path : remapGraphPath(edge.source, oldPath, newPath),
        target: targetInfo.changed ? targetInfo.path : remapGraphPath(edge.target, oldPath, newPath),
      };

      changed = true;
      if (targetInfo.changed) {
        const bucketChar = computeEdgeBucketChar(path.posix.basename(updatedEdge.target));
        const list = movedEdgesByBucket.get(bucketChar) || [];
        list.push(updatedEdge);
        movedEdgesByBucket.set(bucketChar, list);
        result.graph.edgesMoved += 1;
      } else {
        kept.push(updatedEdge);
        result.graph.edgesUpdated += 1;
      }
    }

    if (changed) {
      await writeEdgeBucket(full, kept);
      touchedBuckets.add(name);
    }
  }

  for (const [bucketChar, movedEdges] of movedEdgesByBucket.entries()) {
    const name = `${bucketChar}.json`;
    const full = path.join(edgesDir, name);
    const existing = await readEdgeBucket(full, { repair: true, warnings: result.warnings });
    await writeEdgeBucket(full, [...existing, ...movedEdges]);
    touchedBuckets.add(name);
  }

  result.graph.bucketsTouched = touchedBuckets.size;
}

function jsonRoute(handler) {
  return async (req, res) => {
    try {
      await handler(req, res);
    } catch (err) {
      console.error("[linkMove/update] Failed:", err);
      res.status(500).json({
        success: false,
        error: err?.message || "Failed to update links and graph.",
      });
    }
  };
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
    } catch {
      return res.status(404).json({ error: `File not found at newPath: ${newPath}` });
    }

    const isFile = stat.isFile();
    const isDirectory = stat.isDirectory();
    if (!isFile && !isDirectory) {
      return res.status(400).json({ error: "Only file and directory moves are supported." });
    }

    const movedFiles = await listMovedFilePaths({ notebookDir, newPath, stat });
    const outgoing = await collectOutgoingTargetsForSources({ notebookDir, oldPath, newPath, sourcePaths: movedFiles });
    const warnings = [];
    let incomingSources = [];

    try {
      incomingSources = await findIncomingSourcesForMovedTarget({ edgesDir, oldPath, newPath, isDirectory, warnings });
    } catch (err) {
      warnings.push({
        type: "incoming-analysis-failed",
        error: err?.message || "Unable to inspect graph edge buckets.",
      });
    }

    res.json({
      oldPath,
      newPath,
      isFile,
      isDirectory,
      movedFiles: movedFiles.length,
      outgoing: {
        supported: outgoing.supported,
        supportedFiles: outgoing.supportedFiles,
        readFailures: outgoing.readFailures,
        count: outgoing.targets.length,
        targetsPreview: outgoing.targets.slice(0, 8),
      },
      incoming: {
        count: incomingSources.length,
        sourcesPreview: incomingSources.slice(0, 8),
      },
      warnings,
    });
  });

  router.post("/linkMove/update", jsonRoute(async (req, res) => {
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
    } catch {
      return res.status(404).json({ error: `File not found at newPath: ${newPath}` });
    }

    const isFile = stat.isFile();
    const isDirectory = stat.isDirectory();
    if (!isFile && !isDirectory) {
      return res.status(400).json({ error: "Only file and directory moves are supported." });
    }

    const movedFiles = await listMovedFilePaths({ notebookDir, newPath, stat });
    const result = {
      success: true,
      oldPath,
      newPath,
      isFile,
      isDirectory,
      movedFiles: movedFiles.length,
      updatedFiles: [],
      outgoing: { changed: false, filesChanged: 0, replacements: 0 },
      incoming: { filesChanged: 0, replacements: 0 },
      graph: { bucketsTouched: 0, edgesMoved: 0, edgesUpdated: 0 },
      warnings: [],
    };

    let incomingSources = [];
    if (updateIncoming) {
      incomingSources = await findIncomingSourcesForMovedTarget({
        edgesDir,
        oldPath,
        newPath,
        isDirectory,
        warnings: result.warnings,
      });
    }

    if (updateOutgoing) {
      await updateOutgoingLinks({ notebookDir, oldPath, newPath, sourcePaths: movedFiles, result });
    }

    if (updateIncoming) {
      await updateIncomingLinks({ notebookDir, oldPath, newPath, sourcePaths: incomingSources, result });
    }

    if (updateGraph) {
      await updateGraphEdgeBuckets({ edgesDir, oldPath, newPath, result });
    }

    res.json(result);
  }));

  return router;
}
