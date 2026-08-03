// Nodevision/ApplicationSystem/Terrain/TerrainSourceRegistry.mjs
// This module registers terrain data sources and chooses a supported source based on offline package request settings.

import { USGS3DEPSource } from "./Sources/USGS3DEPSource.mjs";
import { CopernicusDEMSource } from "./Sources/CopernicusDEMSource.mjs";
import { MapzenTerrainSource } from "./Sources/MapzenTerrainSource.mjs";

export class TerrainSourceRegistry {
  constructor() {
    this.adapters = new Map();
  }

  register(adapter) {
    if (!adapter?.id) throw new Error("Terrain source adapter must expose an id.");
    this.adapters.set(adapter.id, adapter);
    return this;
  }

  get(id) {
    return this.adapters.get(String(id || ""));
  }

  list() {
    return Array.from(this.adapters.values());
  }
}

export function createDefaultTerrainSourceRegistry() {
  return new TerrainSourceRegistry()
    .register(new USGS3DEPSource())
    .register(new CopernicusDEMSource())
    .register(new MapzenTerrainSource());
}
