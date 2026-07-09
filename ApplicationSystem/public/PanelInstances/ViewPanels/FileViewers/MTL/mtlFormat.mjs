// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/FileViewers/MTL/mtlFormat.mjs
// Shared Wavefront MTL parser and serializer used by the MTL viewer and editor.

export const COLOR_KEYS = new Set(["ka", "kd", "ks", "ke", "tf"]);
export const NUMBER_KEYS = new Set(["ns", "ni", "d", "tr", "sharpness"]);
export const MAP_KEYS = new Set([
  "map_ka",
  "map_kd",
  "map_ks",
  "map_ke",
  "map_ns",
  "map_d",
  "map_bump",
  "bump",
  "disp",
  "decal",
  "refl",
  "norm",
]);

export const MTL_KEY_LABELS = {
  ka: "Ambient",
  kd: "Diffuse",
  ks: "Specular",
  ke: "Emission",
  tf: "Transmission filter",
  ns: "Shininess",
  ni: "Optical density",
  d: "Opacity",
  tr: "Transparency",
  illum: "Illumination",
  map_ka: "Ambient map",
  map_kd: "Diffuse map",
  map_ks: "Specular map",
  map_ke: "Emission map",
  map_ns: "Shininess map",
  map_d: "Opacity map",
  map_bump: "Bump map",
  bump: "Bump map",
  disp: "Displacement map",
  decal: "Decal map",
  refl: "Reflection map",
  norm: "Normal map",
};

const CANONICAL_KEY = {
  ka: "Ka",
  kd: "Kd",
  ks: "Ks",
  ke: "Ke",
  tf: "Tf",
  ns: "Ns",
  ni: "Ni",
  d: "d",
  tr: "Tr",
  illum: "illum",
  map_ka: "map_Ka",
  map_kd: "map_Kd",
  map_ks: "map_Ks",
  map_ke: "map_Ke",
  map_ns: "map_Ns",
  map_d: "map_d",
  map_bump: "map_Bump",
  bump: "bump",
  disp: "disp",
  decal: "decal",
  refl: "refl",
  norm: "norm",
};

function splitFirstToken(line = "") {
  const match = String(line).trim().match(/^(\S+)(?:\s+([\s\S]*))?$/);
  if (!match) return { keyword: "", rest: "" };
  return { keyword: match[1], rest: match[2] || "" };
}

function parseEntry(raw = "", lineNumber = 0) {
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

export function createMaterial(name = "Material") {
  const cleanName = String(name || "Material").trim() || "Material";
  return {
    name: cleanName,
    entries: [
      parseEntry(`newmtl ${cleanName}`),
      parseEntry("Ka 0.200 0.200 0.200"),
      parseEntry("Kd 0.800 0.800 0.800"),
      parseEntry("Ks 0.000 0.000 0.000"),
      parseEntry("Ns 10.000"),
      parseEntry("d 1.000"),
      parseEntry("illum 2"),
    ],
  };
}

export function uniqueMaterialName(document = {}, baseName = "Material") {
  const used = new Set((document.materials || []).map((mat) => String(mat.name || "").toLowerCase()));
  let candidate = baseName;
  let suffix = 1;
  while (used.has(candidate.toLowerCase())) {
    suffix += 1;
    candidate = `${baseName}_${suffix}`;
  }
  return candidate;
}

function refreshEntry(entry, nextRaw) {
  const parsed = parseEntry(nextRaw, entry?.lineNumber || 0);
  Object.keys(entry).forEach((key) => delete entry[key]);
  Object.assign(entry, parsed);
  return entry;
}

export function findEntry(material, key) {
  const lower = String(key || "").toLowerCase();
  return (material?.entries || []).find((entry) => entry.lower === lower) || null;
}

export function findEntries(material, key) {
  const lower = String(key || "").toLowerCase();
  return (material?.entries || []).filter((entry) => entry.lower === lower);
}

function upsertEntry(material, key, value, { removeEmpty = false } = {}) {
  if (!material || !Array.isArray(material.entries)) return null;
  const lower = String(key || "").toLowerCase();
  const keyword = CANONICAL_KEY[lower] || key;
  const cleanValue = String(value ?? "").trim();

  if (removeEmpty && !cleanValue) {
    material.entries = material.entries.filter((entry) => entry.lower !== lower);
    return null;
  }

  const raw = cleanValue ? `${keyword} ${cleanValue}` : keyword;
  const existing = findEntry(material, lower);
  if (existing) return refreshEntry(existing, raw);

  const next = parseEntry(raw);
  material.entries.push(next);
  return next;
}

export function setMaterialName(material, name) {
  if (!material) return;
  const cleanName = String(name || "").trim() || "Material";
  material.name = cleanName;
  const first = material.entries?.[0];
  if (first?.type === "newmtl") {
    refreshEntry(first, `newmtl ${cleanName}`);
  } else {
    material.entries = [parseEntry(`newmtl ${cleanName}`), ...(material.entries || [])];
  }
}

export function getColor(material, key, fallback = [0, 0, 0]) {
  const entry = findEntry(material, key);
  if (!entry || entry.args.length < 3) return fallback.slice(0, 3);
  return [0, 1, 2].map((idx) => {
    const value = Number(entry.args[idx]);
    return Number.isFinite(value) ? clamp(value, 0, 1) : fallback[idx] || 0;
  });
}

export function setColor(material, key, values = [0, 0, 0]) {
  const rgb = [0, 1, 2].map((idx) => formatNumber(clamp(Number(values[idx]), 0, 1), 3));
  upsertEntry(material, key, rgb.join(" "));
}

export function getNumber(material, key, fallback = 0) {
  const entry = findEntry(material, key);
  if (!entry || !entry.args.length) return fallback;
  const value = Number(entry.args[0]);
  return Number.isFinite(value) ? value : fallback;
}

export function setNumber(material, key, value, options = {}) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    upsertEntry(material, key, "", { removeEmpty: options.removeEmpty === true });
    return;
  }
  upsertEntry(material, key, formatNumber(number, options.precision ?? 3));
}

export function getTextValue(material, key, fallback = "") {
  const entry = findEntry(material, key);
  return entry?.value ?? fallback;
}

export function setTextValue(material, key, value, options = {}) {
  upsertEntry(material, key, value, { removeEmpty: options.removeEmpty !== false });
}

export function materialTextureEntries(material) {
  return (material?.entries || []).filter((entry) => entry.type === "map");
}

export function materialUnknownEntries(material) {
  return (material?.entries || []).filter((entry) => {
    if (["blank", "comment", "newmtl", "color", "number", "map"].includes(entry.type)) return false;
    return !MTL_KEY_LABELS[entry.lower];
  });
}

export function colorToHex(values = [0, 0, 0]) {
  return `#${values.map((value) => Math.round(clamp(Number(value), 0, 1) * 255).toString(16).padStart(2, "0")).join("")}`;
}

export function hexToColor(hex = "#000000") {
  const clean = String(hex || "").trim().replace(/^#/, "");
  if (!/^[0-9a-f]{6}$/i.test(clean)) return [0, 0, 0];
  return [0, 2, 4].map((idx) => parseInt(clean.slice(idx, idx + 2), 16) / 255);
}

export function materialPreviewColor(material) {
  return getColor(material, "Kd", getColor(material, "Ka", [0.8, 0.8, 0.8]));
}

export function materialOpacity(material) {
  const opacity = getNumber(material, "d", null);
  if (opacity !== null) return clamp(opacity, 0, 1);
  const transparency = getNumber(material, "Tr", 0);
  return clamp(1 - transparency, 0, 1);
}

export function summarizeMtl(document = {}) {
  const materials = document.materials || [];
  const textureCount = materials.reduce((total, material) => total + materialTextureEntries(material).length, 0);
  const unknownCount = materials.reduce((total, material) => total + materialUnknownEntries(material).length, 0);
  return {
    materialCount: materials.length,
    textureCount,
    unknownCount,
  };
}

export function textureFileName(value = "") {
  const tokens = String(value || "").trim().split(/\s+/).filter(Boolean);
  if (!tokens.length) return "";
  return tokens[tokens.length - 1];
}

export function formatNumber(value, precision = 3) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "0";
  return number.toFixed(precision).replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1");
}

export function clamp(value, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return min;
  return Math.min(max, Math.max(min, number));
}

export function escapeHTML(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
