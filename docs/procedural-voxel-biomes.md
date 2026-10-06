<!-- Nodevision/docs/procedural-voxel-biomes.md -->
<!-- This report documents canonical shoreline materials, development V1 snowy biomes, shared pine density, liquid mud behavior, verification and measured performance. -->
# Shorelines and Snowy Pine Forest in development V1

## Existing materials and infrastructure

Canonical `sand`, `mud`, `snow`, generic `gravel`, `limestone`, `soil`, `stone` and `water` already existed. Sand, mud and snow were reused without changing their definitions. Only **LimestoneGravel** needed a new definition. Generic gravel remains distinct and unchanged.

Existing V1 heightfields, geology, static lake water, coordinate noise, feature placement, pine shape sampling, material resolution, chunk meshing and compact serialization were retained. There were no procedural rivers or explicit biome classification. Ordinary/equation/authored voxel material paths already use the shared catalog.

An important existing convention is that **mud is a liquid**, not solid soil. The implementation preserves that convention instead of duplicating or redefining mud.

## Canonical identities

| ID | Canonical file below Materials/ | Matter state / collider | Rendering |
| --- | --- | --- | --- |
| sand | Solids/sand.json | solid / solid | #c9aa5a |
| mud | Liquids/mud.json | liquid / non-solid | #6f5238, opacity .66 |
| LimestoneGravel | Solids/LimestoneGravel.json | solid / solid | #bcb9a7, roughness .9 |
| snow | Solids/snow.json | solid / solid | #e8eef2 |

LimestoneGravel uses the existing gravel schema: density 1700 kg/m³, friction .78/.48, restitution .05. It is registered in the ordinary CSV, fallback rows and canonical aliases, and resolves through the same material system as equations and authored voxels. These are gameplay defaults, not a new granular simulation.

Runtime indices 9–12 map to sand, mud, LimestoneGravel and snow; previous indices remain stable. The world pools twelve canonical materials. No falling blocks, flowing mud, sticky movement, snow collapse, melting or weather were added.

## Shoreline and substrate algorithm

`VoxelSurfaceComposition.mjs` owns the water-relative surface rules. Heights and geology retain their existing deterministic fields. With `waterTop = highestWaterCell + 1`, depth is `waterTop - terrainHeight`:

- More than two cells above waterTop: normal biome ground, grass or snow.
- From two cells above through six cells below waterTop: limestone-dominant regions use LimestoneGravel; otherwise a smooth sediment field selects mud or sand.
- More than six cells below waterTop: limestone-dominant regions use limestone; other regions use mud or stone according to the sediment field.

The sediment field has a 96-cell wavelength, fixed seed salt, and wet threshold .56. Geologic influence reuses the existing limestone-region field. These are varied elevation bands rather than constant-distance painted rings. Only the top surface cell changes; the existing subsoil and deeper strata remain. The thresholds and field parameters are centralized.

There are **no rivers yet**. The pure `surfaceMaterial` interface takes `waterTop` explicitly, so a future river height/bed sampler can supply its local water elevation to these same rules. No fake river or sediment-transport system was introduced.

## Biome classification and snow

`VoxelBiomes.mjs` exposes stable `temperate` and `snowy-pine-forest` identities. A smooth seeded field at wavelength **768 cells / 192 metres**, salt 13271, selects Snowy Pine Forest above .61. Classification uses world coordinates, not chunks or frame order. Runtime and generator expose `getBiome(x,z)`.

Snow replaces the normal exposed grass-like top cell only on dry uplands in the cold biome. Shore and submerged rules take precedence. Snow is a real canonical material; it does not recolor grass, cover trunks, freeze water or change underground limestone. The existing terrain shape remains unchanged.

## Shared pine density

The existing placement grid and pine geometry are reused. Pine bases accept grass, soil or snow, remain above water and continue to pass slope/world-bound checks. Sand, gravel, mud and exposed rock are rejected.

Temperate regions retain the forest-field threshold .35 and acceptance probability `.12 + .48 * field`. Snowy regions have no additional forest-field rejection and use `.70 + .25 * field`. On the same 576 suitable flat placement regions with seed 123456, the shared engine accepts **143 temperate candidates versus 477 snowy candidates**. Terrain/slope/water rejection still applies in real worlds.

Snowy pines use existing PineWood, PineBark and PineFoliage. No separate snowy-tree generator or foliage material was added. Optional snow on crowns was left out.

## Actual composition and physics

The order is: existing geology/subsoil → choose one surface cell from shore/biome rules → fill water above the terrain height → add features only into air → reserve future sparse overrides after composition. Surface selection chooses shore/substrate before dry snow. Thus water does not erase terrain, snow cannot overwrite trunks, and pine bases cannot use submerged or liquid ground.

Because canonical mud is liquid, the solid ground sampler steps past a mud surface cell to the underlying soil. The collider refreshes its canonical material metadata from the sampled solid ground. Sand, gravel and snow remain ordinary solid ground. Liquid lookup returns the correct canonical descriptor at the queried point: water retains buoyancy scale 1, mud uses its existing 1.7. Both reuse the existing swimming path; no custom drag or slowdown was added.

Meshing now handles water and mud as liquids: identical liquid interfaces are culled, solid bed faces remain visible, and a water/mud boundary has one interface owned by mud. Both use their existing canonical transparency. One logical liquid adapter serves the world, without volumes per cell or column.

## Persistence, V1 and fixed fixtures

Everything remains **nodevision-terrain-v1, version 1**. Development worlds intentionally gain changed shores, snow and tree placement. No V2 or per-world biome inventory was added. Biome/sediment/density parameters are fixed in V1 code; saves retain the existing compact generator definition and seed, not regions, voxels, trees or materials.

Seed **123456**, local integer voxel coordinates:

| Coordinate | Final material |
| --- | --- |
| (0,75,0) | grass |
| (32,71,0) | LimestoneGravel |
| (96,67,0) | sand |
| (96,68,0) | water |
| (240,62,0) | stone |
| (1280,73,0) | mud |
| (2032,57,0) | limestone |
| (2224,75,0) | snow |
| (2224,74,0) | soil |

`getBiome(0,0)` is temperate; `getBiome(2224,0)` is snowy-pine-forest. Existing pine fixtures were updated because the old shoreline grass bases are now correctly unsuitable substrate. The pinned temperate tree is `pine:1,3`, at (47,76,74), height 32 cells. Reverse chunk-order and regeneration checks still verify continuous trees.

## Tests and browser checks

All **28 cases across five procedural test files pass**. New tests cover canonical materials and shared ordinary/equation/authored access; pinned varied shore/deep/snow identities; snow exclusion underwater; unchanged subsurface geology; broad coherent biome regions; cross-chunk point/chunk agreement; higher pine density with the shared engine; suitable dry bases; mud buoyancy, transparency and solid bed collision; single water/mud interface; and compact save regeneration. Existing terrain, water, pine, authored voxel and collision regressions remain active.

The real Electron/SwiftShader terrain harness passes streaming, rendering, movement, save/reload, history, bounds and disposal. Its walking test routes around trunks instead of assuming an empty straight corridor. It measures material groups and geometry memory.

The real Sandbox Build/Play harness passes canonical face raycasts for sand, mud, LimestoneGravel and snow, meshed pines on snowy ground, and identical signatures after save/reentry. Water swimming, pine collision, authored objects, session permissions and teardown remain covered. No biome logic was added to production session code.

```sh
node --loader ./scripts/html-test-loader.mjs --test ApplicationSystem/public/MetaWorld/ProceduralVoxelWorld/*.test.mjs
env -u ELECTRON_RUN_AS_NODE node_modules/.bin/electron scripts/procedural-world.electron.cjs --no-sandbox
env -u ELECTRON_RUN_AS_NODE NV_WORLD_BROWSER=sandbox-session-browser.mjs node_modules/.bin/electron scripts/procedural-world.electron.cjs --no-sandbox
node scripts/voxel-material-benchmark.mjs
node scripts/voxel-material-benchmark.mjs 69 0
node scripts/voxel-biome-benchmark.mjs
```

## Performance

A fixed 4096-slot coordinate-checked column cache avoids repeated surface/noise work without Map-eviction overhead or a whole-world scan. Cache collisions only cause recomputation. Existing bounded feature caches remain in place.

Representative local Node measurements (100 chunks after ten warmups):

| Operation | Before median / p95 | Temperate after median / p95 | Snowy sample after median / p95 |
| --- | --- | --- | --- |
| Generation | .740 / 4.012 ms | .662 / 2.336 ms | .999 / 3.981 ms |
| Meshing | 7.361 / 21.100 ms | 5.590 / 13.569 ms | 5.652 / 17.484 ms |

The temperate fixture has fewer accepted trees because shore substrates reject pines, so lower timings are not a general speedup claim. The snowy sample encounters 85 tree/chunk intersections versus 28 in the temperate sample. Worst measured complete generation is 8.68 ms temperate and 7.21 ms snowy. Ten thousand deterministic point samples take about 4.06 ms for biome classification and 11.99 ms for final surface material queries (8.85 ms on repeat).

The browser radius-eight fixture retains 1445 records, two logical objects and two colliders including the authored box. Meshes increase **768 → 802**, geometry bytes **96107796 → 108530064** (about 12.9%), and pool size **8 → 12**. The final fixture has **1501 material groups**, maximum **8 groups in a chunk**. Earlier browser runs did not record actual group totals.

The final cold queue drain takes **8.27 s** versus the preceding pine run's **5.75 s**, with worst complete synchronous chunk **128.9 ms** versus **54 ms**. These are separate software-WebGL runs with changed geometry, not controlled frame-rate measurements. Denser forests and additional liquid interfaces increase work; synchronous streaming still has significant hitch risk. [Machine-readable results](procedural-voxel-biome-performance.json) retain both runs and the point-sampling data.

## Files changed and standards

Added: `Materials/Solids/LimestoneGravel.json`; `VoxelBiomes.mjs`; `VoxelSurfaceComposition.mjs`; `VoxelBiomes.test.mjs`; browser biome checks; point-sampling benchmark; report and performance results.

Changed: material CSV/rows/aliases; voxel identities, base terrain, runtime, liquid adapter, mesher and shared pine placement; environment liquid lookup; material/pine/water regression fixtures; browser/Sandbox fixtures; configurable region benchmark and current performance JSON. Sand, mud, snow and all pine JSON definitions are unchanged by this task.

The dirty-tree audit passes **36 native modules**, maximum **174 nonblank/noncomment lines**, including unrelated concurrent HTML/zoom edits that were left untouched. All changed supporting scripts are also below 200 total lines. No standards document was changed.

## Limits and next milestone

This is a two-biome classifier with sharp material classification at a broad smooth-field threshold, not a climate simulation or blended ecotone. Substrate is a one-cell surface layer, including shallow liquid mud. No rivers, falling materials, snow accumulation, melting, snow-covered foliage or extra movement model exist. Generic transparency may show ordering artifacts between water and mud. Existing heightfield/feature collision limitations remain.

The smallest next terrain milestone is a shared local-water-level provider for river beds to reuse these substrate rules; river routing itself remains a separate task. For responsiveness, worker meshing and a bounded upload queue remain the priority before increasing world detail further.
