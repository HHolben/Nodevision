// Nodevision/ApplicationSystem/public/MetaWorld/MetaWorldUsdExport.mjs
// This file converts ordinary Nodevision MetaWorld definitions into portable USDA text while omitting Nodevision-only procedural math objects.

function scriptAttr(attrs, name) {
  const match = String(attrs || "").match(new RegExp(`\\b${name}\\s*=\\s*["']([^"']*)["']`, "i"));
  return match ? match[1] : "";
}

export function extractMetaWorldJsonFromHtml(htmlText) {
  const scripts = [];
  const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  let match = null;
  while ((match = re.exec(String(htmlText || "")))) {
    const attrs = match[1] || "";
    const type = scriptAttr(attrs, "type").toLowerCase();
    const id = scriptAttr(attrs, "id").toLowerCase();
    const hasMetaFlag = /\bdata-nodevision-meta-world\b/i.test(attrs);
    if (hasMetaFlag || id === "nodevision-metaworld" || type === "application/json") {
      scripts.push({ jsonText: match[2], preferred: hasMetaFlag || id === "nodevision-metaworld" });
    }
  }
  return (scripts.find((entry) => entry.preferred) || scripts[0] || null)?.jsonText || null;
}

function cleanToken(value, fallback = "Prim") {
  const safe = String(value || fallback).replace(/[^A-Za-z0-9_]/g, "_");
  return safe || fallback;
}

function hexToColor3f(hex) {
  if (typeof hex !== "string") return null;
  const cleaned = hex.trim().replace(/^#/, "");
  if (!/^[0-9a-fA-F]{6}$/.test(cleaned)) return null;
  return [0, 2, 4].map((offset) => Number((parseInt(cleaned.slice(offset, offset + 2), 16) / 255).toFixed(5)));
}

function makeAttr(type, value) {
  return { type, value };
}

function isNodevisionOnlyObject(def = {}) {
  const type = String(def.type || def.nvType || "").toLowerCase();
  if (type.includes("equation") || type.includes("expression") || type === "math-function") return true;
  if (type === "functionsurface" || type === "functioncurve" || type === "parametriccurve") return true;
  return def.metaWorldExpressionLayer === true || Boolean(def.equationCollider || def.equationExpression);
}

function addCommonCustom(custom, def, isPortal = false) {
  if (!isPortal) custom["nv:type"] = makeAttr("token", def.type || def.shape || "mesh");
  if (typeof def.tag === "string") custom["nv:tag"] = makeAttr("string", def.tag);
  if (def.isSolid !== undefined) custom["nv:isSolid"] = makeAttr("bool", Boolean(def.isSolid));
  if (Number.isFinite(def.useRange)) custom["nv:useRange"] = makeAttr("float", def.useRange);
  if (def.useAction) custom["nv:useAction"] = makeAttr("string", JSON.stringify(def.useAction));
  if (def.collisionAction) custom["nv:collisionAction"] = makeAttr("string", JSON.stringify(def.collisionAction));
}

function pushPrim(objects, path, typeName, attrs, custom) {
  objects.push({ path, typeName, attributes: attrs, customAttributes: custom });
}

export function toUsdLike(worldJson, sourceLabel = "MetaWorld") {
  if (Array.isArray(worldJson?.objects) && worldJson?.usd?.metadata && worldJson.objects.some((obj) => obj?.path || obj?.primPath)) return worldJson;
  const objects = [{ path: "/World", typeName: "Xform" }];
  const usedNames = new Set();
  const makePath = (baseName, index) => {
    const base = cleanToken(baseName, `Prim${index + 1}`);
    let name = base;
    for (let i = 2; usedNames.has(name); i += 1) name = `${base}_${i}`;
    usedNames.add(name);
    return `/World/${name}`;
  };
  (Array.isArray(worldJson?.objects) ? worldJson.objects : []).forEach((def, index) => {
    if (!def || typeof def !== "object" || isNodevisionOnlyObject(def)) return;
    const path = makePath(def.id || def.name || def.label || def.tag || def.type, index);
    const attrs = { "xformOp:translate": makeAttr("float3", Array.isArray(def.position) ? def.position.slice(0, 3) : [0, 0, 0]) };
    const custom = {};
    const color3f = hexToColor3f(def.color || def.emissive);
    if (color3f) attrs["primvars:displayColor"] = makeAttr("color3f[]", [color3f]);
    const type = String(def.type || def.geometry || def.shape || "box").toLowerCase();
    const isPortal = type === "portal" || def.isPortal === true;
    const shapeType = isPortal ? String(def.shape || def.geometry || "box").toLowerCase() : type;
    if (isPortal) {
      custom["nv:type"] = makeAttr("token", "portal");
      custom["nv:shape"] = makeAttr("token", String(def.shape || def.geometry || "box").toLowerCase());
      if (def.targetWorld) custom["nv:targetWorld"] = makeAttr("string", def.targetWorld);
      if (def.sameWorld === true) custom["nv:sameWorld"] = makeAttr("bool", true);
      if (Array.isArray(def.spawn)) custom["nv:spawn"] = makeAttr("float3", def.spawn.slice(0, 3));
      if (typeof def.spawnPoint === "string") custom["nv:spawnPoint"] = makeAttr("string", def.spawnPoint);
      if (typeof def.linkedPortalId === "string") custom["nv:linkedPortalId"] = makeAttr("string", def.linkedPortalId);
    }
    addCommonCustom(custom, def, isPortal);
    if (shapeType === "box") {
      attrs["xformOp:scale"] = makeAttr("float3", Array.isArray(def.size) ? def.size.slice(0, 3) : [1, 1, 1]);
      attrs.xformOpOrder = makeAttr("token[]", ["xformOp:translate", "xformOp:scale"]);
      pushPrim(objects, path, "Cube", attrs, custom);
    } else if (shapeType === "sphere") {
      attrs.radius = makeAttr("float", Array.isArray(def.size) ? Number(def.size[0]) || 0.5 : 0.5);
      attrs.xformOpOrder = makeAttr("token[]", ["xformOp:translate"]);
      pushPrim(objects, path, "Sphere", attrs, custom);
    } else if (shapeType === "cylinder" || shapeType === "cone") {
      attrs.radius = makeAttr("float", Array.isArray(def.size) ? Number(def.size[0]) || 0.5 : 0.5);
      attrs.height = makeAttr("float", Array.isArray(def.size) ? Number(def.size[1]) || 1 : 1);
      attrs.xformOpOrder = makeAttr("token[]", ["xformOp:translate"]);
      pushPrim(objects, path, shapeType === "cone" ? "Cone" : "Cylinder", attrs, custom);
    } else if (type === "light") {
      const lightType = String(def.lightType || "point").toLowerCase();
      const typeName = lightType === "directional" ? "DistantLight" : lightType === "ambient" || lightType === "hemisphere" ? "DomeLight" : "SphereLight";
      if (color3f) attrs.color = makeAttr("color3f", color3f);
      if (Number.isFinite(def.intensity)) attrs.intensity = makeAttr("float", def.intensity);
      attrs.xformOpOrder = makeAttr("token[]", ["xformOp:translate"]);
      pushPrim(objects, path, typeName, attrs, custom);
    } else {
      attrs.xformOpOrder = makeAttr("token[]", ["xformOp:translate"]);
      if (Array.isArray(def.size)) custom["nv:size"] = makeAttr(def.size.length === 2 ? "float2" : "float3", def.size.slice(0, 3));
      pushPrim(objects, path, "Xform", attrs, custom);
    }
  });
  return { usd: { metadata: { defaultPrim: "World", metersPerUnit: 1, upAxis: "Y", source: sourceLabel } }, objects };
}

function quoteUsd(value) {
  return `"${String(value).replace(/\\/g, "\\\\").replace(/"/g, "\\\"").replace(/\n/g, "\\n")}"`;
}

function formatValue(type, value) {
  if (type === "bool") return value ? "true" : "false";
  if (type === "float" || type === "int") return Number.isFinite(Number(value)) ? String(value) : "0";
  if (type === "float2") return `(${Number(value?.[0]) || 0}, ${Number(value?.[1]) || 0})`;
  if (type === "float3" || type === "color3f") return `(${Number(value?.[0]) || 0}, ${Number(value?.[1]) || 0}, ${Number(value?.[2]) || 0})`;
  if (type === "token[]") return `[${(Array.isArray(value) ? value : []).map(quoteUsd).join(", ")}]`;
  if (type === "color3f[]") return `[${(Array.isArray(value) ? value : []).map((v) => formatValue("color3f", v)).join(", ")}]`;
  return quoteUsd(value);
}

function addPrimNode(root, prim) {
  const parts = String(prim.path || prim.primPath || "").split("/").filter(Boolean);
  if (!parts.length) return;
  let node = root;
  parts.forEach((part) => {
    if (!node.children.has(part)) node.children.set(part, { name: part, prim: null, children: new Map() });
    node = node.children.get(part);
  });
  node.prim = prim;
}

function renderPrim(node, indent = "") {
  if (!node.prim) return [...node.children.values()].map((child) => renderPrim(child, indent)).join("");
  let output = `${indent}def ${node.prim.typeName || "Xform"} ${quoteUsd(node.name)}\n${indent}{\n`;
  [["", node.prim.attributes || {}], ["custom ", node.prim.customAttributes || {}]].forEach(([prefix, entries]) => {
    Object.entries(entries).forEach(([name, raw]) => {
      const entry = raw && typeof raw === "object" && "type" in raw ? raw : makeAttr("string", raw);
      output += `${indent}  ${prefix}${entry.type || "string"} ${name} = ${formatValue(entry.type || "string", entry.value)}\n`;
    });
  });
  output += [...node.children.values()].map((child) => renderPrim(child, `${indent}  `)).join("");
  return `${output}${indent}}\n`;
}

export function exportUsda(worldJson) {
  const metadata = worldJson?.usd?.metadata || {};
  const lines = ["#usda 1.0", "("];
  if (metadata.defaultPrim) lines.push(`  defaultPrim = ${quoteUsd(metadata.defaultPrim)}`);
  if (Number.isFinite(metadata.metersPerUnit)) lines.push(`  metersPerUnit = ${metadata.metersPerUnit}`);
  if (metadata.upAxis) lines.push(`  upAxis = ${quoteUsd(metadata.upAxis)}`);
  lines.push(")", "");
  const root = { children: new Map() };
  (Array.isArray(worldJson?.objects) ? worldJson.objects : []).forEach((prim) => addPrimNode(root, prim));
  return `${lines.join("\n")}\n${[...root.children.values()].map((child) => renderPrim(child)).join("")}`;
}
