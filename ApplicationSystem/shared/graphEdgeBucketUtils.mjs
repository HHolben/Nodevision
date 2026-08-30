// Nodevision/ApplicationSystem/shared/graphEdgeBucketUtils.mjs
// Shared helpers for reading, repairing, deduping, and writing graph edge bucket JSON files.

import fs from "node:fs/promises";
import path from "node:path";

export function computeEdgeBucketChar(fileName = "") {
  const first = String(fileName || "").trim().charAt(0);
  if (!first) return "#";
  return /^[A-Za-z0-9]$/.test(first) ? first : "#";
}

export function computeEdgeBucketCharsToCheck(fileName = "") {
  const ch = computeEdgeBucketChar(fileName);
  if (ch === "#") return ["#"];
  return [...new Set([ch, ch.toLowerCase(), ch.toUpperCase()])];
}

export function edgeKey(edge) {
  return `${edge?.source || ""}->${edge?.target || ""}`;
}

function normalizeEdge(edge) {
  if (!edge || typeof edge !== "object") return null;
  const source = typeof edge.source === "string" ? edge.source : "";
  const target = typeof edge.target === "string" ? edge.target : "";
  if (!source || !target) return null;
  return { ...edge, source, target };
}

export function dedupeEdges(edges = []) {
  const byKey = new Map();
  for (const edge of edges) {
    const clean = normalizeEdge(edge);
    if (!clean) continue;
    const key = edgeKey(clean);
    byKey.set(key, { ...(byKey.get(key) || {}), ...clean });
  }
  return [...byKey.values()];
}

function topLevelJsonSlices(text = "") {
  const slices = [];
  let start = -1;
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];

    if (start < 0) {
      if (ch === "{" || ch === "[") {
        start = i;
        depth = 1;
        inString = false;
        escaped = false;
      }
      continue;
    }

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === "\"") {
        inString = false;
      }
      continue;
    }

    if (ch === "\"") {
      inString = true;
      continue;
    }
    if (ch === "{" || ch === "[") {
      depth += 1;
      continue;
    }
    if (ch === "}" || ch === "]") {
      depth -= 1;
      if (depth === 0) {
        slices.push(text.slice(start, i + 1));
        start = -1;
      } else if (depth < 0) {
        start = -1;
        depth = 0;
      }
    }
  }

  return slices;
}

export function parseEdgeBucketText(raw = "", { sourceName = "edge bucket" } = {}) {
  const text = String(raw ?? "").trim();
  if (!text) {
    return { edges: [], recovered: false, warnings: [] };
  }

  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) {
      return {
        edges: dedupeEdges(parsed),
        recovered: false,
        warnings: [],
      };
    }

    if (parsed && typeof parsed === "object") {
      const edges = dedupeEdges([parsed]);
      return {
        edges,
        recovered: edges.length > 0,
        warnings: [{
          type: "edge-bucket-not-array",
          bucket: sourceName,
          error: "Edge bucket JSON root was a single object instead of an array.",
          recoveredEdges: edges.length,
        }],
      };
    }

    return {
      edges: [],
      recovered: false,
      warnings: [{
        type: "edge-bucket-not-array",
        bucket: sourceName,
        error: "Edge bucket JSON root was not an array.",
      }],
    };
  } catch (parseError) {
    const slices = topLevelJsonSlices(text);
    const recovered = [];
    const parseWarnings = [];

    for (const slice of slices) {
      try {
        const value = JSON.parse(slice);
        if (Array.isArray(value)) recovered.push(...value);
        else if (value && typeof value === "object") recovered.push(value);
      } catch (err) {
        parseWarnings.push(err?.message || "Unable to parse recovered JSON fragment.");
      }
    }

    const edges = dedupeEdges(recovered);
    if (edges.length) {
      return {
        edges,
        recovered: true,
        warnings: [{
          type: "edge-bucket-recovered",
          bucket: sourceName,
          error: parseError?.message || "Malformed edge bucket JSON.",
          recoveredEdges: edges.length,
          skippedFragments: parseWarnings.length,
        }],
      };
    }

    return {
      edges: [],
      recovered: false,
      error: parseError,
      warnings: [{
        type: "edge-bucket-unrecoverable",
        bucket: sourceName,
        error: parseError?.message || "Malformed edge bucket JSON.",
      }],
    };
  }
}

export async function writeEdgeBucket(filePath, edges = []) {
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });
  const tmp = `${filePath}.tmp-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  try {
    await fs.writeFile(tmp, JSON.stringify(dedupeEdges(edges), null, 2), "utf8");
    await fs.rename(tmp, filePath);
  } catch (err) {
    try {
      await fs.unlink(tmp);
    } catch {
      // The temp file may already have been renamed or never created.
    }
    throw err;
  }
}

export async function readEdgeBucket(filePath, { repair = true, warnings = null } = {}) {
  let raw = "";
  try {
    raw = await fs.readFile(filePath, "utf8");
  } catch (err) {
    if (err?.code === "ENOENT") return [];
    throw err;
  }

  const parsed = parseEdgeBucketText(raw, { sourceName: path.basename(filePath) });
  if (Array.isArray(warnings)) warnings.push(...parsed.warnings);

  if (parsed.error && !parsed.recovered) {
    throw parsed.error;
  }

  if (repair && parsed.recovered) {
    await writeEdgeBucket(filePath, parsed.edges);
  }

  return parsed.edges;
}
