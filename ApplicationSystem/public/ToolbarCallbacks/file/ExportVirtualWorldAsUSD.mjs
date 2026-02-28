// Nodevision/public/ToolbarCallbacks/file/ExportVirtualWorldAsUSD.mjs
// Exports a selected virtual world definition (HTML-embedded JSON) into a .usda file.

function normalizeNotebookPath(inputPath) {
  if (!inputPath || typeof inputPath !== "string") return "";
  let normalized = inputPath.trim().replace(/\\/g, "/");
  normalized = normalized.replace(/^\/+/, "");
  if (normalized.startsWith("Notebook/")) normalized = normalized.slice("Notebook/".length);
  return normalized;
}

function extractJsonFromHtml(htmlText) {
  const match = htmlText.match(/<script\s+type=["']application\/json["']\s*>([\s\S]*?)<\/script>/i);
  return match ? match[1] : null;
}

function toTyped(value, fallbackType = "string") {
  if (value && typeof value === "object" && "type" in value && "value" in value) return value;
  return { type: fallbackType, value };
}

function hexToColor3f(hex) {
  if (typeof hex !== "string") return null;
  const cleaned = hex.trim().replace(/^#/, "");
  if (!/^[0-9a-fA-F]{6}$/.test(cleaned)) return null;
  const r = parseInt(cleaned.slice(0, 2), 16) / 255;
  const g = parseInt(cleaned.slice(2, 4), 16) / 255;
  const b = parseInt(cleaned.slice(4, 6), 16) / 255;
  return [Number(r.toFixed(5)), Number(g.toFixed(5)), Number(b.toFixed(5))];
}

function toUsdLike(worldJson, sourceLabel) {
  const isAlreadyUsdLike = Array.isArray(worldJson?.objects)
    && worldJson?.usd?.metadata
    && worldJson.objects.some(obj => obj?.typeName || obj?.path || obj?.primPath);
  if (isAlreadyUsdLike) return worldJson;

  const sourceObjects = Array.isArray(worldJson?.objects) ? worldJson.objects : [];
  const objects = [{ path: "/World", typeName: "Xform" }];
  const usedNames = new Set();

  const makePath = (baseName) => {
    let safe = String(baseName || "Prim").replace(/[^A-Za-z0-9_]/g, "_");
    if (!safe) safe = "Prim";
    let name = safe;
    let i = 2;
    while (usedNames.has(name)) {
      name = `${safe}_${i}`;
      i += 1;
    }
    usedNames.add(name);
    return `/World/${name}`;
  };

  for (let index = 0; index < sourceObjects.length; index += 1) {
    const def = sourceObjects[index];
    if (!def || typeof def !== "object") continue;

    const path = makePath(def.id || def.name || def.label || def.tag || def.type || `Prim${index + 1}`);
    const attrs = {};
    const custom = {};

    const position = Array.isArray(def.position) && def.position.length >= 3 ? def.position : [0, 0, 0];
    attrs["xformOp:translate"] = { type: "float3", value: position };
    const color3f = hexToColor3f(def.color || def.emissive || null);
    if (color3f) {
      attrs["primvars:displayColor"] = { type: "color3f[]", value: [color3f] };
    }

    const type = (def.type || def.geometry || def.shape || "box").toLowerCase();
    const isPortal = def.type === "portal" || def.isPortal === true;

    if (isPortal) {
      custom["nv:type"] = { type: "token", value: "portal" };
      custom["nv:shape"] = { type: "token", value: (def.shape || def.geometry || "box").toLowerCase() };
      if (Array.isArray(def.size)) {
        custom["nv:size"] = { type: def.size.length === 2 ? "float2" : "float3", value: def.size };
      }
      if (def.targetWorld) custom["nv:targetWorld"] = { type: "token", value: def.targetWorld };
      if (def.sameWorld === true) custom["nv:sameWorld"] = { type: "bool", value: true };
      if (Array.isArray(def.spawn)) custom["nv:spawn"] = { type: "float3", value: def.spawn };
      if (typeof def.spawnPoint === "string") custom["nv:spawnPoint"] = { type: "token", value: def.spawnPoint };
      if (Number.isFinite(def.spawnYaw)) custom["nv:spawnYaw"] = { type: "float", value: def.spawnYaw };
      if (Number.isFinite(def.cooldownMs)) custom["nv:cooldownMs"] = { type: "float", value: def.cooldownMs };
      if (Number.isFinite(def.opacity)) custom["nv:opacity"] = { type: "float", value: def.opacity };
      if (def.emissive !== undefined) custom["nv:emissive"] = { type: "bool", value: Boolean(def.emissive) };
      if (Number.isFinite(def.emissiveIntensity)) custom["nv:emissiveIntensity"] = { type: "float", value: def.emissiveIntensity };
      if (def.isSolid !== undefined) custom["nv:isSolid"] = { type: "bool", value: Boolean(def.isSolid) };
      if (typeof def.tag === "string") custom["nv:tag"] = { type: "token", value: def.tag };
    }

    if (type === "box") {
      attrs["xformOp:scale"] = { type: "float3", value: Array.isArray(def.size) ? def.size : [1, 1, 1] };
      attrs["xformOpOrder"] = { type: "token[]", value: ["xformOp:translate", "xformOp:scale"] };
      if (!isPortal) custom["nv:type"] = { type: "token", value: "box" };
      if (def.isSolid !== undefined) custom["nv:isSolid"] = { type: "bool", value: Boolean(def.isSolid) };
      if (typeof def.tag === "string") custom["nv:tag"] = { type: "token", value: def.tag };
      if (typeof def.spawnId === "string") custom["nv:spawnId"] = { type: "token", value: def.spawnId };
      if (Number.isFinite(def.spawnYaw)) custom["nv:spawnYaw"] = { type: "float", value: def.spawnYaw };
      if (Number.isFinite(def.useRange)) custom["nv:useRange"] = { type: "float", value: def.useRange };
      if (def.useAction) custom["nv:useAction"] = { type: "string", value: JSON.stringify(def.useAction) };
      if (def.collisionAction) custom["nv:collisionAction"] = { type: "string", value: JSON.stringify(def.collisionAction) };
      objects.push({ path, typeName: "Cube", attributes: attrs, customAttributes: custom });
      continue;
    }

    if (type === "sphere") {
      attrs.radius = { type: "float", value: Array.isArray(def.size) ? def.size[0] : 0.5 };
      attrs["xformOpOrder"] = { type: "token[]", value: ["xformOp:translate"] };
      if (!isPortal) custom["nv:type"] = { type: "token", value: "sphere" };
      if (def.isSolid !== undefined) custom["nv:isSolid"] = { type: "bool", value: Boolean(def.isSolid) };
      if (Number.isFinite(def.useRange)) custom["nv:useRange"] = { type: "float", value: def.useRange };
      if (def.useAction) custom["nv:useAction"] = { type: "string", value: JSON.stringify(def.useAction) };
      if (def.collisionAction) custom["nv:collisionAction"] = { type: "string", value: JSON.stringify(def.collisionAction) };
      objects.push({ path, typeName: "Sphere", attributes: attrs, customAttributes: custom });
      continue;
    }

    if (type === "cylinder") {
      attrs.radius = { type: "float", value: Array.isArray(def.size) ? def.size[0] : 0.5 };
      attrs.height = { type: "float", value: Array.isArray(def.size) ? def.size[1] : 1 };
      attrs["xformOpOrder"] = { type: "token[]", value: ["xformOp:translate"] };
      if (!isPortal) custom["nv:type"] = { type: "token", value: "cylinder" };
      if (def.isSolid !== undefined) custom["nv:isSolid"] = { type: "bool", value: Boolean(def.isSolid) };
      if (Number.isFinite(def.useRange)) custom["nv:useRange"] = { type: "float", value: def.useRange };
      if (def.useAction) custom["nv:useAction"] = { type: "string", value: JSON.stringify(def.useAction) };
      if (def.collisionAction) custom["nv:collisionAction"] = { type: "string", value: JSON.stringify(def.collisionAction) };
      objects.push({ path, typeName: "Cylinder", attributes: attrs, customAttributes: custom });
      continue;
    }

    if (type === "light") {
      const lightType = (def.lightType || "point").toLowerCase();
      let typeName = "SphereLight";
      if (lightType === "ambient" || lightType === "hemisphere") typeName = "DomeLight";
      else if (lightType === "directional") typeName = "DistantLight";
      else if (lightType === "spot") typeName = "DiskLight";
      attrs["xformOpOrder"] = { type: "token[]", value: ["xformOp:translate"] };
      if (color3f) attrs.color = { type: "color3f", value: color3f };
      if (Number.isFinite(def.intensity)) attrs.intensity = { type: "float", value: def.intensity };
      custom["nv:type"] = { type: "token", value: "light" };
      custom["nv:lightType"] = { type: "token", value: lightType };
      if (Array.isArray(def.target) && def.target.length >= 3) custom["nv:target"] = { type: "float3", value: def.target };
      if (Number.isFinite(def.distance)) custom["nv:distance"] = { type: "float", value: def.distance };
      if (Number.isFinite(def.decay)) custom["nv:decay"] = { type: "float", value: def.decay };
      if (Number.isFinite(def.angle)) custom["nv:angle"] = { type: "float", value: def.angle };
      if (Number.isFinite(def.penumbra)) custom["nv:penumbra"] = { type: "float", value: def.penumbra };
      objects.push({ path, typeName, attributes: attrs, customAttributes: custom });
      continue;
    }

    if (type === "torus") {
      attrs["xformOpOrder"] = { type: "token[]", value: ["xformOp:translate"] };
      custom["nv:type"] = { type: "token", value: def.type || "torus" };
      custom["nv:shape"] = { type: "token", value: "torus" };
      if (Array.isArray(def.size)) custom["nv:size"] = { type: "float2", value: def.size };
      if (def.isSolid !== undefined) custom["nv:isSolid"] = { type: "bool", value: Boolean(def.isSolid) };
      if (Number.isFinite(def.useRange)) custom["nv:useRange"] = { type: "float", value: def.useRange };
      if (def.useAction) custom["nv:useAction"] = { type: "string", value: JSON.stringify(def.useAction) };
      if (def.collisionAction) custom["nv:collisionAction"] = { type: "string", value: JSON.stringify(def.collisionAction) };
      objects.push({ path, typeName: "Mesh", attributes: attrs, customAttributes: custom });
      continue;
    }

    attrs["xformOp:scale"] = { type: "float3", value: Array.isArray(def.size) ? def.size : [1, 1, 1] };
    attrs["xformOpOrder"] = { type: "token[]", value: ["xformOp:translate", "xformOp:scale"] };
    custom["nv:type"] = { type: "token", value: def.type || "mesh" };
    if (def.isSolid !== undefined) custom["nv:isSolid"] = { type: "bool", value: Boolean(def.isSolid) };
    if (Number.isFinite(def.useRange)) custom["nv:useRange"] = { type: "float", value: def.useRange };
    if (def.useAction) custom["nv:useAction"] = { type: "string", value: JSON.stringify(def.useAction) };
    if (def.collisionAction) custom["nv:collisionAction"] = { type: "string", value: JSON.stringify(def.collisionAction) };
    objects.push({ path, typeName: "Mesh", attributes: attrs, customAttributes: custom });
  }

  return {
    usd: {
      metadata: {
        defaultPrim: "World",
        metersPerUnit: 1,
        upAxis: "Y",
        source: sourceLabel
      }
    },
    objects
  };
}

function formatValue(type, value) {
  if (type === "bool") return value ? "true" : "false";
  if (type === "int") return `${value}`;
  if (type === "float") return Number.isFinite(value) ? value.toString() : "0";
  if (type === "float2") return `(${value[0]}, ${value[1]})`;
  if (type === "float3" || type === "color3f") return `(${value[0]}, ${value[1]}, ${value[2]})`;
  if (type === "token" || type === "string") return `"${String(value)}"`;
  if (type === "token[]") return `[${value.map(v => `"${String(v)}"`).join(", ")}]`;
  if (type === "color3f[]") return `[${value.map(v => `(${v[0]}, ${v[1]}, ${v[2]})`).join(", ")}]`;
  return `"${JSON.stringify(value)}"`;
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
    for (const child of node.children.values()) output += renderPrim(child, indent);
    return output;
  }

  const typeName = node.prim.typeName || "Xform";
  let output = `${indent}def ${typeName} "${node.name}"\n${indent}{\n`;
  const attributes = node.prim.attributes || {};
  const customAttributes = node.prim.customAttributes || {};

  const renderEntry = (entries, isCustom) => {
    for (const [name, rawEntry] of Object.entries(entries)) {
      if (!rawEntry) continue;
      const entry = toTyped(rawEntry);
      const type = entry.type || "string";
      const value = entry.value;
      const prefix = isCustom ? "custom " : "";
      output += `${indent}  ${prefix}${type} ${name} = ${formatValue(type, value)}\n`;
    }
  };

  renderEntry(attributes, false);
  renderEntry(customAttributes, true);

  for (const child of node.children.values()) {
    output += renderPrim(child, `${indent}  `);
  }
  output += `${indent}}\n`;
  return output;
}

function exportUsda(worldJson) {
  const metadata = worldJson?.usd?.metadata || {};
  const lines = ["#usda 1.0", "("];
  if (metadata.defaultPrim) lines.push(`  defaultPrim = "${metadata.defaultPrim}"`);
  if (Number.isFinite(metadata.metersPerUnit)) lines.push(`  metersPerUnit = ${metadata.metersPerUnit}`);
  if (metadata.upAxis) lines.push(`  upAxis = "${metadata.upAxis}"`);
  lines.push(")", "");

  const root = { name: "", prim: null, children: new Map() };
  const objects = Array.isArray(worldJson?.objects) ? worldJson.objects : [];
  objects.forEach(prim => addPrimNode(root, prim));

  let body = "";
  for (const child of root.children.values()) body += renderPrim(child, "");
  return `${lines.join("\n")}\n${body}`;
}

function getSelectedWorldPath() {
  return normalizeNotebookPath(
    window.currentActiveFilePath
    || window.selectedFilePath
    || window.filePath
    || window.ActiveNode
    || ""
  );
}

export default async function exportVirtualWorldAsUSD() {
  const worldPath = getSelectedWorldPath();
  if (!worldPath) {
    alert("No virtual world file is selected.");
    return;
  }

  if (!worldPath.toLowerCase().endsWith(".html")) {
    alert("Select an HTML world file before exporting to USD.");
    return;
  }

  let rawText = "";
  try {
    const response = await fetch(`/Notebook/${encodeURI(worldPath)}`);
    if (!response.ok) throw new Error(`Unable to read ${worldPath} (${response.status})`);
    rawText = await response.text();
  } catch (err) {
    console.error("Failed to fetch world file:", err);
    alert(`Failed to load world file: ${err.message}`);
    return;
  }

  const jsonText = extractJsonFromHtml(rawText);
  if (!jsonText) {
    alert("Selected file does not include a world JSON script block.");
    return;
  }

  let parsedWorld = null;
  try {
    parsedWorld = JSON.parse(jsonText);
  } catch (err) {
    alert(`Invalid world JSON: ${err.message}`);
    return;
  }

  const fileName = worldPath.split("/").pop() || "world.html";
  const usdLike = toUsdLike(parsedWorld, fileName);
  const usdaText = exportUsda(usdLike);
  const downloadName = fileName.replace(/\.html$/i, ".usda");

  try {
    const blob = new Blob([usdaText], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = downloadName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error("Failed to download USD file:", err);
    alert(`Failed to export USD: ${err.message}`);
  }
}
