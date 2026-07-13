// Nodevision/ApplicationSystem/Terrain/Sources/MapzenTerrainSource.mjs
// Mapzen Terrain Tiles adapter and attribution metadata.

import { TerrainSourceAdapter } from "../TerrainSourceAdapter.mjs";

export class MapzenTerrainSource extends TerrainSourceAdapter {
  get id() { return "mapzen"; }
  get displayName() { return "Mapzen Terrain Tiles"; }

  async supportsRegion(region) {
    const bounds = region?.bounds;
    if (!bounds) return { supported: false, confidence: "none", reason: "Region bounds are required for Mapzen coverage." };
    if (bounds.south < -85.051129 || bounds.north > 85.051129) {
      return { supported: false, confidence: "high", reason: "Mapzen web-mercator terrain tiles are not available near the poles." };
    }
    return { supported: true, confidence: "global", reason: "Mapzen terrain tiles are available as a global open fallback where web-mercator tiles exist." };
  }

  async estimateRequest(region, options = {}) {
    const support = await this.supportsRegion(region, options);
    const resolutionMeters = 90;
    return {
      source: this.id,
      displayName: this.displayName,
      supported: support.supported,
      coverageConfidence: support.confidence,
      nativeResolutionMeters: resolutionMeters,
      terrainModel: "mixed-dem-surface-model",
      warnings: support.reason ? [support.reason] : [],
      estimatedBytes: support.supported ? Math.ceil((region.areaSquareMeters || 0) / Math.max(1, resolutionMeters * resolutionMeters) * 4) : 0,
      tileEncoding: "terrarium-png",
    };
  }

  getAttribution() {
    return "Elevation fallback attribution: Mapzen Terrain Tiles on AWS, derived from open elevation sources.";
  }

  getLicenseMetadata() {
    return {
      source: this.id,
      displayName: this.displayName,
      licenses: [{ name: "Mapzen Terrain Tiles attribution required", url: "https://registry.opendata.aws/terrain-tiles/" }],
      tileEncoding: "terrarium-png",
    };
  }
}
