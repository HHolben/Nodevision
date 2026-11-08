// Nodevision/ApplicationSystem/public/MetaWorld/TerrainLOD/ResidencyVersion.mjs
// These small collection variants expose structural revisions so visual ownership can update when residency changes rather than rescan unchanged columns every frame. Entries retain normal Map and Set semantics.
export class RevisionMap extends Map {
  revision = 0;
  set(key, value) { if (!this.has(key) || this.get(key) !== value) this.revision++; return super.set(key, value); }
  delete(key) { const removed = super.delete(key); if (removed) this.revision++; return removed; }
  clear() { if (this.size) this.revision++; super.clear(); }
}
export class RevisionSet extends Set {
  revision = 0;
  add(value) { if (!this.has(value)) this.revision++; return super.add(value); }
  delete(value) { const removed = super.delete(value); if (removed) this.revision++; return removed; }
  clear() { if (this.size) this.revision++; super.clear(); }
}
export function coverageVersion(manager) {
  const values = [manager.loaded.revision, manager.columnLevels?.revision, manager.invalidated?.revision];
  return values.every(Number.isFinite) ? values.join(':') : null;
}
