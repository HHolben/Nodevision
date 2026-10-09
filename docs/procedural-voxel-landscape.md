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
- `Features/TreeEcology.mjs`, `TreePlacement.mjs`: habitat, placement and plant geometry. The mixed tree provider replaces `PinePlacement.mjs`.
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

Wood and bark are solid; foliage, blossoms and sunflower parts are non-solid canonical materials. Moss is a solid surface material. All are available through the ordinary material catalog, including authored worlds and voxels. The procedural palette now pools 36 non-air materials per world, including Pine Needles and the apple, pear and cherry materials.

Tree species follow coherent habitat noise, elevation and temperature. Cold regions favor pine; temperate regions contain pine, maple, oak and magnolia. Broadleaf trees stop at 45 m, pine at 60 m (54 m in cold regions). Maximum sampled slope is .5 for broadleaf and .75 for pine. A 12 m ownership grid with bounded jitter provides at least 10 m between tree centers. Tree placement rejects wet ground and unsuitable surfaces.

Sunflower generation has been removed. Existing canonical sunflower materials remain available for authored content and stable palette IDs. Moss replaces suitable low bank surfaces near generated waterways.

Feature bounds determine neighboring chunk queries. Only intersecting portions are sampled. Ground/water is preserved; structural tree voxels outrank foliage and flowers. Candidate caches are bounded and generation order does not affect results.

## Apple, pear and cherry trees

`Features/OrchardTreeShapes.mjs` uses the shared broadleaf sampler for low spreading apples (5–7 m), narrower upright pears (7–9.5 m), and raised branching cherry crowns (6.25–9 m). Each species has canonical Wood, Bark and Foliage materials in the catalog. Wood and bark are solid; leaves are non-blocking. No fruit materials or fruit geometry are generated.

Coherent temperate habitat patches select these species below the existing broadleaf tree line. Cold regions remain pine habitat. Dry ground, slope limits, deterministic spacing, chunk boundaries and compact procedural saves follow the existing tree provider. The same provider also supplies standing-dead and fallen variants, using the new species' wood and bark.

Seed `123456` living-tree origins (voxel coordinates) are apple `(1130,91,981)`, pear `(933,79,24)` and cherry `(987,81,71)`. `VoxelOrchardTrees.test.mjs` checks material resolution and solidity, fruitless bounded shapes, living/dead/fallen placement, rendered material groups and point/chunk agreement after regeneration.

## Pine needles and tree variants

`PineNeedles.json` registers the brown Pine Needles material in the shared catalog, with a stable appended voxel palette ID. `Features/PineNeedleBed.mjs` adds irregular beds approximately 1.25–1.75 m in radius around pine roots, following dry grass, soil and moss. Beds skip water and snow-covered ground. They occupy one 0.25 m voxel layer but are loose, non-blocking litter; underlying terrain retains its ground support and roots take priority.

`Features/TreeVariants.mjs` gives pine, maple, oak and magnolia living, standing-dead and fallen forms. Seeded selection requests 10% fallen and another 12% standing dead; unsuitable fallen placements become standing dead. Dead trees retain the species' bare trunk and branches without foliage or blossoms. Fallen trunks retain species-specific wood and bark, tapered bodies, exposed ends and short bare branch stubs. They are static solid features, not simulated falling objects. Ground slope, support and world-bound checks reject unsuitable logs. The bounded feature query reach includes their horizontal extent, including neighboring chunks.

Living magnolias remain in warm broadleaf habitat with their existing spreading crowns and pale blossoms. No duplicate magnolia provider or per-tree scene objects were added. Trees and litter regenerate from the existing seed and are not expanded into saved world data.

Seed `123456` tree origins, in voxel coordinates:

| Species | Standing dead | Fallen |
| --- | --- | --- |
| Pine | `(2276,77,27)` | `(1609,94,71)` |
| Maple | `(357,76,26)` | `(2903,83,68)` |
| Oak | `(2805,90,73)` | `(1177,77,24)` |
| Magnolia | `(2617,78,70)` | `(2762,90,308)` |

Living magnolia remains at `(697,79,21)`; a pine with a needle bed is at `(1415,84,75)`. `VoxelTreeVariants.test.mjs` covers canonical material resolution, supported beds, magnolia blossoms, all eight dead/fallen combinations, log collision, non-blocking needles, neighboring-chunk discovery, meshing and deterministic regeneration.

## Ponds, streams, creeks and waterfalls

Each eligible 64 m drainage region starts from a deterministic source and follows strictly descending terrain samples in bounded 2 m steps. Narrow early segments form creeks; longer downstream paths widen into streams. Source and terminal basins form ponds. Steep drops include vertical water curtains joining upper channels to lower channels. Carved beds, liquid queries, rendering and swimming all use the same canonical water cells.

Water is static generated geometry, not a fluid simulation. Paths are regional and may end in ponds; they do not yet form a connected watershed across region boundaries. There is no simulated erosion, seasonal flow, splash effect, current force or waterfall audio. Banks and falls remain voxel-stepped. This is the main next hydrology milestone: connect regional drainage into continuous catchments while preserving bounded local queries.

Seed `123456` inspection fixtures (voxel coordinates):

| Feature | Coordinate |
| --- | --- |
| Magnolia trunk | `(697,79,21)` |
| Moss surface | `(1472,84,56)` |
| Pond water | `(1484,83,52)` |
| Creek water | `(3876,115,116)` |
| Waterfall water | `(3882,120,116)` |
| Stream water | `(3002,73,332)` |

## Caverns, ravines, canyons and cliffs

`VoxelLandforms.mjs` adds seeded erosion regions in higher terrain, leaving low rolling hills and the original mountain field intact. Narrow ravines, wider canyons and asymmetric cliffs occur selectively in 128 m regions. Edges blend back into their surroundings; exposed faces use canonical stone or limestone. These are bounded procedural shapes, not a geological erosion simulation.

`VoxelCaverns.mjs` carves chambers beside ravines and canyons with open side passages. Limestone stalactites descend from their ceilings and stalagmites rise from their floors. Formation placement is seeded, solid, and shared by point queries, chunk generation and collision. Caverns remain above the global water plane. This first version uses separate chambers rather than an interconnected underground network.

Chunk level queries include underground floors and ceilings. Player ground queries select the accessible surface below the feet rather than snapping to the mountain above. The existing terrain collider now also checks nearby solid voxels for walls, ceilings and formations; no persistent per-voxel colliders are created.

Seed `123456` inspection coordinates (voxels): ravine center `(256,768)`, canyon center `(256,1280)`, cliff center `(2816,768)`, and a clear cavern passage at `(156,175,1280)`. World metre coordinates are voxel coordinates multiplied by .25, plus terrain origin. Four landform regressions cover preserved relief, connected entrances, anchored formations, streaming/regeneration, underground ground selection and ceiling collision.

## Validation and performance

Current landform/sleep revision: all 14 terrain, astronomy, weather, Sandbox planner and pause regression files pass. All 17 dirty native JavaScript files pass the standards audit. The Electron fixtures now include underground rendering/collision and the single seven-choice sleep control, but their latest run could not initialize Chromium shared memory in this environment (`/dev/shm` and temporary-directory fallback both failed). The successful browser runs and performance numbers below describe the earlier landscape revision, not this latest visual verification.

Eight Node test files pass (37 individual cases), covering canonical identities, shape structure, bounds, determinism, downhill routes, water columns, chunk regeneration, ecology, collision, residency, save behavior, avatar feet and jump height. Command:

`node --loader ./scripts/html-test-loader.mjs --test ApplicationSystem/public/MetaWorld/ProceduralVoxelWorld/*.test.mjs ApplicationSystem/public/PanelInstances/ViewPanels/GameViewDependencies/playerBody.test.mjs`

The Electron Sandbox harness passed actual Build and Play startup, canonical rendering at the mountain/tree/plant/water fixtures, compact HTML save and seed reuse, ordinary-world preservation, shared avatar/console checks and teardown. The normal Game View harness passed rendering, walking, boundaries, raycasting, streaming, save/history and disposal. Harness output included existing missing optional registry/CSP and ResizeObserver warnings.

Detailed final measurements are recorded in `procedural-voxel-landscape-performance.json`; the normal browser snapshot is also in `procedural-voxel-performance.json`. These are local development measurements, not a frame-time guarantee. The prior biome-only browser snapshot is archived in `procedural-voxel-biome-performance.json`; comparisons span separate runs and changed feature density. No startup pass inventories the entire 1 km world.

Native files touched by this work conform to fewer than 200 nonblank, noncomment lines. Run `node scripts/audit-dirty-standards.mjs` to check the current working tree.

Historical measurements before the cavern addition (not a new cavern benchmark): 893 loaded chunks, 794 meshes, 1,296 material groups (maximum nine per chunk), 26 pooled materials, 92,379,204 geometry bytes and two collider objects. Initial readiness was 513.5 ms; complete radius-eight load was 8,332 ms. Accumulated generation was 3,441.9 ms and meshing 4,405.0 ms; maximum synchronous chunk build was 49.4 ms. This remains a potential frame hitch on slower hardware.

The 100-chunk Node sample measured generation p50/p95 1.21/6.43 ms and meshing 4.15/8.63 ms, with worst generation 18.41 ms. Feature lookup totaled 7.48 ms and sampling 65.29 ms across 33 candidate references. Ten thousand final terrain-height queries took 76.11 ms. Isolated maple sampling took 71.59 ms for 96,040 bounding-box samples; oak took 38.16 ms for 112,847 samples. These one-run shape numbers include JIT/order effects and do not imply oak is intrinsically cheaper.

The earlier mountain-only snapshot had 891 chunks, 791 meshes, 90,858,240 geometry bytes and 18 pooled materials. Added plants/water increased geometry by about 1.7%, with two more loaded chunks and three more meshes. That snapshot's complete load was 5.83 s; the expanded final landscape is costlier despite bounded caches and local streaming. The immediate performance follow-up is profiling feature/column sampling before increasing vegetation density.
