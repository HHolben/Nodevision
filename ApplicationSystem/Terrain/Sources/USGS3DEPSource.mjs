// Nodevision/ApplicationSystem/Terrain/Sources/USGS3DEPSource.mjs
// USGS 3DEP source adapter. This phase estimates and records metadata; live download remains server-side future work.

import { TerrainSourceAdapter } from "../TerrainSourceAdapter.mjs";

function intersects(a, b) {
  return !(a.east < b.west || a.west > b.east || a.north < b.south || a.south > b.north);
}

const USGS_APPROXIMATE_COVERAGE = [
  { name: "CONUS", west: -125, south: 24, east: -66, north: 50 },
  { name: "Alaska", west: -170, south: 51, east: -129, north: 72 },
  { name: "Hawaii", west: -161, south: 18, east: -154, north: 23 },
  { name: "Puerto Rico", west: -68, south: 17, east: -64, north: 19 },
  { name: "US Virgin Islands", west: -65.2, south: 17.5, east: -64.4, north: 18.6 },
];

export class USGS3DEPSource extends TerrainSourceAdapter {
  get id() { return "usgs-3dep"; }
  get displayName() { return "USGS 3DEP"; }

  async supportsRegion(region) {
    const bounds = region?.bounds;
    if (!bounds) return { supported: false, confidence: "none", reason: "Region bounds are required for USGS 3DEP coverage." };
    const matches = USGS_APPROXIMATE_COVERAGE.filter((candidate) => intersects(bounds, candidate));
    if (!matches.length) return { supported: false, confidence: "high", reason: "Selected region is outside the USGS 3DEP coverage envelope used by this offline-safe estimator." };
    return {
      supported: true,
      confidence: "approximate",
      coverageNames: matches.map((item) => item.name),
      reason: "USGS 3DEP is preferred inside supported United States coverage. This phase records estimated coverage; exact 3DEP product metadata is checked by a future live-service pass.",
    };
  }

  async estimateRequest(region, options = {}) {
    const support = await this.supportsRegion(region, options);
    const resolutionMeters = support.supported ? 10 : null;
    return {
      source: this.id,
      displayName: this.displayName,
      supported: support.supported,
      coverageConfidence: support.confidence,
      nativeResolutionMeters: resolutionMeters,
      terrainModel: "bare-earth-dem",
      warnings: support.reason ? [support.reason] : [],
      estimatedBytes: support.supported ? Math.ceil((region.areaSquareMeters || 0) / Math.max(1, resolutionMeters * resolutionMeters) * 4) : 0,
    };
  }

  getAttribution() {
    return "Elevation data attribution: U.S. Geological Survey 3D Elevation Program (3DEP), The National Map.";
  }

  getLicenseMetadata() {
    return {
      source: this.id,
      displayName: this.displayName,
      licenses: [{ name: "USGS public domain", url: "https://www.usgs.gov/information-policies-and-instructions/copyrights-and-credits" }],
      terrainModel: "bare-earth-dem",
    };
  }
}
