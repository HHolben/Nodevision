// Nodevision/ApplicationSystem/Terrain/TerrainSourceAdapter.mjs
// Base adapter contract for terrain and chart data sources.

export class TerrainSourceAdapter {
  get id() { return "base"; }
  get displayName() { return "Terrain Source"; }

  async supportsRegion(_region, _options = {}) {
    return { supported: false, confidence: "none", reason: "Base terrain adapter cannot serve regions." };
  }

  async queryCoverage(region, options = {}) {
    return this.supportsRegion(region, options);
  }

  async estimateRequest(region, options = {}) {
    const support = await this.supportsRegion(region, options);
    return { supported: support.supported, source: this.id, displayName: this.displayName, warnings: support.reason ? [support.reason] : [] };
  }

  async fetchElevation() {
    throw new Error(`${this.displayName} live elevation retrieval is not implemented in this Nodevision phase.`);
  }

  async fetchPreview() {
    throw new Error(`${this.displayName} preview retrieval is not implemented in this Nodevision phase.`);
  }

  getAttribution() { return ""; }
  getLicenseMetadata() { return { source: this.id, displayName: this.displayName, licenses: [] }; }
}
