// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/SVGeditorComponents/svgFetch.mjs
// This module loads SVG source text from Nodevision notebook paths. This module normalizes notebook-relative paths so editor sessions can be opened from both API content endpoints and static Notebook URLs. This module validates fetched content so the SVG editor only receives SVG markup.

function normalizeNotebookPath(filePath) {
  if (!filePath) return "";

  let pathOnly = String(filePath).trim();
  if (!pathOnly) return "";

  try {
    if (/^https?:\/\//i.test(pathOnly)) {
      pathOnly = new URL(pathOnly).pathname;
    }
  } catch {
    // keep original if URL parsing fails
  }

  return pathOnly
    .replace(/\\/g, "/")
    .replace(/[?#].*$/, "")
    .replace(/^\/+/, "")
    .replace(/^.*\/Notebook\//i, "")
    .replace(/^Notebook\//i, "");
}

function safeDecode(value) {
  try {
    return decodeURIComponent(String(value));
  } catch {
    return String(value);
  }
}

function encodePathSegments(pathValue) {
  return String(pathValue)
    .split("/")
    .filter(Boolean)
    .map((segment) => encodeURIComponent(safeDecode(segment)))
    .join("/");
}

function dedupe(values = []) {
  return [...new Set(values.filter(Boolean))];
}

function looksLikeSvgText(text) {
  return /<svg[\s>]/i.test(String(text || ""));
}

export async function fetchSvgText(filePath) {
  const raw = String(filePath || "").trim().replace(/\\/g, "/");
  const rawNoHashQuery = raw.replace(/[?#].*$/, "");
  const rawPathname = /^https?:\/\//i.test(rawNoHashQuery)
    ? (() => {
      try {
        return new URL(rawNoHashQuery).pathname;
      } catch {
        return rawNoHashQuery;
      }
    })()
    : rawNoHashQuery;

  const pathCandidates = dedupe([
    normalizeNotebookPath(filePath),
    normalizeNotebookPath(safeDecode(filePath)),
    normalizeNotebookPath(rawPathname),
    normalizeNotebookPath(safeDecode(rawPathname)),
  ]);
  const stamp = `t=${Date.now()}`;
  let lastReason = "Unable to fetch SVG";

  if (!pathCandidates.length) {
    throw new Error("Missing SVG file path");
  }

  for (const relativePath of pathCandidates) {
    const apiRes = await fetch(
      `/api/fileCodeContent?path=${encodeURIComponent(relativePath)}&${stamp}`,
      { cache: "no-store" }
    );
    if (apiRes.ok) {
      const payload = await apiRes.json();
      if (typeof payload?.content === "string") {
        const content = payload.content;
        if (!content.trim() || looksLikeSvgText(content)) {
          return content;
        }
      }
      lastReason = "API response did not contain SVG markup";
    }
  }

  const notebookCandidates = dedupe([
    ...pathCandidates.map((p) => `/Notebook/${encodePathSegments(p)}?${stamp}`),
    rawPathname ? `${rawPathname}${rawPathname.includes("?") ? "&" : "?"}${stamp}` : "",
  ]);

  for (const url of notebookCandidates) {
    const notebookRes = await fetch(url, { cache: "no-store" });
    if (!notebookRes.ok) {
      lastReason = `Notebook fetch failed (${notebookRes.status})`;
      continue;
    }
    const text = await notebookRes.text();
    if (!text.trim() || looksLikeSvgText(text)) {
      return text;
    }
    lastReason = "Notebook response did not contain SVG markup";
  }

  throw new Error(lastReason);
}

