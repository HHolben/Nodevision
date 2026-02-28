import { readFileSync, writeFileSync } from "node:fs";
import { extname } from "node:path";

function extractJsonFromHtml(html) {
  const match = html.match(/<script\s+type=["']application\/json["']\s*>([\s\S]*?)<\/script>/i);
  if (!match) return null;
  return match[1];
}

function readWorldJson(filePath) {
  const raw = readFileSync(filePath, "utf8");
  if (extname(filePath).toLowerCase() === ".html") {
    const jsonText = extractJsonFromHtml(raw);
    if (!jsonText) throw new Error(`No JSON script tag found in ${filePath}`);
    return JSON.parse(jsonText);
  }
  return JSON.parse(raw);
}

function formatValue(type, value) {
  if (type === "bool") return value ? "true" : "false";
  if (type === "int") return `${value}`;
  if (type === "float") return Number.isFinite(value) ? value.toString() : "0";
  if (type === "float2") return `(${value[0]}, ${value[1]})`;
  if (type === "float3" || type === "color3f") return `(${value[0]}, ${value[1]}, ${value[2]})`;
  if (type === "token" || type === "string") return `\"${String(value)}\"`;
  if (type === "token[]") return `[${value.map(v => `\"${String(v)}\"`).join(", ")}]`;
  if (type === "color3f[]") {
    const inner = value.map(v => `(${v[0]}, ${v[1]}, ${v[2]})`).join(", ");
    return `[${inner}]`;
  }
  if (type === "float3[]") {
    const inner = value.map(v => `(${v[0]}, ${v[1]}, ${v[2]})`).join(", ");
    return `[${inner}]`;
  }
  return `\"${JSON.stringify(value)}\"`;
}

function addPrimNode(root, prim) {
  const path = prim.path || prim.primPath;
  if (!path || !path.startsWith("/")) return;
  const parts = path.split("/").filter(Boolean);
  let node = root;
  for (const part of parts) {
    if (!node.children.has(part)) {
      node.children.set(part, { name: part, prim: null, children: new Map() });
    }
    node = node.children.get(part);
  }
  node.prim = prim;
}

function renderPrim(node, indent = "") {
  if (!node.prim) {
    let output = "";
    for (const child of node.children.values()) {
      output += renderPrim(child, indent);
    }
    return output;
  }

  const typeName = node.prim.typeName || "Xform";
  let output = `${indent}def ${typeName} \"${node.name}\"\n${indent}{\n`;
  const attrs = node.prim.attributes || {};
  const customs = node.prim.customAttributes || {};

  const renderAttrs = (entries, isCustom) => {
    for (const [name, entry] of Object.entries(entries)) {
      if (!entry) continue;
      const type = entry.type || "string";
      const value = "value" in entry ? entry.value : entry;
      const prefix = isCustom ? "custom " : "";
      output += `${indent}  ${prefix}${type} ${name} = ${formatValue(type, value)}\n`;
    }
  };

  renderAttrs(attrs, false);
  renderAttrs(customs, true);

  for (const child of node.children.values()) {
    output += renderPrim(child, indent + "  ");
  }

  output += `${indent}}\n`;
  return output;
}

function exportUsd(worldJson) {
  const metadata = worldJson?.usd?.metadata || {};
  const headerLines = ["#usda 1.0", "("];
  if (metadata.defaultPrim) headerLines.push(`  defaultPrim = \"${metadata.defaultPrim}\"`);
  if (Number.isFinite(metadata.metersPerUnit)) headerLines.push(`  metersPerUnit = ${metadata.metersPerUnit}`);
  if (metadata.upAxis) headerLines.push(`  upAxis = \"${metadata.upAxis}\"`);
  headerLines.push(")", "");

  const root = { name: "", prim: null, children: new Map() };
  const objects = Array.isArray(worldJson?.objects) ? worldJson.objects : [];
  objects.forEach(prim => addPrimNode(root, prim));

  let body = "";
  for (const child of root.children.values()) {
    body += renderPrim(child, "");
  }

  return `${headerLines.join("\n")}\n${body}`;
}

const [,, inputPath, outputPath] = process.argv;
if (!inputPath) {
  console.error("Usage: node tools/exportUsd.mjs <world.html> <out.usda>");
  process.exit(1);
}

const worldJson = readWorldJson(inputPath);
const usd = exportUsd(worldJson);
if (outputPath) {
  writeFileSync(outputPath, usd, "utf8");
} else {
  console.log(usd);
}
