# Nodevision KML Terrain Region Workflow

This document covers the first Nodevision terrain-region workflow wired into the existing KML viewer/editor.

## Architecture

The KML viewer remains `ViewKML.mjs`, which delegates to `KMLEditor.mjs`. Terrain is added as a fourth KML view type beside Globe, Street, and Aviation. The view switch uses the existing toolbar widget and `KMLMapRenderer.mjs`; it preserves loaded KML state, selected feature state, layer visibility, and flat-map center/zoom where the renderer can report it.

Terrain rendering is layered on Leaflet through `KMLFlatMapRenderer.mjs` and `TerrainViewLayer.mjs`. The browser terrain layer is a lightweight preview layer with elevation color bands, hillshade/slope options, and dynamic contour density. It does not mutate KML and does not bake contours into the KML document.

The selected terrain region is stored separately from the selected KML feature through `window.KMLTerrainContext`. A KML path remains editable as a path; selecting the enclosed region adds a separate translucent region overlay and enables terrain actions.

## Source Selection

Server-side terrain source adapters live under `ApplicationSystem/Terrain`:

- `USGS3DEPSource.mjs`
- `CopernicusDEMSource.mjs`
- `MapzenTerrainSource.mjs`

`TerrainSourceSelector.mjs` implements automatic selection. Inside approximate supported U.S. coverage it tries USGS 3DEP, then Copernicus DEM, then Mapzen. Outside U.S. coverage it tries Copernicus DEM, then Mapzen. Explicit source requests may fall back unless `allowFallback: false` is supplied. The requested source and actual source are both returned in estimates and manifests.

Current live DEM retrieval is not enabled. Exports record source metadata and write deterministic preview elevation data, while marking `provider-elevation-data` as a missing offline resource. This avoids falsely claiming that USGS, Copernicus, or Mapzen downloads completed.

## Provider Configuration

Copernicus credentials or tokens must not be committed or sent to browser code. Future authenticated access should be configured server-side through environment variables or Nodevision server settings. Mapzen Terrarium decoding is isolated in `MapzenTerrarium.mjs` and uses:

```js
elevationMeters = red * 256 + green + blue / 256 - 32768
```

USGS 3DEP support currently records public attribution and a conservative estimated bare-earth DEM model. Exact product metadata and live requests should be added server-side before live USGS downloads are enabled.

## Closed Regions

Client-side closed-region detection is in `ClosedRegionSelection.mjs`. Server-side validation is in `TerrainRegionGeometry.mjs`. Supported inputs include KML `Polygon`, `LinearRing`, and closed `LineString`. Validation checks closure, minimum vertices, finite legal coordinates, nonzero projected area, self-intersection, antimeridian crossing, winding, and hole containment.

Unsupported self-intersecting and antimeridian-crossing regions are rejected with explicit messages in this phase.

## Contours

`TerrainContourGenerator.mjs` generates deterministic contour features from normalized elevation rasters. Elevations are stored internally in meters. Contour features record numeric `elevationMeters` and `contourRole` (`regular` or `index`). Browser previews use a lightweight derived layer; exported contours are generated server-side from the package raster.

## Offline Package Structure

Exports write a self-contained Notebook package under `TerrainRegions/<name>-<timestamp>/` with:

- `<name>.terrain.json`
- `region.kml`
- `region.geojson`
- `elevation/elevation-index.json`
- `elevation/preview-raster.json`
- `contours/contours.geojson`
- `contours/contour-index.json`
- `basemap/tile-index.json`
- `aviation/aviation-index.json`
- `previews/overview.svg`
- `attribution/attribution.html`
- `attribution/sources.json`
- `checksums.json`

The final package is written in a temporary directory and atomically renamed into the Notebook. Conventional street basemap tile downloads remain disabled unless a future map-source adapter explicitly permits offline use.

## Manifest Schema

Terrain manifests use `format: nodevision-terrain-region`, `version: 1`. They contain region geometry, bounds, area, origin, CRS/local axes, requested and actual terrain sources, contour settings, offline completeness, aviation metadata, provenance, attribution, and relative file references.

`validateTerrainRegionManifest()` rejects unsafe relative paths such as absolute paths, protocol URLs, and `..` traversal. Browser loading of terrain manifests also joins paths through Notebook-relative checks.

## Aviation Charts

`FAAVFRChartSource.mjs` provides a first FAA VFR chart intersection adapter using coarse chart bounds. Exports record intersecting FAA chart metadata, but verified chart files are not downloaded in this phase. Aviation material is marked as unavailable offline and not current for navigation until verified downloads and metadata are implemented.

Nodevision terrain and chart views are planning/reference products and are not independently certified navigation products.

## Security Limits

Exports enforce configured maximum area, tile count, and estimated package bytes from `TERRAIN_LIMITS`. Writes remain under the configured Notebook directory, package filenames are sanitized, final writes are atomic at the package-directory level, checksums are generated, and manifest paths are validated before loading.

Remote XML/JSON/TIFF/ZIP parsing and live provider downloads are not enabled yet. Future provider integrations must validate MIME type, size, checksum, archive entries, and destination paths before committing resources.

## Current Limitations

- Live USGS, Copernicus, Mapzen, and FAA downloads are not exercised.
- Terrain preview elevation is deterministic synthetic preview data, not provider DEM data.
- Offline basemap tile caching is disabled by default.
- Direct MetaWorld insertion is disabled; exported terrain-region manifests are prepared for later referencing by MetaWorld instances.
- Terrain mesh/GLB generation is not implemented.
- Antimeridian and polar regions are rejected in this phase.

## Future MetaWorld Plan

A MetaWorld should reference a terrain-region asset rather than duplicating source DEM/map data. The intended flow is:

source elevation and map data -> Nodevision terrain-region asset -> future MetaWorld terrain instance

Future work should add tiled heightfields or tiled GLB terrain meshes while keeping source rasters, contours, attribution, and checksums in the terrain-region asset.

## Manual Test Plan

1. Open a KML file in the existing KML viewer.
2. Switch View -> View Type -> Terrain.
3. Confirm the terrain contour preview appears and KML overlays remain visible.
4. Switch back to Street or Globe and confirm loaded KML state remains intact.
5. Select an existing KML Polygon or closed path.
6. Confirm the Terrain Region panel offers Select Enclosed Region.
7. Select the enclosed region and confirm fill/outline, area, bounds, source, and export controls appear.
8. Run Preview Terrain with Automatic source selection and confirm actual source is displayed.
9. Export a small U.S. region and confirm the manifest records requested/actual source and missing live DEM resources honestly.
10. Export a non-U.S. region and confirm Copernicus or Mapzen fallback is recorded.
11. Enable aviation metadata for a U.S. region and confirm intersecting FAA chart metadata appears, with offline/current warnings.
12. Disconnect the network and open the exported `.terrain.json` manifest.
13. Confirm region geometry and included contours render from Notebook files without repeated remote requests.
14. Attempt a very large region and confirm server limits block export.
15. Attempt an invalid or self-intersecting path and confirm export is rejected clearly.
16. Modify a manifest path to include `..` and confirm validation rejects it.
17. Cancel a terrain job and confirm it reports cancellation.
18. Retry a failed/cancelled terrain job and confirm status is reported through `/api/terrain/jobs/:jobId`.
