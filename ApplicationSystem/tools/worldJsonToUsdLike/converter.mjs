// Nodevision/ApplicationSystem/tools/worldJsonToUsdLike/converter.mjs
// This file defines conversion utilities that map Nodevision world JSON data into a USD-like object structure. It normalizes object attributes and preserves metadata for downstream tooling.

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

export function extractJsonFromHtml(html) {
  const match = html.match(/<script\s+type=["']application\/json["']\s*>([\s\S]*?)<\/script>/i);
  if (!match) return null;
  return { jsonText: match[1], start: match.index, end: match.index + match[0].length };
}

export function toUsdLike(worldJson, fileLabel) {
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
      const shape = (def.shape || def.geometry || "plane").toLowerCase();
      custom["nv:shape"] = makeAttr("token", shape);
      if (Array.isArray(def.size)) custom["nv:size"] = makeAttr("float3", def.size);
      if (def.target) custom["nv:target"] = makeAttr("string", String(def.target));
      attrs["xformOpOrder"] = makeAttr("token[]", ["xformOp:translate"]);
      usdObjects.push({ path, typeName: "Xform", attributes: attrs, customAttributes: custom });
      return;
    }

    const isCamera = def.type === "camera" || def.isCamera === true;
    if (isCamera) {
      attrs["xformOpOrder"] = makeAttr("token[]", ["xformOp:translate"]);
      if (Number.isFinite(def.fov)) attrs["fov"] = makeAttr("float", def.fov);
      if (Array.isArray(def.rotation)) custom["nv:rotation"] = makeAttr("float3", def.rotation);
      usdObjects.push({ path, typeName: "Camera", attributes: attrs, customAttributes: custom });
      return;
    }

    const isLight = def.type === "light" || def.isLight === true;
    if (isLight) {
      const lightType = def.lightType || def.kind || "distant";
      custom["nv:type"] = makeAttr("token", "light");
      custom["nv:lightType"] = makeAttr("token", lightType);
      if (Array.isArray(def.target)) custom["nv:target"] = makeAttr("float3", def.target);
      if (Number.isFinite(def.distance)) custom["nv:distance"] = makeAttr("float", def.distance);
      if (Number.isFinite(def.decay)) custom["nv:decay"] = makeAttr("float", def.decay);
      if (Number.isFinite(def.angle)) custom["nv:angle"] = makeAttr("float", def.angle);
      if (Number.isFinite(def.penumbra)) custom["nv:penumbra"] = makeAttr("float", def.penumbra);
      attrs["xformOpOrder"] = makeAttr("token[]", ["xformOp:translate"]);
      usdObjects.push({ path, typeName: "DistantLight", attributes: attrs, customAttributes: custom });
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

