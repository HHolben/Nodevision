<!-- Nodevision/docs/procedural-voxel-landscape.md -->
<!-- This report describes the expanded development V1 landscape, its shared runtime systems, validation and remaining limitations. -->

# Expanded V1 landscape

All generation remains `nodevision-terrain-v1`. Existing development seeds can change appearance; saves retain the finite procedural definition and seed, not generated trees, plants, watercourses or mountain voxels.

## Reused systems and changed files

The existing canonical material resolver/palette, quarter-metre voxel coordinates, seeded noise, feature field, chunk mesher, finite heightfield collision, feature-solid collision and liquid-volume adapter support these additions. No external dependency, prebuilt tree model, per-tree scene object or per-tree collider was introduced.

The terrain implementation is in `ApplicationSystem/public/MetaWorld/ProceduralVoxelWorld/`:

- `VoxelMountains.mjs`, `VoxelMountainSurface.mjs`, `VoxelBaseTerrain.mjs`: regional relief, exposed surfaces, waterway carving and moss banks.
- `VoxelWaterways.mjs`: bounded drainage paths and water columns.
- `Features/BroadleafShape.mjs`, `MapleShape.mjs`, `OakShape.mjs`, `MagnoliaShape.mjs`: shared branch/lobe sampler and species configurations.
- `Features/TreeEcology.mjs`, `TreePlacement.mjs`, `SunflowerPlacement.mjs`: habitat, placement and plant geometry. The mixed tree provider replaces `PinePlacement.mjs`.
- `VoxelMaterialIds.mjs`, `VoxelTerrainGenerator.mjs`: canonical palette and feature composition.
- `VoxelChunkLevels.mjs`, `VoxelChunkManager.mjs`, `VoxelSpawn.mjs`, `ProceduralVoxelWorldRuntime.mjs`: local vertical streaming and dry supported spawn selection.
- Terrain regression suites, including `VoxelMountains.test.mjs` and `VoxelWaterways.test.mjs`.

Material definitions reside in `ApplicationSystem/public/MetaWorld/Materials/Solids/`, registered in `Materials.csv` and `Materials/MaterialCatalogRows.mjs`. Browser coverage uses `scripts/voxel-mountain-session-browser.mjs`, `sandbox-session-browser.mjs`, `procedural-world-browser.mjs`, and `voxel-material-render-browser.mjs`. Benchmarks use `voxel-material-benchmark.mjs` and `voxel-landscape-benchmark.mjs`.

## Mountains, bounds and snow

The existing rolling field remains intact beneath a smooth regional mountain mask at 256 m scale. A 48 m ridge field and 96 m peak field add up to 80 m relief. Foothills follow a smooth threshold transition rather than multiplying high-frequency noise.

The existing 128 m world height safely accommodates the default terrain maximum of 107 m plus the configured trees. A 16 m tree allowance is reserved when computing relief. Shorter authored worlds reduce mountain amplitude before sampling instead of silently clipping full-sized peaks. Seed `123456` has a 100.25 m peak at voxel `(1632,2816)`, more than 80 m above its lowland reference. Generation stays finite and local.

Snow starts near 60 m with deterministic ±4 m variation and a 6 m lower line in cold regions. Only exposed top cells become canonical snow. Steep faces expose stone/limestone; subsurface mountain geology remains rock. Lowland Snowy Pine Forest continues to use its existing snow surface.

Local chunk-level queries retain visible terrain/water/feature ranges, bottom faces and finite-world boundary faces. Buried interior levels are skipped. Spawn search checks local water elevation, slope and solid features within a bounded 128 m search radius.

## Trees and materials

| Species | Height | Shape and canonical materials |
| --- | --- | --- |
| Maple | 7–11 m | Light wood core, gray-brown bark, green foliage; upright tapered trunk, five major branches, rounded irregular lobes. |
| Oak | 8–13 m | Warm wood core, dark bark, deep green foliage; thicker crooked trunk, six heavier branches, wider lobes. |
| Magnolia | 6–9 m | Magnolia wood, bark, dark foliage and pale pink-white blossoms; low spreading branches and broad crown. |

Wood and bark are solid; foliage, blossoms and sunflower parts are non-solid canonical materials. Moss is a solid surface material. All are available through the ordinary material catalog, including authored worlds and voxels. The procedural palette now pools 26 non-air materials per world.

Tree species follow coherent habitat noise, elevation and temperature. Cold regions favor pine; temperate regions contain pine, maple, oak and magnolia. Broadleaf trees stop at 45 m, pine at 60 m (54 m in cold regions). Maximum sampled slope is .5 for broadleaf and .75 for pine. A 12 m ownership grid with bounded jitter provides at least 10 m between tree centers. Tree placement rejects wet ground and unsuitable surfaces.

Sunflowers form seeded patches on gentle dry temperate grass, with green stems/leaves, yellow petals and dark seed heads. Their 0.25 m voxel resolution produces deliberately blocky flowers. Moss replaces suitable low bank surfaces near generated waterways.

Feature bounds determine neighboring chunk queries. Only intersecting portions are sampled. Ground/water is preserved; structural tree voxels outrank foliage and flowers. Candidate caches are bounded and generation order does not affect results.

## Ponds, streams, creeks and waterfalls

Each eligible 64 m drainage region starts from a deterministic source and follows strictly descending terrain samples in bounded 2 m steps. Narrow early segments form creeks; longer downstream paths widen into streams. Source and terminal basins form ponds. Steep drops include vertical water curtains joining upper channels to lower channels. Carved beds, liquid queries, rendering and swimming all use the same canonical water cells.

Water is static generated geometry, not a fluid simulation. Paths are regional and may end in ponds; they do not yet form a connected watershed across region boundaries. There is no erosion, seasonal flow, splash effect, current force or waterfall audio. Banks and falls remain voxel-stepped. This is the main next hydrology milestone: connect regional drainage into continuous catchments while preserving bounded local queries.

Seed `123456` inspection fixtures (voxel coordinates):

| Feature | Coordinate |
| --- | --- |
| Magnolia trunk | `(697,79,21)` |
| Sunflower stem | `(570,99,6)` |
| Moss surface | `(1472,84,56)` |
| Pond water | `(1484,83,52)` |
| Creek water | `(3876,115,116)` |
| Waterfall water | `(3882,120,116)` |
| Stream water | `(3002,73,332)` |

## Validation and performance

Eight Node test files pass (37 individual cases), covering canonical identities, shape structure, bounds, determinism, downhill routes, water columns, chunk regeneration, ecology, collision, residency, save behavior, avatar feet and jump height. Command:

`node --loader ./scripts/html-test-loader.mjs --test ApplicationSystem/public/MetaWorld/ProceduralVoxelWorld/*.test.mjs ApplicationSystem/public/PanelInstances/ViewPanels/GameViewDependencies/playerBody.test.mjs`

The Electron Sandbox harness passed actual Build and Play startup, canonical rendering at the mountain/tree/plant/water fixtures, compact HTML save and seed reuse, ordinary-world preservation, shared avatar/console checks and teardown. The normal Game View harness passed rendering, walking, boundaries, raycasting, streaming, save/history and disposal. Harness output included existing missing optional registry/CSP and ResizeObserver warnings.

Detailed final measurements are recorded in `procedural-voxel-landscape-performance.json`; the normal browser snapshot is also in `procedural-voxel-performance.json`. These are local development measurements, not a frame-time guarantee. The prior biome-only browser snapshot is archived in `procedural-voxel-biome-performance.json`; comparisons span separate runs and changed feature density. No startup pass inventories the entire 1 km world.

All terrain/player modules touched by this work conform to fewer than 200 nonblank, noncomment lines. The complete dirty-file audit separately identifies the unrelated `PHPeditor.mjs` at 913 code lines (910 in HEAD); that concurrent editor work was left intact.

Final normal-browser measurements: 893 loaded chunks, 794 meshes, 1,296 material groups (maximum nine per chunk), 26 pooled materials, 92,379,204 geometry bytes and two collider objects. Initial readiness was 513.5 ms; complete radius-eight load was 8,332 ms. Accumulated generation was 3,441.9 ms and meshing 4,405.0 ms; maximum synchronous chunk build was 49.4 ms. This remains a potential frame hitch on slower hardware.

The 100-chunk Node sample measured generation p50/p95 1.21/6.43 ms and meshing 4.15/8.63 ms, with worst generation 18.41 ms. Feature lookup totaled 7.48 ms and sampling 65.29 ms across 33 candidate references. Ten thousand final terrain-height queries took 76.11 ms. Isolated maple sampling took 71.59 ms for 96,040 bounding-box samples; oak took 38.16 ms for 112,847 samples. These one-run shape numbers include JIT/order effects and do not imply oak is intrinsically cheaper.

The earlier mountain-only snapshot had 891 chunks, 791 meshes, 90,858,240 geometry bytes and 18 pooled materials. Added plants/water increased geometry by about 1.7%, with two more loaded chunks and three more meshes. That snapshot's complete load was 5.83 s; the expanded final landscape is costlier despite bounded caches and local streaming. The immediate performance follow-up is profiling feature/column sampling before increasing vegetation density.
