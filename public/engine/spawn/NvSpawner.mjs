import { validatePrim } from "../entities/primSchema.mjs";

function toBounds(region) {
  const min = Array.isArray(region?.min) ? region.min : [-1, 0, -1];
  const max = Array.isArray(region?.max) ? region.max : [1, 0, 1];
  return {
    min: [Number(min[0]) || 0, Number(min[1]) || 0, Number(min[2]) || 0],
    max: [Number(max[0]) || 0, Number(max[1]) || 0, Number(max[2]) || 0]
  };
}

function randomInBounds(bounds, rng) {
  const rx = rng.nextFloat();
  const ry = rng.nextFloat();
  const rz = rng.nextFloat();
  return [
    bounds.min[0] + (bounds.max[0] - bounds.min[0]) * rx,
    bounds.min[1] + (bounds.max[1] - bounds.min[1]) * ry,
    bounds.min[2] + (bounds.max[2] - bounds.min[2]) * rz
  ];
}

export class NvSpawner {
  constructor({ id, templateRef, maxCount = 3, cooldownSec = 8, regionBounds, active = true } = {}) {
    this.id = String(id || "");
    this.templateRef = String(templateRef || "");
    this.maxCount = Math.max(0, Number(maxCount) || 0);
    this.cooldownSec = Math.max(0, Number(cooldownSec) || 0);
    this.regionBounds = toBounds(regionBounds);
    this.active = Boolean(active);

    this._cooldownRemaining = 0;
    this._spawnedIds = new Set();
    this._spawnIndex = 1;
  }

  trackExisting(entityId) {
    this._spawnedIds.add(String(entityId));
  }

  removeTracked(entityId) {
    this._spawnedIds.delete(String(entityId));
  }

  update(deltaTime, context) {
    if (!this.active) return [];

    const dt = Math.max(0, Number(deltaTime) || 0);
    this._cooldownRemaining = Math.max(0, this._cooldownRemaining - dt);

    for (const entityId of [...this._spawnedIds]) {
      const entity = context.entities.get(entityId);
      if (!entity || !entity.alive) this._spawnedIds.delete(entityId);
    }

    const available = this.maxCount - this._spawnedIds.size;
    if (available <= 0 || this._cooldownRemaining > 0) return [];

    const template = context.templates.get(this.templateRef);
    if (!template) return [];

    const newPrimId = `${this.id}-spawn-${this._spawnIndex++}`;
    const position = randomInBounds(this.regionBounds, context.rng);
    const prim = template.instantiate({ id: newPrimId, position });

    this._cooldownRemaining = this.cooldownSec;
    return [prim];
  }
}

export function spawnerFromPrim(prim) {
  validatePrim(prim);
  if (prim.type !== "NvSpawner") {
    throw new Error(`Expected NvSpawner prim, got ${prim.type}`);
  }

  const attrs = prim.attributes || {};
  const rel = prim.relationships || {};
  return new NvSpawner({
    id: prim.id,
    templateRef: rel.template || attrs.template || "",
    maxCount: attrs.maxCount,
    cooldownSec: attrs.cooldownSec,
    regionBounds: attrs.regionBounds,
    active: attrs.active !== false
  });
}
