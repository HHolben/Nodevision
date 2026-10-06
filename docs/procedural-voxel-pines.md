<!-- Nodevision/docs/procedural-voxel-pines.md -->
<!-- This report documents canonical pine materials, the bounded procedural feature layer, deterministic voxel trees, collision, verification and measured costs. -->
# Development V1 pine trees

This report records the pine milestone. The [shoreline and biome update](procedural-voxel-biomes.md) changes eligible pine ground, density, regression coordinates and the material pool.

## Existing infrastructure and architecture

The shared material registry/CSV/catalog, resolver, pooled terrain-material factory, deterministic height/noise functions, chunk manager, neighbor-aware mesher, water volume adapter and compact serializer were reusable. Equation configuration and authored voxel material selection already consume the same catalog. No terrain vegetation, wood/bark/foliage definitions, biome system, placement grid, or general procedural-feature layer existed. Behavior-tree AI and UI trees are unrelated.

A small feature layer now separates placement from shape. `VoxelBaseTerrain` retains the original heights, strata and water. `FeatureField` queries nearby placement cells, while `PinePlacement` decides where trees can grow and `PineShape` samples their materials. `VoxelTerrainGenerator` composes the final field. There are no model assets, tree scene objects, tree meshes, per-tree materials or per-tree colliders.

## Canonical materials

Three normal material definitions were added under `MetaWorld/Materials/Solids/` and registered in `Materials.csv`, built-in fallback rows and canonical aliases:

| ID / file | Color | Matter state | Collider solid | Density | Roughness |
| --- | --- | --- | --- | --- | --- |
| PineWood / PineWood.json | #c49a64 | solid | true | 500 kg/m³ | .65 |
| PineBark / PineBark.json | #594434 | solid | true | 450 kg/m³ | .95 |
| PineFoliage / PineFoliage.json | #244d32 | solid | false | 180 kg/m³ | .85 |

These are initial gameplay material defaults, not measured species-specific engineering data. No existing foliage semantics were available. Foliage therefore uses opaque rendering and explicitly non-solid collision, allowing passage without inventing a plant physics model. Wood and bark use the existing solid material schema. Opacity is 1 for all three; no extra transparency sorting is introduced by foliage.

Palette indices 6, 7 and 8 map to those exact IDs. Definitions and colors stay outside the generator. The same resolver, file mappings, equation selection and authored voxel configuration expose them outside procedural terrain. Ordinary object visual/solid overrides remain their existing behavior.

## Placement

Each six-metre (24-cell) placement region derives one coordinate-jittered candidate and a tree seed from world seed, region coordinates and a pine-specific salt. A smooth density field with a 192-cell wavelength rejects low-density regions; surviving candidates use probability `.12 + .48 * field`. No sequential RNG is used.

Candidates require grass/soil, solid surface above the highest water cell, a maximum three-voxel elevation range across the center and four samples three voxels away, and room for the complete bounding box within every world dimension. There is no full-world scan. The seed-123456 fixture finds 12 accepted trees intersecting its first 256×256-cell sample area, leaving substantial open ground.

## Shape and parameters

At the fixed quarter-metre voxel scale:

- Height: 28–44 cells, or 7–11 m.
- Trunk radius at base: 1.6–2.3 cells, giving roughly .8–1.15 m diameter before voxel discretization.
- Crown start: 28–38% of height, floored to whole cells.
- Maximum crown radius: 7–10 cells, or 1.75–2.5 m.
- Crown taper exponent: .75–1.25; asymmetry amplitude .3–.8 cells.

The trunk has an approximately circular cross-section, a wood core, a bark shell and a taper to narrow upper sections. Crown radius decreases with height and varies within six-cell tiers. Seeded phase shifts, small horizontal asymmetry and sparse outer-canopy gaps break up the silhouette. Four short branch spokes rotate between tiers and shorten with the crown. These narrow branches are bark-only at this resolution; expanding them into thicker wood-core branches is possible in the shape sampler.

## Composition and chunk boundaries

Base terrain and water have priority and cannot be overwritten. Structural wood/bark beats foliage; foliage fills otherwise empty cells. Within a tree, trunk sampling precedes branches and foliage. Overlapping features use stable region ordering for equal-priority ties.

A chunk queries only placement cells whose maximum feature reach can overlap its bounds. It samples the intersecting portion of each accepted feature box. Final point queries use the same shape and composition rules, including neighbor cells during meshing. Candidates have stable region IDs and are not duplicated per chunk. A bounded 512-entry candidate cache and 64-entry point-query neighborhood cache prevent repeated work without retaining the world's forest. Chunk voxel buffers remain temporary.

Trees pass through the existing indexed chunk mesher and pooled eight-material palette. Opaque interfaces cull normally. The occupancy bound grows from four to five vertical chunk layers to include the tallest possible trees. Future sparse overrides belong after this composed field, so removing generated bark can become an ordinary air override.

## Collision, sessions and persistence

The ground heightfield remains the terrain surface. A bounded feature-voxel callback on the same collider checks the player cylinder against nearby cells and reads canonical `collider.solid`; it blocks wood/bark and ignores foliage. The grounded-heightfield shortcut does not bypass this feature check. There is no collider per voxel or per tree. Box/compound geometry helpers were extracted from the existing oversized collision module so both touched modules satisfy the line rule; their algorithms are unchanged.

Tree generation is independent of Sandbox mode. Build and Play display the same final voxel field and keep existing authoring permissions. Saves contain only the existing generator ID/version/seed and definition, with no tree descriptors, tree voxels or generated children. Parameters are fixed in code for development `nodevision-terrain-v1`, version 1; no V2 was created. Existing development worlds gain trees on regeneration.

## Regression fixtures and tests

For seed **123456**, candidate `pine:0,1` starts at **(16,72,45)** and is **37 cells** tall. Fixed final queries:

| Coordinate | Material |
| --- | --- |
| (16,72,45) | PineWood |
| (18,72,45) | PineBark |
| (25,81,33) | PineFoliage |
| (16,71,45) | grass |
| (31,72,28) | PineBark, crossing a chunk boundary |
| (32,72,28) | PineWood, across that boundary |

Four procedural test files pass, totaling **23 cases**. New coverage includes canonical definitions and ordinary/equation/authored access, deterministic candidates and dimensions, wood core/bark/crown, bounds, slope/material/water rejection, density, exact query/chunk equivalence, reverse chunk order, reload, cache bounds, opaque face suppression, trunk collision, foliage solidity, visibility/disposal, compact saves, and unchanged box/compound collision. Existing terrain and water cases remain passing.

The real Electron/SwiftShader procedural harness passes rendering, streaming, movement, boundaries, history, save/reload and authored voxels. The Sandbox fixture uses known seed 123456 and checks visible bark, foliage groups, wood-core identity, trunk collision, clearance beside trunks, voxel stability after travel and identical tree parameters across Build/save/Play. Its water swimming and authoring-permission checks remain active.

```sh
node --loader ./scripts/html-test-loader.mjs --test ApplicationSystem/public/MetaWorld/ProceduralVoxelWorld/*.test.mjs
env -u ELECTRON_RUN_AS_NODE node_modules/.bin/electron scripts/procedural-world.electron.cjs --no-sandbox
env -u ELECTRON_RUN_AS_NODE NV_WORLD_BROWSER=sandbox-session-browser.mjs node_modules/.bin/electron scripts/procedural-world.electron.cjs --no-sandbox
node scripts/voxel-material-benchmark.mjs
```

## Performance

Same-session representative Node benchmark, 100 measured chunks after ten warmups:

| Operation | Water-only median / p95 | Pines median / p95 |
| --- | --- | --- |
| Generation | .531 / .907 ms | .646 / 3.014 ms |
| Meshing | 4.851 / 12.663 ms | 6.697 / 19.144 ms |

An additional instrumented 110-chunk run measured 5.53 ms total candidate lookup (about .050 ms/chunk) and 51.81 ms feature sampling (about .471 ms/chunk), including warmups. It encountered 44 feature/chunk intersections; worst measured complete generation was 15.46 ms. Feature cost varies substantially between empty and wooded chunks.

In the radius-eight browser sample, resident records grow 1156 → 1445, nonempty meshes 681 → 768, and geometry bytes 83966436 → 96107796 (about 14.5%). Logical objects and colliders remain two each including the authored box. The pine run drains the queue in 5.75 seconds versus the earlier water run's 4.86 seconds; maximum complete synchronous chunk build is 54 ms versus 50.1 ms. These separate software-WebGL runs are not a controlled production frame-rate benchmark. Foliage adds opaque surfaces and material groups, not transparent passes. [Machine-readable measurements](procedural-voxel-pine-performance.json) preserve the results.

## Files and standards

Added: canonical pine JSON definitions; `SeededVoxelNoise`, `VoxelBaseTerrain`, `Features/FeatureField`, `Features/PinePlacement`, `Features/PineShape`, `VoxelFeatureCollision`, `VoxelPine.test`, `compoundPlayerCollision`, the pine Sandbox browser check and this report/results.

Changed: material CSV/fallback rows/aliases; voxel ID mapping, generator and runtime; collision dispatcher; canonical-material tests; material/browser/Sandbox fixtures; benchmark; current performance JSON and terrain overview. Earlier canonical-material and water edits remain in the working tree.

All 27 dirty native JavaScript modules pass required headers and fewer-than-200 nonblank/noncomment lines; the maximum is 163. Supporting scripts are also below 200 total lines. The standards document was not modified.

## Limitations and next milestone

Trees remain read-only, with no roots, growth, biomes, harvesting, inventory, fire or dynamic entities. Nearby candidates can overlap crowns; this is deterministic and intentionally does not solve ecological spacing. Foliage is an opaque volume rather than individually rendered needles. Branches are simple bark spokes. The player collision callback tests the proposed body position, matching the existing movement model; it is not swept collision. Ground/support sampling remains the terrain heightfield, so branch-top walking is not a supported new movement feature.

Synchronous meshing can still hitch; workers and a bounded upload queue remain the rendering priority. The most logical next feature milestone is sparse voxel overrides after composition, shared by terrain and trees, with collision/support queries updated to honor removed or placed cells before exposing tree harvesting.
