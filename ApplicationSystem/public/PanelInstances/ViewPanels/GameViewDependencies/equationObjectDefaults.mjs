// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/GameViewDependencies/equationObjectDefaults.mjs
// This module defines equation-object defaults and shared helpers for numeric inputs, opacity, colors, and physical material matching.

import { DEFAULT_WORLD_OBJECT_MATERIAL_FILE, DEFAULT_WORLD_OBJECT_MATERIAL_ID,
  isLiquidWorldObjectMaterial, materialFileForWorldObjectMaterial } from "/MetaWorld/Materials/WorldObjectMaterialDefaults.mjs";
import { parseAxisInequalityText } from "./equationColliderTool.mjs";

// Default form values and material identity.
export const DEFAULT_PLANE = {
  a: 0,
  b: 0,
  c: 1,
  d: 0,
  xmin: -15,
  xmax: 15,
  ymin: -15,
  ymax: 15,
  zmin: -15,
  zmax: 15,
  thickness: 0.2,
  boundX: false,
  boundY: false,
  boundZ: false,
  collider: true,
  color: "#61d6d6",
  opacity: 0.34,
  inequality: false,
  operator: "",
  expression: "z = 0",
  equationExpression: "z = 0"
};

export const DEFAULT_MATERIAL_OPTION = {
  materialName: "Physics Solid",
  displayName: "Physics Solid",
  materialId: DEFAULT_WORLD_OBJECT_MATERIAL_ID,
  materialFile: DEFAULT_WORLD_OBJECT_MATERIAL_FILE,
  materialJSONfile: "Materials/Solids/PhysicsSolid.json",
  matterState: "",
};

export function materialOptionValue(entry) {
  return entry?.materialFile || (entry?.materialId ? materialFileForWorldObjectMaterial(entry.materialId) : "");
}

export function materialFileName(value) {
  return String(value || "").split("/").pop().toLowerCase();
}

export function materialEntryMatchesHint(entry, hint = {}) {
  if (!entry) return false;
  const entryFile = materialOptionValue(entry);
  const hintFile = hint.materialFile || hint.physicsMaterialFile || "";
  const hintId = hint.materialId || hint.physicsMaterialId || "";
  if (hintFile && (entryFile === hintFile || materialFileName(entryFile) === materialFileName(hintFile))) return true;
  if (hintId && String(entry.materialId || "").toLowerCase() === String(hintId).toLowerCase()) return true;
  return false;
}

export function isLiquidMaterialEntry(entry) {
  return isLiquidWorldObjectMaterial(entry || {});
}

export function parseNumber(value, fallback) {
  const n = Number.parseFloat(value);
  return Number.isFinite(n) ? n : fallback;
}

export function clampOpacity(value, fallback = DEFAULT_PLANE.opacity) {
  const n = Number.parseFloat(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(1, n));
}

export function alphaPercentFromOpacity(value, fallback = DEFAULT_PLANE.opacity) {
  return Math.round(clampOpacity(value, fallback) * 100);
}

export function firstMaterialOpacity(target, fallback = DEFAULT_PLANE.opacity) {
  const material = Array.isArray(target?.material) ? target.material[0] : target?.material;
  return Number.isFinite(material?.opacity) ? clampOpacity(material.opacity, fallback) : fallback;
}

export function syncAlphaControl(input, label) {
  if (!input) return;
  const value = Math.round(Math.max(0, Math.min(100, Number.parseFloat(input.value) || 0)));
  input.value = String(value);
  if (label) label.textContent = value + "%";
}

export function firstColorHex(target) {
  const material = Array.isArray(target?.material) ? target.material[0] : target?.material;
  return material?.color?.isColor ? `#${material.color.getHexString()}` : DEFAULT_PLANE.color;
}

export function applyColor(target, colorHex, THREE, options = {}) {
  const liquid = options.liquid === true || options.water === true;
  const opacity = clampOpacity(options.opacity, liquid ? 0.48 : DEFAULT_PLANE.opacity);
  const materials = Array.isArray(target?.material) ? target.material : [target?.material];
  materials.forEach((mat) => {
    if (!mat) return;
    if (mat.color) mat.color.set(colorHex);
    mat.transparent = opacity < 1;
    mat.opacity = opacity;
    mat.depthWrite = opacity >= 1;
    mat.side = THREE.DoubleSide;
    if (mat.emissive?.set) mat.emissive.set(colorHex);
    if (Number.isFinite(mat.emissiveIntensity) || liquid) mat.emissiveIntensity = liquid ? 0.22 : Math.min(mat.emissiveIntensity || 0.18, 0.22);
    mat.needsUpdate = true;
  });
}

export function parseAxisInequality(text) {
  return parseAxisInequalityText(text);
}
