// Nodevision/ApplicationSystem/Terrain/Sources/CopernicusDEMSource.mjs
// Copernicus DEM source adapter. Credentials/download plumbing is intentionally not embedded in browser code.

import { TerrainSourceAdapter } from "../TerrainSourceAdapter.mjs";

export class CopernicusDEMSource extends TerrainSourceAdapter {
  get id() { return "copernicus-dem"; }
  get displayName() { return "Copernicus DEM"; }

  async supportsRegion(region) {
    const bounds = region?.bounds;
    if (!bounds) return { supported: false, confidence: "none", reason: "Region bounds are required for Copernicus DEM coverage." };
    if (bounds.south < -90 || bounds.north > 90) return { supported: false, confidence: "high", reason: "Region latitude is outside supported Earth coverage." };
    return {
      supported: true,
      confidence: "global",
      reason: "Copernicus DEM is a global digital surface model; buildings and vegetation may be represented in heights.",
    };
  }

  async estimateRequest(region, options = {}) {
    const support = await this.supportsRegion(region, options);
    const preset = String(options.qualityPreset || "preview");
    const resolutionMeters = preset.includes("high") ? 30 : preset.includes("low") ? 90 : 30;
    return {
      source: this.id,
      displayName: this.displayName,
      supported: support.supported,
      coverageConfidence: support.confidence,
      nativeResolutionMeters: resolutionMeters,
      terrainModel: "digital-surface-model",
      warnings: support.reason ? [support.reason] : [],
      estimatedBytes: support.supported ? Math.ceil((region.areaSquareMeters || 0) / Math.max(1, resolutionMeters * resolutionMeters) * 4) : 0,
    };
  }

  getAttribution() {
    return "Elevation data attribution: Copernicus DEM. Copernicus DEM is a digital surface model and may include above-ground features.";
  }

  getLicenseMetadata() {
    return {
      source: this.id,
      displayName: this.displayName,
      licenses: [{ name: "Copernicus DEM distribution terms", url: "https://spacedata.copernicus.eu/collections/copernicus-digital-elevation-model" }],
      terrainModel: "digital-surface-model",
      credentialConfiguration: "Configure any authenticated Copernicus access server-side through environment or Nodevision settings; do not commit tokens.",
    };
  }
}
