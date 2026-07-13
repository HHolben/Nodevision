// Nodevision/ApplicationSystem/Terrain/Sources/FAAVFRChartSource.mjs
// FAA VFR chart intersection estimator for terrain offline packages.

function intersectsBounds(a, b) {
  return !(a.east < b.west || a.west > b.east || a.north < b.south || a.south > b.north);
}

const SECTIONAL_BOUNDS = [
  { chartName: "Atlanta", chartType: "Sectional", west: -88.5, south: 29, east: -80, north: 36.8 },
  { chartName: "Charlotte", chartType: "Sectional", west: -84.8, south: 32.4, east: -77, north: 38.2 },
  { chartName: "Cincinnati", chartType: "Sectional", west: -88.5, south: 36.2, east: -80.8, north: 42.5 },
  { chartName: "Washington", chartType: "Sectional", west: -81.8, south: 35.8, east: -73.3, north: 41.8 },
  { chartName: "New York", chartType: "Sectional", west: -77.8, south: 38.7, east: -69.5, north: 45.5 },
  { chartName: "Chicago", chartType: "Sectional", west: -91.5, south: 39.5, east: -83, north: 46.5 },
  { chartName: "St. Louis", chartType: "Sectional", west: -94.8, south: 35.5, east: -86.2, north: 41.8 },
  { chartName: "Kansas City", chartType: "Sectional", west: -99.8, south: 35.5, east: -91.3, north: 41.8 },
  { chartName: "Denver", chartType: "Sectional", west: -109.8, south: 36, east: -101, north: 42.8 },
  { chartName: "Salt Lake City", chartType: "Sectional", west: -116.8, south: 37.2, east: -108, north: 43.8 },
  { chartName: "Phoenix", chartType: "Sectional", west: -115.4, south: 30.8, east: -108.8, north: 36.8 },
  { chartName: "Los Angeles", chartType: "Sectional", west: -122.5, south: 31.8, east: -114.2, north: 37.8 },
  { chartName: "San Francisco", chartType: "Sectional", west: -124.8, south: 35.2, east: -118.3, north: 41.8 },
  { chartName: "Seattle", chartType: "Sectional", west: -125.8, south: 43.8, east: -116.5, north: 49.5 },
  { chartName: "Miami", chartType: "Sectional", west: -84.2, south: 24, east: -77.5, north: 30.8 },
  { chartName: "Houston", chartType: "Sectional", west: -99, south: 27.2, east: -91.5, north: 33.2 },
  { chartName: "Dallas-Ft Worth", chartType: "Sectional", west: -101.5, south: 30.5, east: -94, north: 36.8 },
  { chartName: "Anchorage", chartType: "Sectional", west: -156, south: 58, east: -145, north: 64 },
  { chartName: "Hawaiian Islands", chartType: "Sectional", west: -161.5, south: 18.5, east: -154, north: 23 },
];

export class FAAVFRChartSource {
  constructor({ now = () => new Date() } = {}) {
    this.now = now;
  }

  selectIntersectingCharts(region) {
    const bounds = region?.bounds;
    if (!bounds) return [];
    return SECTIONAL_BOUNDS
      .filter((chart) => intersectsBounds(bounds, chart))
      .map((chart) => ({
        chartType: chart.chartType,
        chartName: chart.chartName,
        edition: "unknown-offline-estimate",
        effectiveDate: null,
        expirationDate: null,
        downloadedAt: null,
        source: "FAA",
        sourceUrl: "recorded-after-download",
        file: null,
        checksum: null,
        intersectsRegion: true,
        availableOffline: false,
        currentForNavigation: false,
        note: "Intersection estimated from coarse chart bounds. Download/verification is required before offline display.",
      }));
  }
}
