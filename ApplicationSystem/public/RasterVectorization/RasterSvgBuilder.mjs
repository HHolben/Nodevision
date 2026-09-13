// Nodevision/ApplicationSystem/public/RasterVectorization/RasterSvgBuilder.mjs
// This module builds portable SVG text from vectorized raster paths. It avoids Nodevision-only metadata and never embeds the source raster image, keeping derived files useful in browsers and general SVG tools.

function escapeXml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function svgByteLength(svg) {
  if (typeof Blob !== "undefined") return new Blob([svg]).size;
  return new TextEncoder().encode(svg).length;
}

function opacityAttr(name, value) {
  if (!Number.isFinite(value) || value >= 0.999) return "";
  return " " + name + "=\"" + Math.max(0, Math.min(1, value)).toFixed(3).replace(/0+$/, "").replace(/\.$/, "") + "\"";
}

function fillRuleAttr(path) {
  return path.fillRule && path.fillRule !== "nonzero" ? " fill-rule=\"" + path.fillRule + "\"" : "";
}

function pathMarkup(paths) {
  return paths.map((path) => {
    const fill = path.fill || "#000";
    return "  <path d=\"" + escapeXml(path.d) + "\" fill=\"" + fill + "\"" + fillRuleAttr(path) + opacityAttr("fill-opacity", path.fillOpacity) + "/>";
  }).join("\n");
}

export function buildVectorSvg({ width, height, paths, options = {}, title = "Vectorized raster" }) {
  const w = Math.max(1, Math.round(Number(width) || 1));
  const h = Math.max(1, Math.round(Number(height) || 1));
  const background = options.removeWhite === false ? "  <rect width=\"100%\" height=\"100%\" fill=\"#fff\"/>\n" : "";
  const body = pathMarkup(paths || []);
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<svg xmlns="http://www.w3.org/2000/svg" width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '" role="img">',
    "  <title>" + escapeXml(title) + "</title>",
    background + "  <g id=\"vectorized-artwork\">\n" + body + "\n  </g>",
    "</svg>",
    "",
  ].join("\n");
}

export function vectorizationStatistics(paths = [], svg = "", extra = {}) {
  return {
    paths: paths.length,
    nodes: paths.reduce((sum, path) => sum + (path.loops || []).reduce((n, loop) => n + loop.length, 0), 0) || paths.length * 5,
    estimatedSvgBytes: svgByteLength(svg),
    components: extra.components?.length || 0,
    mode: extra.mode || "line",
    colorized: Boolean(extra.colorized),
    rectanglePaths: extra.rectanglePaths || 0,
    rectanglePathPercent: paths.length ? Math.round(((extra.rectanglePaths || 0) / paths.length) * 100) : 0,
    pathCommands: paths.reduce((sum, path) => sum + (String(path.d || "").match(/[MLCQZHV]/g) || []).length, 0),
    lineCommands: paths.reduce((sum, path) => sum + (String(path.d || "").match(/L/g) || []).length, 0),
    bezierCommands: paths.reduce((sum, path) => sum + (String(path.d || "").match(/[CQ]/g) || []).length, 0),
    coverageRatio: Number.isFinite(extra.coverageRatio) ? extra.coverageRatio : null,
    colors: extra.colors || new Set(paths.map((path) => path.fill)).size,
    smallRegions: extra.smallRegions || 0,
    initialRegions: extra.initialRegions || paths.length,
    finalRegions: extra.finalRegions || paths.length,
    mergedRegions: extra.mergedRegions || 0,
    paletteSize: extra.paletteSize || extra.colors || 0,
  };
}
