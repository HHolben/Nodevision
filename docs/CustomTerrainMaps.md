# Custom terrain maps — Phase 1

## Architecture investigation

`VoxelBaseTerrain` supplies seeded elevation, biome-dependent surface materials, soil/strata, water and caves. `VoxelTerrainGenerator` wraps that field with `PathTerrainField`, bounded feature providers and construction replacement; `TerrainSession` then applies temporary opinions. Chunk scheduling, collision, voxel meshing and SurfaceNets share this final field. `VoxelChunkManager.invalidateBounds` already supports regional regeneration without replacing unrelated resident chunks.

World HTML stores declarative terrain definitions via native runtime serialization. Voxel resolution is fixed at 0.25 m, chunks at 32³, and height limits offset the terrain object's local Y origin. Legacy worlds have no terrain-source field. Existing geographic imports use GeoTIFF/KML crop/projection recipes (including tiled import/snapshot infrastructure), existing biome IDs and a geographic height sampler. They remain separate and unchanged. Imported GOX and polygonal objects have independent runtimes.

Integration uses an optional base sampling source, preserving the existing generator, subsurface functions, path/construction/session composition and renderers. Maps use object-local X/Z meters with an explicit map origin; moving the terrain moves the referenced geography. Map spacing is independent of voxel resolution. The new file loader uses Notebook-safe relative references and HTTP byte ranges, following the existing independent-asset model. No map raster is embedded in world HTML.

The single-file format uses a small versioned JSON manifest and fixed-size binary tiles with computable offsets. This avoids a whole-map tile index or large JSON arrays. Runtime residency is bounded independently of map extent. The writer supports streaming tiles; a convenience encoder exists for small fixtures.

## NVMAP v1 file specification

A `.nvmap` is one portable binary file, not a ZIP archive. All binary numbers are **little endian**. The 32-byte header is:

| Offset | Bytes | Meaning |
|---|---:|---|
| 0 | 8 | Magic bytes `4e 56 4d 41 50 0d 0a 1a` |
| 8 | 4 | Container version, UInt32, currently 1 |
| 12 | 4 | UTF-8 JSON manifest byte length |
| 16 | 8 | Payload offset, UInt64 |
| 24 | 8 | Total expected file length, UInt64 |

The manifest follows the header. Zero padding aligns the payload to 8 bytes. Tile order is row-major (X changes fastest). Every tile contains `tileSize × tileSize` sample records in row-major order, including zero padding beyond the map's final sample row/column. Each record contains:

| Record offset | Type | Meaning |
|---|---|---|
| 0 | Float64 | Elevation in meters relative to `origin[1]` |
| 8 | UInt32 | Index into the biome palette |
| 12 | UInt32 | Index into the material palette; zero means no override |

There is no global raster array or tile directory to load. Tile `(tx,tz)` begins at `payloadOffset + (tz * ceil(width/tileSize) + tx) * tileSize² * 16`. This also gives a future editor direct offsets for replacing individual tiles without rewriting the raster. File offsets must fit JavaScript's exact safe-integer range; this is an addressing/precision constraint, not a world-size cap.

Example manifest:

```json
{
  "format": "nodevision-terrain-map",
  "version": 1,
  "name": "My geography",
  "description": "Optional description",
  "size": [256, 256],
  "origin": [0, 0, 0],
  "grid": {"width": 129, "height": 129, "spacing": [2, 2], "tileSize": 64},
  "elevation": {"units": "meters", "reference": "Local terrain-object datum"},
  "biomes": ["temperate", "snowy-pine-forest"],
  "materials": [null, "sand", "LimestoneGravel"],
  "boundary": "empty",
  "geographic": {"note": "Optional future CRS metadata; no automatic conversion"},
  "attribution": {"author": "Optional", "source": "Optional"},
  "extensions": {}
}
```

`size` is width/length in meters and must equal `(sampleCount - 1) × spacing`. Samples are grid **nodes**, not voxel cells. Tile size is 16–256 samples; it does not determine world extent. The manifest is limited to 1 MiB, and palettes to 65,536 entries. Elevations must be finite Float64 numbers; NaN/NoData gaps and invalid palette indices produce tile-coordinate diagnostics. Large-map validation happens as tiles are read rather than scanning the entire raster.

Unknown optional `extensions` and other metadata survive manifest validation and reserialization unchanged, and are not interpreted. Nonempty `requiredExtensions` or unsupported schema/container versions are rejected. Future additional binary channels need a versioned layout/required capability, rather than appending data that a v1 editor might silently discard. This phase does not implement water, river, mask, erosion or graphical editing extensions.

## Sampling interface and coordinates

`Source.mjs` supplies `proceduralSource(...)` and `mapSource(reader, options)`. A source exposes `kind`, `bounds`, `resolution`, `covers(x,z)` and `sample(x,z)`. Samples contain `{covered, elevation, biome, material}`. Map/hybrid readers additionally expose asynchronous `prepare(bounds)` and residency checks. `Binding.mjs` connects that interface to a referenced file and reports an explicit `pending` sample while the needed map data is unavailable.

Coordinates are meters local to the terrain object, X east/right, Y up, Z along map rows. Map node `(i,j)` is at `(origin.x + i*spacing.x, origin.z + j*spacing.z)`; its elevation is `origin.y + storedHeight`. Optional geographic metadata describes provenance only; there is no implicit projection or vertical datum conversion.

Elevation uses bilinear interpolation; biome/material use nearest-node assignment with half ties toward the increasing index. Map coverage includes its first and last sample nodes and never wraps. Voxel generation samples horizontal cell centers. Surface height is quantized down to the existing 0.25 m cell grid, relative to `heightLimits.min`, and clipped to the existing finite vertical span. Maps may exceed world bounds; only the intersection with the configured world is generated. Runtime `sampleTerrainSource(worldX, worldZ)` applies the terrain object's translation and returns a world elevation.

Pure Map mode does not apply procedural mountain relief, landforms, waterways or elevation noise. Hybrid adds `(noise(x/detailScale,z/detailScale,seed xor salt) * 2 - 1) * detailStrength` meters to the sampled elevation. Setting strength to zero is exactly Map mode. This calculation is independent of chunk order and never changes file data. Seeds continue to control vegetation placement and subsurface geology.

Existing temperate, snowy and Aegean biome IDs are reused. The existing geographic vegetation adapter selects the appropriate existing tree or Mediterranean provider from mapped biomes. Canonical material IDs are reused without a second palette system. Unknown biome IDs produce warnings and fall back to temperate; unknown material IDs produce warnings and fall back to biome surfaces. Material index zero also uses the biome surface. An explicit override affects only the top cell; the existing soil depth and seeded stone/limestone strata remain beneath it. Existing material solidity/liquid properties still apply, including mud. Map columns do not infer waterways or landform caves. Existing path/excavation, construction and session operators run afterward.

## Configuration and settings

Existing schema-v1 terrain objects gain optional fields:

```json
{
  "terrainSource": "hybrid",
  "terrainMap": {
    "version": 1,
    "path": "../Maps/MyMap.nvmap",
    "detailStrength": 0.75,
    "detailScale": 16,
    "outside": "empty"
  }
}
```

The existing `generator.seed`, world dimensions, voxel size, chunk configuration, height limits, transforms and representation remain authoritative. Omitted terrain source retains legacy procedural behavior and does not require migration. Geographic source recipes also remain supported. Maps do not increase or reduce existing world-size limits.

**Edit Generation Parameters** and the existing Insert Voxel World settings now offer Procedural, Custom Map, Hybrid and the existing Geographic source. A map reference can be typed relative to the world or selected using the existing Notebook picker; hybrid strength/scale and outside-map behavior are exposed in the same panel. The UI validates the manifest and a tile before replacing terrain. Source settings survive native HTML save/reopen, while raster data stays in the linked file. Map biomes replace the starting-biome preset; map-mode water/cave generation controls are disabled rather than implying that the map contains those features.

Outside-map behavior defaults to **empty**, so absent geography does not generate extra terrain. Explicit `outside:"procedural"` enables the existing seeded fallback outside coverage, within the configured world only. No wrapping or edge extrapolation occurs.

## Streaming and regional updates

`Reader.mjs` reads the header and manifest, then only requested tiles. HTTP 206 responses and matching Content-Range values are checked. An ETag change during streaming produces a reload/update diagnostic. Servers ignoring Range are allowed a bounded whole-file fallback only for responses with a declared length of at most 8 MiB; large responses are rejected before buffering them. The normal Notebook static-file server supports byte ranges.

The default tile LRU budget is 64 MiB per runtime, with at most four reads in each preparation job. Tile requests are deduplicated. Memory is independent of overall map dimensions, and repeated sampling does not reparse the manifest or decode tiles. The base terrain also retains its bounded column/sample caches. Encoding is an async tile iterator, so large files can be written without allocating a complete output buffer. The convenience fixture encoder is limited to 64 MiB; the streaming writer has no such file-size cap.

Native terrain prepares the active chunk window plus meshing/vegetation support before advancing the existing progressive scheduler. Collision returns no ground for a nonresident point until its map support is loaded. Initial player spawn prepares its local support before searching. Programmatic consumers can await `runtime.prepareMapRegion({minX,minZ,maxX,maxZ})` in local map meters before sampling a distant area; temporary editing/capture rejects nonresident cells instead of silently treating them as persistent air. Follow-terrain path sampling requests missing local map support and retains a diagnostic until it is available, rather than authoring a path at a fabricated height.

After changing existing raster bytes, call:

```js
await runtime.declareMapRegionChanged({minX, minZ, maxX, maxZ});
// Or notify by resolved Notebook path:
await declareMapRegionChanged("Maps/MyMap.nvmap", bounds);
```

The shared notification reaches all registered consumers of that asset. Only intersecting cached tiles are discarded; invalidation scans resident keys, not every tile in the map. The affected region expands by one map sample interval for interpolation, then by the existing feature reach and mesh-neighbor margin in voxel space. Bounded generator/path caches are cleared and only intersecting resident chunk columns are marked dirty. Unrelated resident meshes remain intact. Follow-terrain path fingerprints depend on intersecting map-change regions, so independent path objects remain authored separately. Explicit world/source/representation changes retain their existing broader invalidation behavior.

The declared region must include all changed samples. Metadata, palette, dimensions, layout or unknown external changes require reopening the asset/rebuilding its source; this API is for raster-region changes. Regional notifications do not write files or provide a multi-file save transaction.

## Sample and development utility

Versionable fixtures are in `scripts/fixtures/terrain-maps/CustomTerrain.nvmap` and its adjacent `CustomTerrain.html`. A ready-to-open copy was generated under `Notebook/Examples/TerrainMaps/` (Notebook is intentionally git-ignored).

Regenerate the sample and companion world:

```sh
node scripts/generate-sample-nvmap.mjs
# Optional destination:
node scripts/generate-sample-nvmap.mjs scripts/fixtures/terrain-maps/CustomTerrain.nvmap
```

The map is 256 × 256 m, with 2 m sample spacing, a low negative-elevation plain, a prominent hill, a valley, two biome regions, sand/gravel overrides, biome-default areas and fractional heights. The world uses the same 0.25 m voxels and a -16 to 64 m vertical span. No map-painting UI is included.

## Files changed

Added `MetaWorld/TerrainMaps/{Format,Reader,Source,Binding}.mjs` and format/integration tests; the sample generator, binary/world fixtures, native browser fixture/runner, and this report.

Integrated with `ProceduralVoxelWorld/{VoxelBaseTerrain,VoxelTerrainGenerator,ProceduralVoxelWorldRuntime,VoxelWorldDefinition,VoxelAuthoringDefinition,VoxelWorldAuthoringBridge,VoxelWorldDialog,VoxelWorldProperties}.mjs`; `Geographic/{Definition,Vegetation}.mjs`; `Paths/PathAuthoringBridge.mjs`; `SessionVoxels/Authoring.mjs`; and native `GameViewDependencies/worldLoading.mjs`. Existing unrelated HTML/calligraphy/footnote work was preserved.

## Limits and Phase 2 interfaces

The map format supports physical extents far beyond current finite worlds; existing world height/horizontal restrictions remain. Very fine map spacing combined with a large render/support window can exceed the tile budget. That is diagnosed explicitly; reduce render distance, choose coarser sampling, or configure a suitable cache budget. Tiles are currently uncompressed and fixed-stride, with padded edge tiles. Rendering and terrain generation remain on the existing cooperative main-thread scheduler. ETag-less external edits require explicit invalidation/reload, and unknown palette/layout changes are not inferred from region notifications.

Phase 2 should reuse `validateManifest`, the tile layout, streaming writer, `openMap`/`prepare`/`sample`, and shared region notifications. Build editor-local tile transactions and undo/redo, then publish changed tile ranges with revision checks and broadcast their sample bounds. Do not store brush strokes in world HTML or bake paths/constructions into map data. Tile compression, worker-based sampling/meshing and dedicated binary region-write APIs can be added with explicit format/version rules after measuring editing workloads.

## Validation

Passed:

- 26 Node test files across TerrainMaps, ProceduralVoxelWorld, Geographic, Paths, Constructions, SessionVoxels and TerrainRepresentation (zero failures).
- New format tests cover Float64 preservation, interpolation, categorical sampling, malformed files, unknown required extensions, HTTP Range validation, bounded caching, local edits and synthetic maps with tile offsets above one terabyte without allocating those files.
- New integration tests cover negative heights, surface/subsurface behavior, collision, path/construction operators, relative references, legacy definitions, shared-map consumers, bounded regional invalidation and voxel/polygonal representations. Both new test files passed again after the final lifecycle cleanup.
- `python3 scripts/test-terrain-maps-browser.py`: native HTTP range loading, map settings, local changes, collision, representation switching, HTML save/reopen, undo/redo and preservation of GOX/STL/glTF/GLB objects. Final rerun passed.
- `python3 scripts/test-paths-browser.py`: native path drawing/completion/editing, excavation, clearance, bridge collision, persistence and representation regression checks passed.
- `python3 scripts/test-construction-capture-browser.py`: 186 checks passed.
- JavaScript syntax checks and `git diff --check` passed.

The native fixture is a small rendering test, not a large-world performance benchmark. Its five representation switches took approximately 0.20–1.41 seconds in the final headless run, with four resident chunks and five geometries. Large-map tests establish bounded access and exact addressing, not throughput on a multi-terabyte physical file.

Run the Node suite with `node --loader ./scripts/html-test-loader.mjs --test` followed by the `*.test.mjs` files in the seven directories above. The sample utility and native browser runner are independent of the graphical map editor.

Phase 2's native editor, atomic tiled-save path and in-memory preview integration are documented in [TerrainMapEditor.md](TerrainMapEditor.md).
