// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/GameViewDependencies/Abilities/CraftAbilities/VoxelMaterialConfigAbility.mjs
// This file defines Voxel Placer material configuration for Game View craft abilities. It normalizes size, color, collider, and material metadata while keeping catalog loading reusable.

import { loadWorldObjectMaterialCatalog, materialFileForWorldObjectMaterial } from "/MetaWorld/Materials/WorldObjectMaterialDefaults.mjs";
import { installMovementApi } from "../movementContext.mjs";

export function installVoxelMaterialConfigAbility(ctx) {
  const { movementState } = ctx;

  function normalizeVoxelSize(value, fallback = ctx.DEFAULT_VOXEL_PLACER_CONFIG.size) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return fallback;
    return Math.max(0.05, Math.min(20, numeric));
  }

  function isHexDigitChar(ch) {
    return "0123456789abcdefABCDEF".includes(ch);
  }

  function normalizeVoxelColor(value, fallback = ctx.DEFAULT_VOXEL_PLACER_CONFIG.color) {
    const text = typeof value === "string" ? value.trim() : "";
    if ((text.length === 4 || text.length === 7) && text[0] === "#") {
      let ok = true;
      for (let i = 1; i < text.length; i += 1) {
        if (!isHexDigitChar(text[i])) ok = false;
      }
      if (ok) return text;
    }
    return fallback;
  }

  function normalizeVoxelOpacity(value, fallback = ctx.DEFAULT_VOXEL_PLACER_CONFIG.opacity) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return fallback;
    return Math.max(0, Math.min(1, numeric));
  }

  function ensureVoxelPlacerConfig() {
    const existing = movementState.voxelPlacerConfig && typeof movementState.voxelPlacerConfig === "object" ? movementState.voxelPlacerConfig : {};
    const materialId = String(existing.materialId || ctx.DEFAULT_VOXEL_PLACER_CONFIG.materialId).trim() || ctx.DEFAULT_VOXEL_PLACER_CONFIG.materialId;
    const config = {
      size: normalizeVoxelSize(existing.size),
      materialId,
      materialFile: String(existing.materialFile || materialFileForWorldObjectMaterial(materialId) || ctx.DEFAULT_VOXEL_PLACER_CONFIG.materialFile),
      materialName: typeof existing.materialName === "string" ? existing.materialName : "",
      matterState: typeof existing.matterState === "string" ? existing.matterState : "",
      color: normalizeVoxelColor(existing.color),
      opacity: normalizeVoxelOpacity(existing.opacity),
      collider: existing.collider !== false
    };
    movementState.voxelPlacerConfig = config;
    return config;
  }

  function ensureVoxelMaterialCatalog() {
    if (!ctx.voxelMaterialCatalogPromise) {
      ctx.voxelMaterialCatalogPromise = loadWorldObjectMaterialCatalog().catch((err) => {
        console.warn("Voxel material catalog failed to load:", err);
        return [];
      });
    }
    return ctx.voxelMaterialCatalogPromise;
  }

  function findVoxelMaterialEntry(materialId, catalog = []) {
    const key = String(materialId || "").trim().toLowerCase();
    return (Array.isArray(catalog) ? catalog : []).find((entry) => String(entry?.materialId || "").trim().toLowerCase() === key) || null;
  }

  function voxelColorFromMaterialEntry(entry, fallback = ctx.DEFAULT_VOXEL_PLACER_CONFIG.color) {
    return normalizeVoxelColor(entry?.color || entry?.materialDefinition?.defaultColor || entry?.materialDefinition?.rendering?.color, fallback);
  }

  function applyVoxelMaterialEntry(config, entry, { updateColor = false } = {}) {
    if (!entry) return config;
    config.materialId = String(entry.materialId || config.materialId || ctx.DEFAULT_VOXEL_PLACER_CONFIG.materialId);
    config.materialFile = String(entry.materialFile || materialFileForWorldObjectMaterial(config.materialId) || "");
    config.materialName = String(entry.displayName || entry.materialName || config.materialId || "");
    config.matterState = String(entry.matterState || entry.MatterState || config.matterState || "");
    if (updateColor) config.color = voxelColorFromMaterialEntry(entry, config.color);
    return config;
  }

  return installMovementApi(ctx, {
    normalizeVoxelSize,
    isHexDigitChar,
    normalizeVoxelColor,
    normalizeVoxelOpacity,
    ensureVoxelPlacerConfig,
    ensureVoxelMaterialCatalog,
    findVoxelMaterialEntry,
    voxelColorFromMaterialEntry,
    applyVoxelMaterialEntry
  });
}
