// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/FileViewers/MTL/mtlParse.mjs
// This module parses Wavefront MTL text into editable document records and serializes those records back to MTL source text.

import { COLOR_KEYS, MAP_KEYS, NUMBER_KEYS } from "./mtlKeys.mjs";

function splitFirstToken(line = "") {
  const match = String(line).trim().match(/^(\S+)(?:\s+([\s\S]*))?$/);
  if (!match) return { keyword: "", rest: "" };
  return { keyword: match[1], rest: match[2] || "" };
}

export function parseEntry(raw = "", lineNumber = 0) {
  const trimmed = String(raw).trim();
  if (!trimmed) return { type: "blank", raw, lineNumber };
  if (trimmed.startsWith("#")) return { type: "comment", raw, lineNumber, text: trimmed.slice(1).trim() };

  const { keyword, rest } = splitFirstToken(trimmed);
  const lower = keyword.toLowerCase();
  const args = rest ? rest.trim().split(/\s+/).filter(Boolean) : [];

  if (lower === "newmtl") {
    return {
      type: "newmtl",
      raw,
      lineNumber,
      keyword,
      lower,
      name: rest.trim() || `Material_${lineNumber || 1}`,
      value: rest.trim(),
      args,
    };
  }

  let type = "property";
  if (COLOR_KEYS.has(lower)) type = "color";
  else if (NUMBER_KEYS.has(lower) || lower === "illum") type = "number";
  else if (MAP_KEYS.has(lower)) type = "map";

  return {
    type,
    raw,
    lineNumber,
    keyword,
    lower,
    value: rest.trim(),
    args,
  };
}

export function parseMtl(text = "") {
  const normalized = String(text || "").replace(/\r\n?/g, "\n");
  const trailingNewline = normalized.endsWith("\n");
  const body = trailingNewline ? normalized.slice(0, -1) : normalized;
  const rawLines = body ? body.split("\n") : [];
  const document = {
    preamble: [],
    materials: [],
    trailingNewline,
  };

  let current = null;
  rawLines.forEach((line, index) => {
    const entry = parseEntry(line, index + 1);
    if (entry.type === "newmtl") {
      current = {
        name: entry.name,
        entries: [entry],
        lineNumber: entry.lineNumber,
      };
      document.materials.push(current);
      return;
    }

    if (current) current.entries.push(entry);
    else document.preamble.push(entry);
  });

  return document;
}

export function serializeMtl(document = {}) {
  const lines = [];
  const preamble = Array.isArray(document.preamble) ? document.preamble : [];
  const materials = Array.isArray(document.materials) ? document.materials : [];

  preamble.forEach((entry) => lines.push(entry?.raw ?? ""));
  materials.forEach((material, index) => {
    if (lines.length && lines[lines.length - 1] !== "" && index > 0) lines.push("");
    const entries = Array.isArray(material.entries) ? material.entries : [];
    entries.forEach((entry) => lines.push(entry?.raw ?? ""));
  });

  const text = lines.join("\n");
  return document.trailingNewline || text ? `${text}\n` : "";
}
