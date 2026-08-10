// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/GameViewDependencies/textWorldObjectDescriptions.mjs
// This file converts visible MetaWorld objects into concise text descriptions for the text-based game world console.

function cleanText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function normalizeKey(value) {
  return cleanText(value).toLowerCase();
}

function objectLabel(object) {
  const data = object?.userData || {};
  return cleanText(
    data.displayName
    || data.label
    || data.title
    || data.tag
    || data.metaWorldLayerId
    || data.id
    || object?.name
    || data.nvType
    || object?.type
    || "Object"
  );
}

function objectType(object) {
  const data = object?.userData || {};
  if (data.isPortal === true || normalizeKey(data.nvType) === "portal") return "portal";
  if (data.soundObject || data.audioAssetPath) return "sound object";
  if (data.iframeObject || data.iframeSrc) return "embedded page";
  if (data.equationCollider || normalizeKey(data.nvType).startsWith("equation")) return "equation object";
  if (data.voxel || data.isVoxel) return "voxel";
  return cleanText(data.nvType || data.type || object?.type || "object").toLowerCase();
}

function objectCenter(THREE, object) {
  if (!object) return null;
  object.updateWorldMatrix?.(true, false);
  const box = new THREE.Box3().setFromObject(object);
  if (!box.isEmpty()) {
    const center = new THREE.Vector3();
    box.getCenter(center);
    return center;
  }
  return object.position?.clone?.() || null;
}

function relativeDirection(offset, forward) {
  const horizontal = offset.clone();
  horizontal.y = 0;
  if (horizontal.lengthSq() < 1e-8) return "here";
  horizontal.normalize();
  const flatForward = forward.clone();
  flatForward.y = 0;
  if (flatForward.lengthSq() < 1e-8) flatForward.set(0, 0, -1);
  flatForward.normalize();
  const dot = flatForward.dot(horizontal);
  const crossY = flatForward.x * horizontal.z - flatForward.z * horizontal.x;
  const side = crossY > 0.25 ? "right" : crossY < -0.25 ? "left" : "";
  const front = dot > 0.55 ? "ahead" : dot < -0.35 ? "behind" : "beside";
  if (!side) return front;
  return front === "beside" ? side : `${front}-${side}`;
}

function objectEntry(THREE, object, origin, forward) {
  const center = objectCenter(THREE, object);
  if (!center) return null;
  const offset = center.clone().sub(origin);
  return {
    object,
    label: objectLabel(object),
    type: objectType(object),
    position: center,
    distance: offset.length(),
    direction: relativeDirection(offset, forward),
    forwardDot: (() => {
      const flat = offset.clone();
      flat.y = 0;
      if (flat.lengthSq() < 1e-8) return 1;
      flat.normalize();
      const f = forward.clone();
      f.y = 0;
      if (f.lengthSq() < 1e-8) f.set(0, 0, -1);
      f.normalize();
      return f.dot(flat);
    })()
  };
}

export function collectTextWorldPeriphery({ THREE, camera, controls, objects, range = 18, halfAngleDegrees = 70 }) {
  const player = controls?.getObject?.();
  const origin = player?.position?.clone?.() || camera?.position?.clone?.();
  if (!THREE || !origin) return [];
  const forward = new THREE.Vector3();
  if (camera?.getWorldDirection) camera.getWorldDirection(forward);
  else if (controls?.getDirection) controls.getDirection(forward);
  if (forward.lengthSq() < 1e-8) forward.set(0, 0, -1);
  const minDot = Math.cos((Math.max(1, halfAngleDegrees) * Math.PI) / 180);
  return (Array.isArray(objects) ? objects : [])
    .filter((object) => object?.visible !== false)
    .map((object) => objectEntry(THREE, object, origin, forward))
    .filter((entry) => entry && entry.distance <= range && entry.forwardDot >= minDot)
    .sort((a, b) => a.distance - b.distance);
}

function matchesObject(entry, query) {
  const data = entry?.object?.userData || {};
  const candidates = [
    entry?.label,
    data.displayName,
    data.label,
    data.title,
    data.tag,
    data.metaWorldLayerId,
    data.id,
    entry?.object?.name,
    entry?.object?.uuid
  ].map(normalizeKey).filter(Boolean);
  const needle = normalizeKey(query);
  if (!needle) return false;
  return candidates.some((candidate) => candidate === needle || candidate.includes(needle));
}

export function findTextWorldObject(context, query) {
  const periphery = collectTextWorldPeriphery(context);
  const origin = context.controls?.getObject?.()?.position || context.camera?.position;
  const forward = new context.THREE.Vector3();
  if (context.camera?.getWorldDirection) context.camera.getWorldDirection(forward);
  else if (context.controls?.getDirection) context.controls.getDirection(forward);
  if (forward.lengthSq() < 1e-8) forward.set(0, 0, -1);
  const visible = (Array.isArray(context.objects) ? context.objects : [])
    .filter((object) => object?.visible !== false)
    .map((object) => objectEntry(context.THREE, object, origin, forward))
    .filter(Boolean);
  return periphery.find((entry) => matchesObject(entry, query))
    || visible.find((entry) => matchesObject(entry, query))
    || null;
}

export function formatTextWorldObjectList(entries) {
  if (!entries.length) return "No objects are in your periphery.";
  const noun = entries.length === 1 ? "object is" : "objects are";
  const lines = [`${entries.length} ${noun} in your periphery:`];
  entries.slice(0, 12).forEach((entry) => {
    lines.push(`- ${entry.label} (${entry.type}), ${entry.direction}, ${entry.distance.toFixed(1)}m`);
  });
  if (entries.length > 12) lines.push(`- ${entries.length - 12} more farther out.`);
  return lines.join("\n");
}

export function describeTextWorldObject(entry) {
  if (!entry) return "No matching object was found.";
  const data = entry.object?.userData || {};
  const lines = [
    `${entry.label} (${entry.type})`,
    `Location: ${entry.direction}, ${entry.distance.toFixed(1)}m away.`,
    `Position: ${entry.position.x.toFixed(2)}, ${entry.position.y.toFixed(2)}, ${entry.position.z.toFixed(2)}.`
  ];
  if (data.materialName || data.physicsMaterialId) {
    lines.push(`Material: ${cleanText(data.materialName || data.physicsMaterialId)}.`);
  }
  if (data.isPortal === true || normalizeKey(data.nvType) === "portal") {
    const target = data.portalTarget || (data.portalSameWorld ? "this world" : "");
    const linked = data.portalLinkedPortalId ? ` linked to ${data.portalLinkedPortalId}` : "";
    lines.push(`Portal destination: ${cleanText(target || "unspecified")}${linked}.`);
  }
  if (data.soundObject || data.audioAssetPath) {
    lines.push(`Sound source: ${cleanText(data.soundSource || data.audioAssetPath || "embedded audio")}.`);
  }
  if (data.iframeObject || data.iframeSrc) {
    lines.push(`Embedded page: ${cleanText(data.iframeTitle || data.iframeSrc || "untitled")}.`);
  }
  if (data.equationExpression) lines.push(`Expression: ${cleanText(data.equationExpression)}.`);
  return lines.join("\n");
}
