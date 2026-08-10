// Nodevision/ApplicationSystem/public/PanelInstances/InfoPanels/GraphManagerDependencies/MetaWorldPortalLinks.mjs
// This module detects Nodevision MetaWorld portal definitions and converts cross-world portal destinations into graph link records.

const PORTAL_EDGE_TEXT = "contains a portal to:";
const PORTAL_TARGET_FIELDS = [
  "targetWorld",
  "portalTarget",
  "portalTargetWorld",
  "target",
  "href",
  "world",
  "worldPath",
  "targetPath",
  "targetFile",
  "destination",
  "destinationWorld",
];
const ACTION_KEYS = ["collisionAction", "onCollide", "useAction", "onUse", "actions"];
const CHILD_KEYS = ["objects", "children", "items", "layers", "entities", "portals", "scenes", "worlds"];
const ARCHIVAL_KEYS = new Set(["metadata", "originalMetaWorld", "sourceWorld", "serializedWorld"]);

function stripJsonComments(value = "") {
  return String(value || "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1")
    .trim();
}

function isMetaWorldScript(attrs = "", body = "") {
  const attrText = String(attrs || "");
  const bodyText = String(body || "");
  return /\bdata-nodevision-meta-world\b/i.test(attrText) ||
    /\bid\s*=\s*(["\x27])nodevision-metaworld\1/i.test(attrText) ||
    /"worldType"\s*:\s*"NodevisionMetaWorld"/i.test(bodyText) ||
    /NodevisionMetaWorld/i.test(bodyText);
}

function extractMetaWorldScriptBodies(text = "") {
  const scripts = [];
  const scriptRegex = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = scriptRegex.exec(String(text || "")))) {
    const attrs = match[1] || "";
    const body = match[2] || "";
    if (isMetaWorldScript(attrs, body)) scripts.push(body);
  }
  return scripts;
}

function isSameWorldPortalTarget(value = "") {
  const normalized = String(value || "").trim().toLowerCase();
  return ["self", ".", "same", "current", "coordinate", "coordinates", "linked", "linkedportal", "sameworldcoordinate"].includes(normalized);
}

function looksLikeMetaWorldDefinition(world) {
  if (!world || typeof world !== "object") return false;
  const worldType = String(world.worldType || world.type || world.kind || "").toLowerCase();
  return worldType.includes("nodevisionmetaworld") ||
    worldType.includes("meta-world") ||
    Array.isArray(world.objects) ||
    Boolean(world.worldMode || world.environment || world.metadata?.source === "GameView");
}

function readPortalTarget(def = {}) {
  for (const field of PORTAL_TARGET_FIELDS) {
    const value = def[field];
    if (typeof value === "string" && value.trim()) {
      return { target: value.trim(), field };
    }
  }
  return { target: "", field: "targetWorld" };
}

function isPortalLike(value = {}) {
  const typeText = String(value.type || value.nvType || value.kind || value.action || value.actionType || "").toLowerCase();
  return value.isPortal === true || value.portal === true || typeText === "portal";
}

function addPortalLink(value, links) {
  if (!isPortalLike(value)) return;
  if (value.sameWorld === true) return;
  const { target, field } = readPortalTarget(value);
  if (!target || isSameWorldPortalTarget(target)) return;
  links.push({ target, field });
}

function visitPortalValue(value, links = [], seen = new Set()) {
  if (!value || typeof value !== "object" || seen.has(value)) return links;
  seen.add(value);

  if (Array.isArray(value)) {
    value.forEach((item) => visitPortalValue(item, links, seen));
    return links;
  }

  addPortalLink(value, links);

  for (const key of ACTION_KEYS) {
    const child = value[key];
    if (child && typeof child === "object") visitPortalValue(child, links, seen);
  }

  for (const key of CHILD_KEYS) {
    const child = value[key];
    if (child && typeof child === "object") visitPortalValue(child, links, seen);
  }

  for (const [key, child] of Object.entries(value)) {
    if (ARCHIVAL_KEYS.has(key) || ACTION_KEYS.includes(key) || CHILD_KEYS.includes(key)) continue;
    if (child && typeof child === "object") visitPortalValue(child, links, seen);
  }

  return links;
}

function uniquePortalLinks(links = []) {
  const seen = new Set();
  return links.filter((link) => {
    const key = link.field + "\n" + link.target;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function parseMetaWorldPortalLinkRecords(content, sourcePath, startIndex = 0, helpers = {}) {
  const buildLinkRecord = helpers.buildLinkRecord;
  const isIgnoredLink = helpers.isIgnoredLink || (() => false);
  if (typeof buildLinkRecord !== "function") return [];

  const records = [];
  const emitted = new Set();
  let recordIndex = startIndex;
  for (const body of extractMetaWorldScriptBodies(content)) {
    let parsed = null;
    try {
      parsed = JSON.parse(stripJsonComments(body));
    } catch (_) {
      parsed = null;
    }
    if (!looksLikeMetaWorldDefinition(parsed)) continue;

    for (const link of uniquePortalLinks(visitPortalValue(parsed))) {
      if (!link.target || isIgnoredLink(link.target)) continue;
      const emittedKey = (link.field || "targetWorld") + "\n" + link.target;
      if (emitted.has(emittedKey)) continue;
      emitted.add(emittedKey);
      records.push(buildLinkRecord({
        sourcePath,
        sourceFormat: "metaworld",
        linkKind: "portal",
        linkProperty: link.field || "targetWorld",
        rawTarget: link.target,
        linkText: PORTAL_EDGE_TEXT,
        metadata: {},
        recordIndex,
        ranges: {},
      }));
      recordIndex += 1;
    }
  }
  return records;
}
