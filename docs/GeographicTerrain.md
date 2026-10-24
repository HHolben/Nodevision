# Geographic voxel terrain: crop-aware imports and regional traversal

New imports use recipe **version 2**. The selected crop controls source reads, elevation validation, normalization, and generated bounds. Existing version-1 worlds keep their original samples, placement, generation, and serialization; opening or saving them does not upgrade or regenerate them. Explicit **Import / Preview → Regenerate** adopts a version-2 recipe.

The feature still uses Nodevision's existing voxel generator, materials, vegetation providers, collision, path grading, object bridge, history, and HTML persistence. It does not create a second voxel engine.

## Import and fit a crop

1. Place a georeferenced elevation GeoTIFF in the Notebook. A larger source tile is now usable when its TIFF layout permits bounded window reads; external GIS cropping is no longer universally required. Optionally add land cover and KML.
2. Open **Insert → Voxel World**, or equip Voxel World and press **G**. Choose **Geographic** and browse the Notebook sources.
3. Enter `west,south,east,north` in degrees, or leave the rectangle empty for an approximately 128 m center crop. Horizontal scale and vertical exaggeration default to 1. Detail defaults off.
4. Click **Import / Preview**. Metadata is inspected before pixels are read. The preview shows source coverage, requested bounds, effective terrain, selected polygon/holes, source resolution, read-window dimensions, crop elevation bounds, world dimensions, estimated working memory, and saved size.
5. Use the fit controls as needed, then preview again:
   - **Fit to source** selects source bounds and explicitly allows fitting to its footprint. It still runs extent, sample, memory and vertical validation; a full source can exceed these budgets.
   - **Fit bounds to polygon** shrinks the rectangle around the selected KML polygon. Selecting a boundary also fits automatically if you have not manually entered a rectangle.
   - **Fit to available coverage** explicitly permits intersecting the requested region with source coverage. Without this action, requested terrain outside coverage is rejected and its overlap is shown. It does not fill or silently discard interior NoData.
   - **Reset crop** restores the automatic crop. Numeric bounds remain available for precise keyboard operation.
6. Review warnings, then **Generate**, or **Apply Settings** followed by normal inventory placement. Save the HTML world normally.

Import controls invalidate stale previews immediately. Cancel terminates the worker. Revision checks prevent canceled, superseded, or late worker messages from replacing newer settings. Generation cannot use an invalidated preview.

The overview uses gray for source coverage, orange for requested bounds, green for generated terrain, purple for the selected polygon, and red markers for invalid interpolation support. The separate grayscale thumbnail shows elevation. Tiny crops can appear small relative to a large source in the overview; numeric bounds and the elevation thumbnail remain usable.

## Effective crop, windows, and interpolation

The effective terrain is the intersection of the requested geographic rectangle, the optional selected KML polygon (including holes), and the elevation sample-center coverage. Coverage fitting requires explicit consent unless already selected through a fit action. Interior missing samples are errors, not additional automatically cut-out terrain.

Geographic rectangle edges and transformed coverage edges are subdivided, not estimated from two corners. Polygon clipping handles concave polygons, holes and disconnected intersections. Transformation uses a 1 mm projected chord tolerance, followed by a 1e-7-pixel raster-space chord tolerance; near-integer sample coordinates snap within 1e-9 pixels to remove projection roundoff. Sub-square-millimeter coverage differences are treated as numerical noise. The saved densified raster-space polygon is the exact version-2 inclusion predicate. These small geometric approximations are separate from survey accuracy and voxel resolution.

The importer distinguishes:

- **Generated region:** the saved effective polygon, used by terrain and feature-footprint tests.
- **Raster window:** the rectangular pixel range enclosing that region.
- **Interpolation support:** the neighboring sample centers needed by bilinear interpolation, including a small window halo.

The halo never enlarges generated bounds. Source origin, source dimensions, window offsets, CRS, pixel scale, and sample placement are retained. Sampling uses the original transform plus integer window offsets, so adjacent windows and save/reload reproduce the same heights without accumulating shifted-origin roundoff.

Elevation uses bilinear interpolation and downward 0.25 m voxel quantization. Land cover uses nearest neighbor. NoData neighbors with zero interpolation weight do not invalidate an exact sample-center query.

### Crop elevation and NoData validation

Validation examines **every bilinear cell intersecting the effective region**, not a sparse thumbnail grid. Row-strip polygon intersections enumerate the necessary cells while retaining holes. The minimum/maximum of all contributing cell-corner samples is a conservative bound on the selected bilinear surface. It can overestimate a very small crop's relief by including influential samples just outside its boundary, but cannot miss an interior peak. The preview labels it as a conservative bound.

Distant peaks, valleys, and NoData outside this support do not affect acceptance or vertical placement. NoData wholly inside an excluded hole is ignored unless it influences valid terrain along the hole boundary. Required NoData causes an error with sample locations and red preview markers; adjust the rectangle/boundary or repair the data externally. Automatic gap filling is not implemented.

The default vertical offset places the conservative crop minimum at 1 m above the object base. The existing 256 m vertical span remains, with 20 m reserved for vegetation. A rejected crop reports its elevation bound, relief, available budget, and a suggested vertical exaggeration. There is no silent clipping or flattening. A real 5 km Pelion crop with substantial mountain relief may require reduced vertical exaggeration even though 1:1 horizontal scale is supported.

## Source access and resource budgets

Notebook serving already uses authenticated Express static files with byte ranges. The importer uses the GeoTIFF library's custom-client/window APIs through that existing route; it adds no unauthenticated file endpoint and changes no path/access rules. Worker requests retain same-origin credentials. A server returning a complete file instead of HTTP 206 is rejected before buffering its body.

| Resource | Version-2 budget and behavior |
| --- | --- |
| Source address space | Up to 8 GiB per TIFF; source dimensions are not a decoded-pixel allocation |
| Source transfer | Up to 64 MiB and 4096 range requests per raster/import; 64 KiB blocks, 16 cached blocks |
| Decoded crop | At most 1,048,576 samples per raster, including interpolation support; memory estimates can impose a tighter limit |
| TIFF blocks | At most 64 MiB total decoded touched strips/tiles; encoded range cost is also checked |
| Working-memory estimate | 256 MiB cap, checked before decoding; includes retained elevation while reading land cover |
| Saved recipe | 24 MiB serialized cap, including source identities, geometry and compact snapshots |
| Regional projection | Up to 20 km per geographic axis, within WGS84 UTM zone 34N (18–24°E, 0–84°N); 5 km is the measured traversal target |
| Horizontal world size | No 512 m or 4096 m cutoff for V2; bounded by the regional extent, scale ≤10 and existing one-million-meter coordinate envelope |
| Vertical world size | 256 m, including 20 m vegetation headroom |
| Resident terrain | At most 256 chunks and 128 MiB of mesh buffer bytes, plus one in-progress chunk |
| Streaming work | 4 ms soft budget per update; one cooperative mesh can span many frames |

The working-memory estimate includes twice the touched encoded/decoded block sizes, 640 bytes per selected sample for binary/string/clipping/GC overhead, a 64 MiB reserve, and retained snapshot strings. This conservative empirical estimate is **not a hard process RSS cap**. Browser engine overhead, garbage collection, rendering, and history are additional; measured process samples are included in the benchmark evidence. All sample, request, cache and residency structures also have independent hard count/size bounds.

Small windows are not necessarily cheap: a large compressed strip can require decoding an entire wide strip. Such layouts are rejected before pixel decoding when their touched-block cost exceeds the budget. Use a tiled or shorter-strip GeoTIFF in that case. The implementation never assumes a small output rectangle implies a small decompression allocation.

### Supported raster formats

GeoTIFF.js 3.0.5 and Proj4js 2.22.0 are bundled locally for offline use. Polygon intersections use the locally bundled polygon-clipping library.

- First image/IFD, single band, north-up, top-left orientation; strips or tiles. Overviews are not automatically selected.
- EPSG:4326 in degrees or EPSG:32634 in meters, with consistent GeoKeys.
- One ModelTiepoint and positive ModelPixelScale; nonzero tiepoint raster coordinates work. Rotated/matrix transforms are rejected.
- PixelIsArea centers at half-pixel offsets; PixelIsPoint at integer indices. Missing RasterType uses the GeoTIFF PixelIsArea default.
- Signed/unsigned 8-, 16-, or 32-bit integers; IEEE 32-/64-bit floats.
- Uncompressed, LZW, Deflate (8 or 32946), or PackBits compression.
- GDAL_NODATA and non-finite samples recognized. Elevations are source meters; explicit non-meter units are rejected. No vertical-datum conversion is performed.

The source resolution remains authoritative. Quarter-meter voxels do not increase survey detail.

## Persistence and placement

V2 saves only cropped rectangular elevation/land-cover windows and required interpolation support. Elevation values in the window that cannot influence generated terrain are stored as missing. Samples use exact Float64 little-endian binary base64, avoiding expanded JSON number arrays while retaining even Float64 source precision. Snapshots stay inside the ordinary HTML world definition, so existing copying/exporting and offline reload need no new asset-inclusion mechanism.

Recipes retain Notebook source references, metadata, effective crop/holes, geographic and projected origins, scale, vertical offset, seed, biome mappings, attribution and source fingerprints. New fingerprints hash the ranges actually consumed plus file size; they are **not whole-file checksums**. Changes solely outside the consumed ranges are not detected. **Verify saved source files** rechecks those bytes; ordinary reload never reads the original TIFF. V1 sources retain their original whole-file checksum verification.

+X is east, +Z south, +Y up. Object position remains separate from geographic reference. During explicit recropping, the prior geographic anchor remains at its world-space position: changing the cropped minimum translates the terrain root by the corresponding meter delta. Authored objects and paths stay in world coordinates. Vertical offset or scale changes are explicit generation changes and can still change terrain relative to authored content.

Authored objects, inscriptions, paths, metadata and undo/redo remain on the existing persistence/history path. Path grading deliberately modifies the imported base underneath a path. Aegean protected-ground recipes are not newly introduced for geographic terrain. **Persistent manual generated-voxel editing remains unsupported.**

## Vegetation, land cover, and KML

Precedence remains **explicit KML override → land-cover mapping → default biome**. Later placemarks win overlaps in document order. Existing generic and Aegean vegetation providers are reused; species are approximate procedural interpretations, not survey identifications. Full feature footprints must remain inside the crop and outside holes.

Default mappings are editable JSON:

| WorldCover class | Existing family/fallback |
| --- | --- |
| 10 tree cover | `temperate` forest interpretation |
| 20 shrubland | `phrygana` |
| 30 grassland, 40 cropland | `temperate` grass surface, generated trees suppressed |
| 50 built-up, 60 bare | `rocky-mountain`, no buildings |
| 70 snow/ice | `snowy-pine-forest` snow surface |
| 80 water, 90 wetland | `stream-valley` **dry gravel**, no inferred water height |
| 95 mangroves | generic `temperate` forest fallback |
| 100 moss/lichen | `phrygana` fallback |

Unknown classes, land-cover NoData and out-of-coverage pixels use the selected default. A land-cover source with no overlap retains its source reference and reports the fallback. Other valid identifiers include `maquis`, `pine-woodland`, `olive-terraces`, `coastal-cliffs`, `dunes`, `upland-oak`, and `volcanic`.

KML supports one Polygon per placemark, outer rings and inner holes, and `ExtendedData/Data name="biome"/value` or `SimpleData name="biome"`. Limits remain 1 MiB, 64 polygons and 4096 points per closed ring. Points, paths, MultiGeometry, models, overlays, NetworkLinks, malformed coordinates, and unknown biome identifiers are rejected. No external KML resources are fetched. KML does not supply elevation or create roads/buildings.

```xml
<kml xmlns="http://www.opengis.net/kml/2.2"><Document>
  <Placemark><name>Approximate woodland</name>
    <ExtendedData><Data name="biome"><value>pine-woodland</value></Data></ExtendedData>
    <Polygon><outerBoundaryIs><LinearRing><coordinates>
      23.049,39.349 23.051,39.349 23.051,39.351
      23.049,39.351 23.049,39.349
    </coordinates></LinearRing></outerBoundaryIs></Polygon>
  </Placemark>
</Document></kml>
```

## Larger-world audit and remaining viewing limits

Chunk keys are coordinate strings; packed indices apply only inside a 32³ chunk. Terrain columns, feature candidates, neighborhood queries, level queries and path lookups have fixed caches, independent of world extent. Collision samples the analytic field locally; raycasting visits resident meshes only. There is no full-world voxel allocation or full-world vegetation enumeration during traversal.

V2 advances the existing terrain, feature, level-query and meshing operations cooperatively. Teleporting cancels unfinished work from the previous position. Distant meshes are released; residency pressure evicts the farthest meshes. Cache caps are 8192 terrain columns, 512 feature candidates, 64 feature neighborhoods, 512 chunk-level entries, 8192 path columns and 128 path lookup tiles.

Configured viewing radius remains **8–64 m** (16 m by default). Residency limits can omit farther chunks in complex regions. There is no distant terrain renderer or LOD panorama; expect progressive appearance after teleports. The 4 ms work budget is soft: individual vegetation candidates, final geometry commits and garbage collection can overrun it. Benchmark results include those spikes.

Existing paths retain their 4096 m per-path length limit. Several kilometers of connected routes can use multiple path objects; the benchmark includes two joined 2400 m graded paths. Local path candidates are cached by nearby tiles rather than scanning every path for every voxel. Path authoring itself still constructs its bounded ribbon synchronously.

## Tests and benchmark reproduction

```sh
node scripts/build-geographic-deps.mjs
node --experimental-loader ./scripts/html-test-loader.mjs --test \
  ApplicationSystem/public/MetaWorld/ProceduralVoxelWorld/*.test.mjs \
  ApplicationSystem/public/MetaWorld/Geographic/*.test.mjs \
  ApplicationSystem/public/MetaWorld/Aegean/*.test.mjs \
  ApplicationSystem/public/MetaWorld/Paths/*.test.mjs

# Fixture writer dependencies are test-only, not runtime dependencies.
python3 -m pip install --target /tmp/nodevision-geographic-fixture-deps numpy tifffile
PYTHONPATH=/tmp/nodevision-geographic-fixture-deps \
  python3 scripts/geographic-large-fixtures.py /tmp/nodevision-geographic-large
python3 scripts/test-geographic-browser.py
node scripts/geographic-traversal-benchmark.mjs /tmp/nodevision-geographic-large
```

The browser runner uses Chromium and a temporary fixture server with byte ranges; the CPU benchmark uses real Express static byte-range serving. `NV_GEO_LARGE_FIXTURES` selects another fixture directory. No survey downloads are needed.

Tests cover distant peaks/NoData, required interpolation support, holes, zero-weight neighbors, both CRSs and sample-placement conventions, cropped/original and adjacent-window agreement, explicit coverage fitting, V1 preservation, geographic anchor retention, stale worker replies, progressive mesh equivalence, cache/residency caps and teleport cancellation. Browser checks cover import/preview/placement, G settings, rendering, history, source verification, large-source/small-window reads, rapid changes, HTML save and offline reload with authored objects retained.

Measured evidence and limitations are in [GeographicTerrainBenchmarks.md](GeographicTerrainBenchmarks.md), with machine-readable reports under [benchmarks](benchmarks/).

Deferred: remote dataset discovery/downloads, large-region distant LOD, new botanical assets, buildings, inferred inland water levels, vertical-datum transformations and persistent manual voxel editing.
