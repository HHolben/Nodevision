# GeoTIFF terrain and generic document/world associations

Implementation report, November 2, 2026. No Notebook files were edited. Browser persistence tests intercept saves in memory, and TIFF tests use read-only fixtures or temporary copies.

## A. Root cause and reproduced behavior

The valid geographic definition already reached the geographic sampler through creation, tool placement, world loading, and serialization. The tests did **not** reproduce a valid DEM being replaced by procedural seed noise. A seed appearing in the former Y inspector was insufficient evidence of such replacement: that inspector unconditionally described every voxel world using its procedural generator and seed.

Four concrete defects or misleading behaviors were found and corrected:

1. **Incorrect properties display.** `VoxelWorldProperties.mjs` always displayed `Seed: …` as the source, including geographic and authored-map worlds. The inspector now describes the authoritative source mode and relevant metadata.
2. **Implicit tiny crop.** A blank crop silently selected an approximately 128 m center region, rather than the selected TIFF's full landscape. Users now explicitly enter crop bounds, select a polygon, or click **Fit to source** before previewing. There is no automatic center crop or automatic procedural fallback.
3. **Actual elevation quantization defect.** Bilinear floating-point roundoff could turn an exact 21 m plateau into 83 voxels instead of 84 at 0.25 m resolution. A tiny numerical tolerance before flooring corrects that one-cell depression without changing the elevation model or adding noise.
4. **Incorrect source coverage for other consumers.** The geographic generator lacked the common metre-space terrain sampler. Runtime fallback coverage used the enclosing rectangle, incorrectly treating crop holes as covered ground at zero height. The geographic sampler now reports the actual crop coverage, elevation, biome, material, and resolution to paths and other terrain consumers.

The supplied topographic TIFF is RGB visualization and cannot provide elevation; it is rejected with an explicit instruction to use a single-band raw DEM. The supplied raw TIFF covers only a small region near Mount Pelion. Its elevations range approximately 957.736–1274.126 in the source's assumed metre units. Neither file provides land-cover classes. These facts do not justify substituting seeded geography or extending the source beyond its coverage.

The user's exact earlier saved world was not supplied, so this report distinguishes reproduced defects from an unconfirmed historical source-substitution hypothesis.

## B. Geographic implementation

### Source of truth

| Concern | Existing authoritative representation |
|---|---|
| Source mode | `terrainSource`: `procedural`, `geographic`, `map`, or `hybrid`; legacy omitted mode remains procedural |
| Seed | `generator.seed`; auxiliary vegetation/detail seed for geographic worlds |
| DEM reference | `geographic.elevation.asset.path`, fingerprint and source metadata |
| Crop | `geographic.crop`, polygon selection, `effective` / `effectiveRaster`, and raster `window` |
| CRS | `geographic.elevation.crs`; local projection `geographic.projection` |
| Scaling | `horizontalScale`, `verticalExaggeration`, `verticalOffset` |
| Origins | Geographic/projected origins in the recipe; world object `position` and local height limits |
| Biomes | Default biome, optional land-cover reference/mapping, and KML polygon overrides |
| Chunk configuration | `chunks.voxelsPerAxis`, `chunks.loadRadius`, `voxelSize` |
| Generated chunks | Runtime manager entries and `proceduralChunk` metadata; generated meshes are not serialized as authored objects |
| Authored terrain changes | Existing path constraints, construction composition, and session voxel layers; these do not replace source identity |
| Representation | Existing `representation` setting; voxel and polygonal meshes share the same elevation field |

The pipeline remains: bounded byte-range reads → GeoTIFF metadata validation → crop/coverage clipping and interpolation halo → bounded sample decoding → CRS mapping and bilinear sampling → vertical scale/offset → quarter-metre quantization → existing terrain composition and progressive chunk meshing.

Version 1 and version 2 geographic recipes remain supported. The saved world retains its portable Notebook source reference and the **existing bounded cropped-sample cache**, not a duplicate TIFF file or generated world meshes. Keeping that cache preserves compatibility and deterministic offline reopening. Large TIFFs are still read through bounded windows; the complete source raster is not imported merely to generate a small crop.

Source availability is checked with a one-byte range request whose response body is cancelled. Missing sources produce a diagnostic in Y properties; cached geographic terrain remains active, and no procedural replacement occurs. Source availability does not mean fingerprints were verified: **Verify saved source files** remains the explicit integrity check. Reimporting requires **Import / Preview** and explicit regeneration.

Y properties now show source identity, path, GeoTIFF format, source/local CRS, crop, geographic/world origins, dimensions, resolution, scaling, biome source, and the auxiliary seed. Source diagnostics do not hide material-loading errors. Procedural worlds still show their seed; authored maps show their file and outside-coverage policy.

Regeneration warns that ground heights may change under authored objects, explains that objects and associations remain, and identifies Undo as recovery. Existing bridge history, path/construction handling, and imported-model ownership are reused.

### Files changed

- `MetaWorld/Geographic/Terrain.mjs`: quantization and shared source sampling.
- `Geographic/ImportPanel.mjs`, `ImportControls.mjs`, `RasterMetadata.mjs`: explicit crop selection and actionable input diagnostics.
- New `Geographic/SourceStatus.mjs`: bounded availability checks and recoverable diagnostics.
- `ProceduralVoxelWorld/ProceduralVoxelWorldRuntime.mjs`: owns source-status lifecycle.
- New `ProceduralVoxelWorld/TerrainSourceSummary.mjs`, plus `VoxelWorldProperties.mjs`: source-aware inspector descriptions and status.
- `VoxelWorldDialog.mjs`: auxiliary-seed labeling and regeneration warning.
- Geographic fixtures, focused regression tests, and browser regression scripts.

## C. Interface simplification

Removed the **Edit → Educational Associations** item, its callback, the dedicated `EducationalLinksPanel.mjs`, and the inspector's panel-launch button/custom selection event.

Generic controls now live in:

- **HTML Properties → World associations** for the current element.
- **Document associations** in the existing world-object inspector, including terrain, paths, constructions, and ordinary persistent world objects.

New small modules `AssociationActions.mjs`, `AssociationSurface.mjs`, `HtmlAssociations.mjs`, and `WorldAssociations.mjs` reuse `Records`, `HtmlController`, `WorldLinks`, `Navigation`, and native history. Existing JSON-LD datasets, IDs, `educationalLinks`, relative references, citations, unknown fields, and unresolved links retain their format. New ordinary elements receive the generic `document-element` classification; no Greek-specific command is added to normal controls.

Removal affects the relationship only; it does not delete the HTML element, semantic record, or world object. HTML metadata and world links use their respective editor histories and saves. Controls do not replace standard hyperlinks or existing File/Graph Manager resource-linking workflows. Document and world subscriptions are cleaned up by their owning inspectors; association edits do not rebuild toolbars or geometry.

## D. Validation

| Command | Result |
|---|---|
| `python3 scripts/test-geographic-browser.py geographic-source-browser.mjs` | 42 end-to-end checks passed: plateau/valley/peak/slope, real rendered voxel heights, changed seed, chunk boundaries, source-aware inspector, representation switch, save/reopen, source missing, regeneration history, procedural reopening, raw Pelion import, RGB rejection |
| `python3 scripts/test-geographic-browser.py` | Existing worker/tool-placement/persistence suite and five-kilometre streaming benchmark passed |
| `node scripts/run-footnotes-browser.mjs education-browser.mjs` | 70 checks passed against the supplied HTML fixture; generic element linking, legacy records, navigation, bibliography/hyperlinks, separate HTML/world undo-redo, portals, save/reopen, cleanup |
| `node scripts/run-footnotes-browser.mjs education-browser.mjs --synthetic` | 70 checks passed against the public synthetic fixture |
| `python3 scripts/test-html-properties-browser.py` | Complete existing HTML Properties integration passed, including ownership, preview, source preservation, and listener/observer lifecycle |
| Additional HTML, Notebook-path, portal, and terrain-map Node suites below | 11 test files passed; zero failures |
| `python3 scripts/test-terrain-representation-browser.py` | Passed native GOX/STL/glTF/GLB independence, representation switching, history, legacy grid, and HTML persistence |
| Focused Node suites listed below | 26 test files passed; zero failures |

Focused Node command:

```sh
node --loader ./scripts/html-test-loader.mjs --test --test-concurrency=2 \
  ApplicationSystem/public/MetaWorld/Geographic/*.test.mjs \
  ApplicationSystem/public/MetaWorld/ProceduralVoxelWorld/*.test.mjs \
  ApplicationSystem/public/MetaWorld/TerrainRepresentation/*.test.mjs \
  ApplicationSystem/public/MetaWorld/Paths/*.test.mjs \
  ApplicationSystem/public/MetaWorld/Constructions/*.test.mjs \
  ApplicationSystem/public/Education/*.test.mjs
```

Additional Node command:

```sh
node --loader ./scripts/html-test-loader.mjs --test --test-concurrency=2 \
  ApplicationSystem/public/utils/notebookPath.test.mjs \
  ApplicationSystem/public/LinkPortalParity.test.mjs \
  ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditorComponents/Html*.test.mjs \
  ApplicationSystem/public/MetaWorld/TerrainMaps/*.test.mjs
```

`node --loader ./scripts/html-test-loader.mjs ApplicationSystem/public/MetaWorld/Geographic/TerrainIdentity.test.mjs` also passes seven direct regression cases. Syntax parsing and `git diff --check` pass.

The full Properties test requires a retained-editor/viewer workspace and baseline comparison routes. Running it with the simpler footnotes harness was not a valid test configuration. The new `test-html-properties-browser.py` supplies its expected scaffold, and the browser runner accepts an optional final-result prefix so imported setup suites cannot cause premature success. Explicit listener removal in the new controls passes the existing lifecycle instrumentation.

The attempted Electron variant (`env -u ELECTRON_RUN_AS_NODE xvfb-run -a node_modules/.bin/electron --disable-dev-shm-usage scripts/html-foundation.electron.cjs --properties`) could not initialize shared memory in this container; its Electron-specific native-input checks remain unverified. The complete Chromium Properties integration passed instead. Earlier failing development assertions were fixed and rerun; no known application-test failures remain in the completed suites.

The geographic source test uses the native creation dialog, worker import, world loader/save bridge, inspector used by Y, Three.js meshes, and raycasts against the rendered voxel surface. It invokes the inspector API rather than synthesizing a physical Y keystroke. No screenshot or raster-decoding assertion substitutes for checking the resulting geometry.

The raw Pelion test used crop `[23.040,39.392,23.042,39.394]` and vertical scale `0.2`, generated varying native terrain heights, and transferred 720,896 bytes in two range requests from the 1,315,230-byte source. The synthetic terrain checks establish exact coordinate/elevation expectations; Pelion adds a real-file integration check.

The existing 5 km × 5 km benchmark imported in about 1.18 s, transferred about 1.94 MiB from a 16 MiB tiled DEM, and retained at most three rendered chunks / about 1.09 MiB of mesh data during its traversal. Across 450 frames, streaming updates averaged 4.48 ms (p95 6.8 ms; maximum 29.2 ms). First two chunks took about 672 ms. These are headless Chromium/SwiftShader observations, not a hardware performance guarantee. The import memory estimate was approximately 224.5 MiB, within the existing 256 MiB budget.

The existing Python fixture generator requires `tifffile`, which is not installed in this environment. Equivalent tiled/oversized-strip fixtures were generated in `/tmp/nodevision-geographic-large` using already-installed GDAL and NumPy; no application dependency was added.

All new application modules have the required path/purpose headers and fewer than 200 code lines. The existing object-inspector module remains over the file-length standard; this change makes only the necessary integration edits rather than refactoring its unrelated controls. The full desktop application and repository-wide suite were not run.

## E. User walkthrough

### Create and verify a geographic voxel world

1. Open a world in **Build** mode and open the existing **Voxel World** creation/settings dialog. Choose **Terrain source → Geographic**.
2. Use **Browse Notebook** to select the raw TIFF under `Library/Collection3_Atlases/Section1_TerrainMaps/`:
   `2026-10-31-00_00_2026-10-31-23_59_DEM_COPERNICUS_90_DEM_(Raw).tiff`.
   The picker retains the configurable `maps.terrain` starting directory. Do not select the RGB topographic TIFF.
3. Enter crop `23.040,39.392,23.042,39.394`, horizontal scale `1`, vertical exaggeration `0.2`, and leave vertical offset blank to place the crop minimum at 1 m. Leave procedural surface detail off to inspect only DEM elevations. Neither provided file supplies land cover; select an explicit default biome unless you have a separate land-cover source.
4. Click **Import / Preview**. Review the source CRS, crop extent, source elevation range, resulting dimensions, and preview. This crop is a small portion of the available DEM; **Fit to source** requests full available coverage and can require a smaller crop to satisfy sample/vertical budgets.
5. Click **Generate**. If configuring the equipped placement tool, click **Apply Settings**, then place the configured world on a surface. Streaming remains near the camera; move through the terrain to inspect its full extent.
6. Aim at/select the terrain and press **Y**. Verify **Source: Geographic DEM**, the raw TIFF reference, crop, and scales. The seed is explicitly auxiliary; editing it with surface detail disabled does not replace DEM elevations.
7. Save through the existing world save action, close, and reopen. Inspect with **Y** again. Use the existing terrain representation control to switch voxel/polygonal rendering without changing the source.
8. To adopt changed source data, use **Edit Generation Parameters → Import / Preview → Regenerate**. Read the warning; Undo restores the previous terrain. If a TIFF becomes unavailable, Y properties explain that the saved crop remains active and how to restore/reimport the source.

### Link an HTML element without a separate editor

1. Keep the HTML document and its world open. Put the world in **Build** mode and create/select the desired ordinary object, path, portal, model, or construction normally.
2. Select the HTML element and open the existing **HTML Properties** control.
3. Under **World associations**, choose the world object and click **Associate with World Object**. An existing semantic ID is reused; otherwise a generic stable record and HTML anchor are created.
4. Use **Go to Associated World Object**. In the object's Y inspector, use **Document associations → Go to Document Element** to return.
5. To link from the world side, choose an open HTML document and existing record under **Document element**, or select **Selected HTML element** after selecting an ordinary element in that document. Click **Link to Document Element**.
6. Use **Remove World Association** or **Remove Document Association** to unlink. Existing text, metadata records, ordinary hyperlinks, and world geometry remain. Use the appropriate editor's undo/redo controls and save both changed documents.
