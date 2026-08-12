// Nodevision/ApplicationSystem/Aviation/SectionalMaps/FaaSectionalProvider.mjs
// This module discovers FAA VFR Sectional GeoTIFF ZIP packages from the official FAA raster chart page.

export const FAA_VFR_RASTER_CHARTS_URL = "https://www.faa.gov/air_traffic/flight_info/aeronav/digital_products/vfr/";
export const NODEVISION_FAA_USER_AGENT = "NodevisionSectionalUpdater/1.0 local Nodevision app";

export function normalizeChartKey(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
}

export function displayEdition(value) {
  const text = String(value || "").trim();
  const compact = /^(\d{4})(\d{2})(\d{2})$/.exec(text);
  if (compact) return `${compact[2]}-${compact[3]}-${compact[1]}`;
  const slug = /^(\d{2})-(\d{2})-(\d{4})$/.exec(text);
  if (slug) return text;
  return text;
}

function chartNameFromFilename(filename) {
  return String(filename || "sectional.zip")
    .replace(/\.zip$/i, "")
    .replace(/[_+]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function editionFromUrl(sourceUrl) {
  const pathname = new URL(sourceUrl).pathname;
  const match = /\/visual\/([^/]+)\/sectional-files\//i.exec(pathname);
  return match ? match[1] : "";
}

export function parseFaaSectionalCatalogHtml(html, baseUrl = FAA_VFR_RASTER_CHARTS_URL) {
  const chartsByKey = new Map();
  const hrefPattern = /href\s*=\s*["']([^"']*sectional-files\/[^"']+\.zip)["']/gi;
  let match;
  while ((match = hrefPattern.exec(String(html || ""))) !== null) {
    const sourceUrl = new URL(match[1].replace(/&amp;/g, "&"), baseUrl).toString();
    const url = new URL(sourceUrl);
    if (url.hostname !== "aeronav.faa.gov") continue;
    const filename = decodeURIComponent(url.pathname.split("/").pop() || "sectional.zip");
    const chartName = chartNameFromFilename(filename);
    const edition = editionFromUrl(sourceUrl);
    const key = normalizeChartKey(chartName);
    if (!key || chartsByKey.has(key)) continue;
    chartsByKey.set(key, { chartName, filename, sourceUrl, edition, editionLabel: displayEdition(edition) });
  }

  const charts = Array.from(chartsByKey.values()).sort((a, b) => a.chartName.localeCompare(b.chartName));
  const editions = charts.map((chart) => chart.edition).filter(Boolean);
  const edition = editions[0] || "";
  if (!charts.length || !edition) throw new Error("FAA VFR raster catalog did not list sectional GeoTIFF ZIP files.");
  return {
    provider: "FAA",
    product: "sectional-geotiff",
    edition,
    editionLabel: displayEdition(edition),
    charts,
    discoveredAt: new Date().toISOString(),
    sourcePage: baseUrl,
  };
}

export async function discoverFaaSectionalCatalog(options = {}) {
  const fetchImpl = options.fetchImpl || fetch;
  const response = await fetchImpl(options.url || FAA_VFR_RASTER_CHARTS_URL, {
    headers: {
      "User-Agent": NODEVISION_FAA_USER_AGENT,
      "Accept": "text/html,application/xhtml+xml",
    },
  });
  if (!response?.ok) throw new Error("FAA VFR raster catalog request failed with " + (response?.status || "no response") + ".");
  return parseFaaSectionalCatalogHtml(await response.text(), options.url || FAA_VFR_RASTER_CHARTS_URL);
}

export function findFaaSectionalCatalogEntry(catalog, chartName) {
  const key = normalizeChartKey(chartName);
  const match = (catalog?.charts || []).find((chart) => normalizeChartKey(chart.chartName) === key);
  if (match) return match;
  return (catalog?.charts || []).find((chart) => {
    const candidate = normalizeChartKey(chart.chartName);
    return candidate.includes(key) || key.includes(candidate);
  }) || null;
}
