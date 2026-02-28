import { readFileSync, writeFileSync } from "node:fs";
import { extname, basename } from "node:path";

function extractJsonFromHtml(html) {
  const match = html.match(/<script\s+type=["']application\/json["']\s*>([\s\S]*?)<\/script>/i);
  if (!match) return null;
  return { jsonText: match[1], start: match.index, end: match.index + match[0].length };
}

function hexToColor3f(hex) {
  if (typeof hex !== "string") return null;
  const cleaned = hex.trim().replace("#", "");
  if (!/^[0-9a-fA-F]{6}$/.test(cleaned)) return null;
  const r = parseInt(cleaned.slice(0, 2), 16) / 255;
  const g = parseInt(cleaned.slice(2, 4), 16) / 255;
  const b = parseInt(cleaned.slice(4, 6), 16) / 255;
  return [Number(r.toFixed(5)), Number(g.toFixed(5)), Number(b.toFixed(5))];
}

function makeAttr(type, value) {
  return { type, value };
}

function toUsdLike(worldJson, fileLabel) {
  const alreadyUsdLike = Array.isArray(worldJson?.objects)
    && worldJson?.usd?.metadata
    && worldJson.objects.some(obj => obj?.typeName || obj?.path || obj?.primPath);
  if (alreadyUsdLike) return worldJson;

  const objects = Array.isArray(worldJson?.objects) ? worldJson.objects : [];
  const usdObjects = [];
  usdObjects.push({
    path: "/World",
    typeName: "Xform"
  });

  const ensureUniquePath = (() => {
    const seen = new Set();
    return (baseName) => {
      let name = baseName;
      let counter = 1;
      while (seen.has(name)) {
        counter += 1;
        name = `${baseName}_${counter}`;
      }
      seen.add(name);
      return `/World/${name}`;
    };
  })();

  objects.forEach((def, index) => {
    if (!def || typeof def !== "object") return;
    const nameBase = def.id || def.name || def.label || def.tag || def.type || `Prim${index + 1}`;
    const path = ensureUniquePath(String(nameBase).replace(/[^A-Za-z0-9_]/g, "_"));
    const type = def.type || def.geometry || def.shape || "box";
    const attrs = {};
    const custom = {};

    const position = Array.isArray(def.position) && def.position.length >= 3 ? def.position : [0, 0, 0];
    attrs["xformOp:translate"] = makeAttr("float3", position);

    const color3f = hexToColor3f(def.color || def.emissive || null);
    if (color3f) {
      attrs["primvars:displayColor"] = makeAttr("color3f[]", [color3f]);
    }

    const isPortal = def.type === "portal" || def.isPortal === true;
    if (isPortal) {
      custom["nv:type"] = makeAttr("token", "portal");
      const shape = (def.shape || def.geometry || "box").toLowerCase();
      custom["nv:shape"] = makeAttr("token", shape);
      if (Array.isArray(def.size)) custom["nv:size"] = makeAttr("float3", def.size.length === 2 ? [def.size[0], def.size[1], 0] : def.size);
      if (def.targetWorld) custom["nv:targetWorld"] = makeAttr("token", def.targetWorld);
      if (def.sameWorld === true) custom["nv:sameWorld"] = makeAttr("bool", true);
      if (Array.isArray(def.spawn)) custom["nv:spawn"] = makeAttr("float3", def.spawn);
      if (def.spawnPoint) custom["nv:spawnPoint"] = makeAttr("token", def.spawnPoint);
      if (Number.isFinite(def.spawnYaw)) custom["nv:spawnYaw"] = makeAttr("float", def.spawnYaw);
      if (Number.isFinite(def.cooldownMs)) custom["nv:cooldownMs"] = makeAttr("float", def.cooldownMs);
      if (Number.isFinite(def.opacity)) custom["nv:opacity"] = makeAttr("float", def.opacity);
      if (def.emissive !== undefined) custom["nv:emissive"] = makeAttr("bool", Boolean(def.emissive));
      if (Number.isFinite(def.emissiveIntensity)) custom["nv:emissiveIntensity"] = makeAttr("float", def.emissiveIntensity);
      if (def.isSolid !== undefined) custom["nv:isSolid"] = makeAttr("bool", Boolean(def.isSolid));
      if (def.tag) custom["nv:tag"] = makeAttr("token", def.tag);
      if (Number.isFinite(def.useRange)) custom["nv:useRange"] = makeAttr("float", def.useRange);
      if (def.useAction) custom["nv:useAction"] = makeAttr("string", JSON.stringify(def.useAction));
      if (def.collisionAction) custom["nv:collisionAction"] = makeAttr("string", JSON.stringify(def.collisionAction));
    }

    if (def.type === "box" || type === "box") {
      attrs["xformOp:scale"] = makeAttr("float3", Array.isArray(def.size) ? def.size : [1, 1, 1]);
      attrs["xformOpOrder"] = makeAttr("token[]", ["xformOp:translate", "xformOp:scale"]);
      if (!isPortal) custom["nv:type"] = makeAttr("token", "box");
      if (def.isSolid !== undefined) custom["nv:isSolid"] = makeAttr("bool", Boolean(def.isSolid));
      if (def.tag) custom["nv:tag"] = makeAttr("token", def.tag);
      if (def.spawnId) custom["nv:spawnId"] = makeAttr("token", def.spawnId);
      if (Number.isFinite(def.spawnYaw)) custom["nv:spawnYaw"] = makeAttr("float", def.spawnYaw);
      if (Number.isFinite(def.useRange)) custom["nv:useRange"] = makeAttr("float", def.useRange);
      if (def.useAction) custom["nv:useAction"] = makeAttr("string", JSON.stringify(def.useAction));
      if (def.collisionAction) custom["nv:collisionAction"] = makeAttr("string", JSON.stringify(def.collisionAction));
      usdObjects.push({ path, typeName: "Cube", attributes: attrs, customAttributes: custom });
      return;
    }

    if (def.type === "sphere" || type === "sphere") {
      const radius = Array.isArray(def.size) ? def.size[0] : 0.5;
      attrs["radius"] = makeAttr("float", radius);
      attrs["xformOpOrder"] = makeAttr("token[]", ["xformOp:translate"]);
      if (!isPortal) custom["nv:type"] = makeAttr("token", "sphere");
      if (def.isSolid !== undefined) custom["nv:isSolid"] = makeAttr("bool", Boolean(def.isSolid));
      if (Number.isFinite(def.useRange)) custom["nv:useRange"] = makeAttr("float", def.useRange);
      if (def.useAction) custom["nv:useAction"] = makeAttr("string", JSON.stringify(def.useAction));
      if (def.collisionAction) custom["nv:collisionAction"] = makeAttr("string", JSON.stringify(def.collisionAction));
      usdObjects.push({ path, typeName: "Sphere", attributes: attrs, customAttributes: custom });
      return;
    }

    if (def.type === "cylinder" || type === "cylinder") {
      const radius = Array.isArray(def.size) ? def.size[0] : 0.5;
      const height = Array.isArray(def.size) ? def.size[1] : 1;
      attrs["radius"] = makeAttr("float", radius);
      attrs["height"] = makeAttr("float", height);
      attrs["xformOpOrder"] = makeAttr("token[]", ["xformOp:translate"]);
      if (!isPortal) custom["nv:type"] = makeAttr("token", "cylinder");
      if (def.isSolid !== undefined) custom["nv:isSolid"] = makeAttr("bool", Boolean(def.isSolid));
      if (Number.isFinite(def.useRange)) custom["nv:useRange"] = makeAttr("float", def.useRange);
      if (def.useAction) custom["nv:useAction"] = makeAttr("string", JSON.stringify(def.useAction));
      if (def.collisionAction) custom["nv:collisionAction"] = makeAttr("string", JSON.stringify(def.collisionAction));
      usdObjects.push({ path, typeName: "Cylinder", attributes: attrs, customAttributes: custom });
      return;
    }

    if (def.type === "torus" || type === "torus") {
      attrs["xformOpOrder"] = makeAttr("token[]", ["xformOp:translate"]);
      custom["nv:type"] = makeAttr("token", def.type || "torus");
      custom["nv:shape"] = makeAttr("token", "torus");
      if (Array.isArray(def.size)) custom["nv:size"] = makeAttr("float2", def.size);
      if (def.isSolid !== undefined) custom["nv:isSolid"] = makeAttr("bool", Boolean(def.isSolid));
      if (Number.isFinite(def.useRange)) custom["nv:useRange"] = makeAttr("float", def.useRange);
      if (def.useAction) custom["nv:useAction"] = makeAttr("string", JSON.stringify(def.useAction));
      if (def.collisionAction) custom["nv:collisionAction"] = makeAttr("string", JSON.stringify(def.collisionAction));
      usdObjects.push({ path, typeName: "Mesh", attributes: attrs, customAttributes: custom });
      return;
    }

    if (def.type === "light") {
      const lightType = (def.lightType || "point").toLowerCase();
      let typeName = "SphereLight";
      if (lightType === "ambient" || lightType === "hemisphere") typeName = "DomeLight";
      if (lightType === "directional") typeName = "DistantLight";
      if (lightType === "spot") typeName = "DiskLight";
      attrs["xformOpOrder"] = makeAttr("token[]", ["xformOp:translate"]);
      if (color3f) attrs["color"] = makeAttr("color3f", color3f);
      if (Number.isFinite(def.intensity)) attrs["intensity"] = makeAttr("float", def.intensity);
      custom["nv:type"] = makeAttr("token", "light");
      custom["nv:lightType"] = makeAttr("token", lightType);
      if (Array.isArray(def.target)) custom["nv:target"] = makeAttr("float3", def.target);
      if (Number.isFinite(def.distance)) custom["nv:distance"] = makeAttr("float", def.distance);
      if (Number.isFinite(def.decay)) custom["nv:decay"] = makeAttr("float", def.decay);
      if (Number.isFinite(def.angle)) custom["nv:angle"] = makeAttr("float", def.angle);
      if (Number.isFinite(def.penumbra)) custom["nv:penumbra"] = makeAttr("float", def.penumbra);
      usdObjects.push({ path, typeName, attributes: attrs, customAttributes: custom });
      return;
    }

    const fallbackSize = Array.isArray(def.size) ? def.size : [1, 1, 1];
    attrs["xformOp:scale"] = makeAttr("float3", fallbackSize);
    attrs["xformOpOrder"] = makeAttr("token[]", ["xformOp:translate", "xformOp:scale"]);
    custom["nv:type"] = makeAttr("token", def.type || "mesh");
    if (def.isSolid !== undefined) custom["nv:isSolid"] = makeAttr("bool", Boolean(def.isSolid));
    if (Number.isFinite(def.useRange)) custom["nv:useRange"] = makeAttr("float", def.useRange);
    if (def.useAction) custom["nv:useAction"] = makeAttr("string", JSON.stringify(def.useAction));
    if (def.collisionAction) custom["nv:collisionAction"] = makeAttr("string", JSON.stringify(def.collisionAction));
    usdObjects.push({ path, typeName: "Mesh", attributes: attrs, customAttributes: custom });
  });

  return {
    usd: {
      metadata: {
        defaultPrim: "World",
        metersPerUnit: 1,
        upAxis: "Y",
        source: fileLabel
      }
    },
    objects: usdObjects
  };
}

function updateFile(filePath) {
  const raw = readFileSync(filePath, "utf8");
  if (extname(filePath).toLowerCase() === ".html") {
    const extracted = extractJsonFromHtml(raw);
    if (!extracted) throw new Error(`No JSON script tag found in ${filePath}`);
    const jsonText = extracted.jsonText;
    const worldJson = JSON.parse(jsonText);
    const usdLike = toUsdLike(worldJson, basename(filePath));
    const updatedJson = JSON.stringify(usdLike, null, 2);
    const newScript = `<script type="application/json">\n${updatedJson}\n    </script>`;
    const before = raw.slice(0, extracted.start);
    const after = raw.slice(extracted.end);
    const updated = `${before}${newScript}${after}`;
    writeFileSync(filePath, updated, "utf8");
    return;
  }

  const worldJson = JSON.parse(raw);
  const usdLike = toUsdLike(worldJson, basename(filePath));
  writeFileSync(filePath, JSON.stringify(usdLike, null, 2), "utf8");
}

const [,, inputPath] = process.argv;
if (!inputPath) {
  console.error("Usage: node tools/worldJsonToUsdLike.mjs <world.html>");
  process.exit(1);
}

updateFile(inputPath);
