// Nodevision/ApplicationSystem/public/PanelInstances/Common/ImageMap/ImageMapAttributes.mjs
// This module centralizes HTML attribute escaping, parsing, and serialization helpers for standards-compliant image maps.

// ------------------------------
// Attribute safety
// ------------------------------
export function escapeHtmlAttribute(value = "") {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function decodeHtmlAttribute(value = "") {
  return String(value ?? "")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

export function attrsFromElement(element) {
  const attrs = {};
  if (!element?.attributes) return attrs;
  for (const attr of Array.from(element.attributes)) {
    attrs[attr.name] = attr.value;
  }
  return attrs;
}

export function parseAttributesFromTag(tag = "") {
  const attrs = {};
  const text = String(tag || "");
  const attrRegex = /([^\s"'<>\/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  let match;
  while ((match = attrRegex.exec(text))) {
    const name = String(match[1] || "").toLowerCase();
    if (!name || name === "img" || name === "map" || name === "area") continue;
    const raw = match[2] ?? match[3] ?? match[4] ?? "";
    attrs[name] = decodeHtmlAttribute(raw);
  }
  return attrs;
}

export function serializeAttributes(attrs = {}, managed = {}, options = {}) {
  const output = { ...(attrs || {}), ...(managed || {}) };
  const includeEmpty = new Set((options.includeEmpty || []).map((name) => String(name).toLowerCase()));
  return Object.entries(output)
    .filter(([name, value]) => {
      const cleanName = String(name || "").trim();
      if (!cleanName || value === null || value === undefined) return false;
      return value !== "" || includeEmpty.has(cleanName.toLowerCase());
    })
    .map(([name, value]) => `${name}="${escapeHtmlAttribute(value)}"`)
    .join(" ");
}

export function withoutManagedAttributes(attrs = {}, names = []) {
  const managed = new Set(names.map((name) => String(name).toLowerCase()));
  const output = {};
  for (const [name, value] of Object.entries(attrs || {})) {
    if (!managed.has(String(name).toLowerCase())) output[name] = value;
  }
  return output;
}
