// Nodevision/ApplicationSystem/public/MetaWorld/Materials/MaterialIdentity.mjs
// This module provides material identity behavior shared by Nodevision world objects, equations, and voxels.

import { WORLD_OBJECT_MATERIAL_LIBRARY_PATH, DEFAULT_WORLD_OBJECT_MATERIAL_ID, DEFAULT_WORLD_OBJECT_MATERIAL_ROWS, CANONICAL_MATERIAL_IDS } from './MaterialCatalogRows.mjs';

export function stripMaterialFileName(value) {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) return "";
  const fileName = text.split("/").pop() || text;
  return fileName.replace(/\.json$/i, "").trim();
}

export function normalizeCatalogMaterialFile(value) {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) return "";
  if (/^https?:\/\//i.test(text) || text.startsWith("/")) return text;
  const relative = text.replace(/^\.\//, "");
  if (relative.startsWith("MetaWorld/")) return "/" + relative;
  if (relative.includes("/")) return "/MetaWorld/" + relative;
  return WORLD_OBJECT_MATERIAL_LIBRARY_PATH + "/" + relative;
}

export function normalizeWorldObjectMaterialId(value, fallback = "") {
  const raw = stripMaterialFileName(value);
  if (!raw) return stripMaterialFileName(fallback);
  return CANONICAL_MATERIAL_IDS.get(raw.toLowerCase()) || raw;
}

export let defaultWorldObjectMaterialFileMap = null;

export function defaultMaterialFilesById() {
  if (defaultWorldObjectMaterialFileMap) return defaultWorldObjectMaterialFileMap;
  defaultWorldObjectMaterialFileMap = new Map();
  DEFAULT_WORLD_OBJECT_MATERIAL_ROWS.forEach((row) => {
    const materialFile = normalizeCatalogMaterialFile(row.MaterialJSONfile);
    const materialId = normalizeWorldObjectMaterialId(materialFile, row.MaterialName);
    if (materialId && materialFile) defaultWorldObjectMaterialFileMap.set(materialId.toLowerCase(), materialFile);
    const displayId = normalizeWorldObjectMaterialId(row.MaterialName, "");
    if (displayId && materialFile) defaultWorldObjectMaterialFileMap.set(displayId.toLowerCase(), materialFile);
  });
  return defaultWorldObjectMaterialFileMap;
}

export function rememberMaterialCatalogFiles(entries = []) {
  const map = defaultMaterialFilesById();
  for (const entry of entries || []) {
    const id = normalizeWorldObjectMaterialId(entry?.materialId || entry?.materialName || "", "");
    const file = String(entry?.materialFile || "").trim();
    if (id && file) map.set(id.toLowerCase(), file);
  }
}

export function materialFileForWorldObjectMaterial(value) {
  const id = normalizeWorldObjectMaterialId(value, "");
  if (!id) return "";
  const mapped = defaultMaterialFilesById().get(id.toLowerCase());
  return mapped || WORLD_OBJECT_MATERIAL_LIBRARY_PATH + "/" + id + ".json";
}

export function normalizeWorldObjectMatterState(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export function readWorldObjectMatterState(def = {}, fallback = "") {
  const candidates = [
    def?.MatterState,
    def?.matterState,
    def?.stateOfMatter,
    def?.material?.MatterState,
    def?.material?.matterState,
    def?.collider?.MatterState,
    def?.collider?.matterState,
    def?.collider?.state,
  ];
  for (const candidate of candidates) {
    const state = normalizeWorldObjectMatterState(candidate);
    if (state) return state;
  }
  if (def?.isWater === true || def?.isLiquid === true || def?.water === true || def?.liquid === true) return "liquid";
  return normalizeWorldObjectMatterState(fallback);
}

export function isLiquidWorldObjectMaterial(def = {}) {
  return readWorldObjectMatterState(def) === "liquid";
}

export function pushIfString(target, value) {
  if (typeof value === "string" && value.trim()) target.push(value.trim());
}

export function readWorldObjectPhysicsMaterialId(def = {}, fallback = "") {
  const candidates = [];
  pushIfString(candidates, def?.physicsMaterialId);
  pushIfString(candidates, def?.physicsMaterial);
  pushIfString(candidates, def?.worldObjectMaterialId);
  pushIfString(candidates, def?.colliderMaterialId);
  pushIfString(candidates, def?.collider?.materialId);

  const material = def?.material;
  if (typeof material === "string") {
    pushIfString(candidates, material);
  } else if (material && typeof material === "object") {
    pushIfString(candidates, material.physicsMaterialId);
    pushIfString(candidates, material.id);
    pushIfString(candidates, material.name);
  }

  const directMaterialType = typeof def?.materialType === "string" ? def.materialType.trim().toLowerCase() : "";
  if (directMaterialType === "water") candidates.push("water");

  for (const candidate of candidates) {
    const normalized = normalizeWorldObjectMaterialId(candidate, "");
    if (normalized) return normalized;
  }
  return normalizeWorldObjectMaterialId(fallback, "");
}

export function applyDefaultWorldObjectPhysicsMaterial(def = {}, { force = false } = {}) {
  if (!def || typeof def !== "object") return def;
  const existing = readWorldObjectPhysicsMaterialId(def, "");
  const materialId = !force && existing ? existing : DEFAULT_WORLD_OBJECT_MATERIAL_ID;
  def.physicsMaterialId = materialId;
  if (!def.physicsMaterialFile || force) {
    def.physicsMaterialFile = materialFileForWorldObjectMaterial(materialId);
  }
  return def;
}
