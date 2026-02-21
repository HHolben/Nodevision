import { NvEntity, NvMob, NvNPC, NvPlayer } from "./NvEntity.mjs";
import { NV_PRIM_TYPES, normalizePrim, validatePrim } from "./primSchema.mjs";

function entityDataFromPrim(prim) {
  const a = prim.attributes || {};
  const rel = prim.relationships || {};
  return {
    id: prim.id,
    primId: prim.id,
    position: a.position,
    rotation: a.rotation,
    health: a.health,
    faction: rel.faction || a.faction || "neutral",
    aiControllerId: rel.aiController || null,
    targetId: rel.target || null,
    moveSpeed: a.moveSpeed,
    attackRange: a.attackRange,
    viewRange: a.viewRange,
    attackDamage: a.attackDamage,
    attackCooldownSec: a.attackCooldownSec,
    aggressive: a.aggressive
  };
}

export function entityFromPrim(prim) {
  validatePrim(prim);
  const p = normalizePrim(prim);

  if (p.type === NV_PRIM_TYPES.NvPlayer) return new NvPlayer(entityDataFromPrim(p));
  if (p.type === NV_PRIM_TYPES.NvNPC) return new NvNPC(entityDataFromPrim(p));
  if (p.type === NV_PRIM_TYPES.NvMob) return new NvMob(entityDataFromPrim(p));
  if (p.type === NV_PRIM_TYPES.NvEntity) return new NvEntity(entityDataFromPrim(p));

  return null;
}

export function buildPrimIndex(worldPrims = []) {
  const byId = new Map();
  for (const prim of worldPrims) {
    validatePrim(prim);
    byId.set(prim.id, normalizePrim(prim));
  }
  return byId;
}
