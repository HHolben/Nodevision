// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/GameViewDependencies/gravityModel.mjs
// This file defines shared MetaWorld gravity model normalization helpers used by loading, saving, world properties, and player movement.

export const DEFAULT_GRAVITY_MODEL = {
  mode: "flat",
  flatG: 0.012,
  bigG: 0.001,
  mass: 1000,
  position: { x: 0, y: 0, z: 0 },
  pointObjectId: "",
  surfaceKickRange: 6,
  propellantImpulse: 0.28
};

function finiteNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clampNumber(value, min, max, fallback) {
  return Math.min(max, Math.max(min, finiteNumber(value, fallback)));
}

function normalizeMode(value) {
  const mode = String(value || "").trim().toLowerCase().replace(/[_\s]+/g, "-");
  if (mode === "point" || mode === "pointmass" || mode === "point-mass") return "point-mass";
  if (mode === "none" || mode === "zero" || mode === "zero-g" || mode === "0g" || mode === "g") return "none";
  return "flat";
}

function vectorComponent(source, key, index, fallback) {
  if (Array.isArray(source)) return finiteNumber(source[index], fallback);
  return finiteNumber(source?.[key], fallback);
}

function normalizePosition(raw, fallback = DEFAULT_GRAVITY_MODEL.position) {
  const source = raw && typeof raw === "object" ? raw : fallback;
  return {
    x: vectorComponent(source, "x", 0, fallback.x),
    y: vectorComponent(source, "y", 1, fallback.y),
    z: vectorComponent(source, "z", 2, fallback.z)
  };
}

export function normalizeGravityModel(raw = {}) {
  const source = raw && typeof raw === "object" ? raw : {};
  const pointMass = source.pointMass && typeof source.pointMass === "object" ? source.pointMass : {};
  return {
    mode: normalizeMode(source.mode ?? source.type ?? source.gravityMode),
    flatG: clampNumber(source.flatG ?? source.littleG ?? source.g, 0, 4, DEFAULT_GRAVITY_MODEL.flatG),
    bigG: clampNumber(source.bigG ?? source.G ?? pointMass.bigG, 0, 1000000, DEFAULT_GRAVITY_MODEL.bigG),
    mass: clampNumber(source.mass ?? pointMass.mass, 0, 1000000000, DEFAULT_GRAVITY_MODEL.mass),
    position: normalizePosition(source.position ?? source.point ?? pointMass.position ?? pointMass.point),
    pointObjectId: String(source.pointObjectId ?? source.objectId ?? pointMass.pointObjectId ?? pointMass.objectId ?? "").trim(),
    surfaceKickRange: clampNumber(source.surfaceKickRange ?? source.range, 0.1, 1000, DEFAULT_GRAVITY_MODEL.surfaceKickRange),
    propellantImpulse: clampNumber(source.propellantImpulse ?? source.kickImpulse, 0.001, 1000, DEFAULT_GRAVITY_MODEL.propellantImpulse)
  };
}

export function readWorldGravityModel(worldData = {}, fallback = DEFAULT_GRAVITY_MODEL) {
  return normalizeGravityModel(
    worldData?.gravityModel
    || worldData?.metadata?.gravityModel
    || worldData?.physics?.gravityModel
    || fallback
  );
}
