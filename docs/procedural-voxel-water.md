<!-- Nodevision/docs/procedural-voxel-water.md -->
<!-- This report explains procedural V1 water generation, canonical material reuse, existing swimming integration, regression coverage, and measured costs. -->
# Procedural V1 water

## Existing water and reused behavior

Ordinary Game View liquids register bounding-box entries in `waterVolumes`; equation liquids use analytic point volumes. Matter-state helpers recognize canonical `MatterState: liquid` and legacy liquid flags. Liquid objects are excluded from solid collider registration. `EnvironmentRuntimeAbility` finds the active volume at a point; `PlayerMovementFrameAbility` samples the torso, sets `isSwimming`, enables vertical movement, applies the configured swim-speed multiplier, and uses the volume's buoyancy scale. The default world gas material remains separate and unchanged.

Procedural water uses these existing movement abilities. No new buoyancy, drag, gravity, swimming, gas, or fluid solver was introduced. Authored water and equation serialization/configuration remain unchanged.

## Canonical identity and rendering

The exact material is `water`, from `ApplicationSystem/public/MetaWorld/Materials/Liquids/water.json`. Its liquid state, non-solid collider, density 997 kg/m³, buoyancy scale 1, color `#2f83b7`, and opacity .48 come from the shared resolver/catalog. No material definition was added or modified for water.

Runtime palette index 5 maps to canonical `water`; indices 0–4 keep air, grass, soil, stone and limestone. The existing terrain material factory creates the canonical transparent, double-sided MeshBasicMaterial with depth writes disabled. Each world pools five materials; neither cells nor chunks allocate their own materials.

## Generation and compatibility

`VoxelTerrainParameters.mjs` centralizes `waterLevelVoxelY: 71`: the highest occupied water cell is Y=71 and the surface is Y=72 cells, or 18 metres above the terrain object's origin. `getTerrainHeight` still returns the first cell above solid terrain. Cells from that height through 71 become water; solids retain their original grass/soil/stone/limestone rules. Higher columns remain dry. Water clips to all finite dimensions, including partial edge chunks and worlds shorter than the water level.

Generation is coordinate-based and independent of traversal, chunks, sessions or rendering. Only requested cells/chunks are generated. This remains `nodevision-terrain-v1`, version 1. Development V1 worlds gain water when regenerated; no V2 or compatibility mode was added. The level is fixed in V1 code, so saves require no new parameter and still contain only the existing compact definition.

Pinned seed **123456**, local voxel coordinates:

| Coordinate | Material |
| --- | --- |
| (448,57,448) | grass, solid lakebed top |
| (448,58,448) | water |
| (448,71,448) | water |
| (448,72,448) | air |
| (0,75,0) | grass, dry land |
| (0,76,0) | air |
| (0,0,0) | stone |
| (0,32,0) | limestone |

## Meshing and collision

Internal water/water faces are culled, including across chunks. Water/air faces render. At water/solid boundaries only the solid face renders, retaining a visible lakebed through transparent water without duplicate internal liquid geometry. Each nonempty chunk remains one indexed mesh with up to five material groups. Three.js handles opaque and transparent material groups through its normal rendering passes.

One analytic heightfield collider continues to sample **solid terrain**, never the water surface. One analytic `waterVolumeRef` on the logical world root tests the generator-derived material at a world-space point. It exposes canonical liquid metadata and buoyancy; `EnvironmentRuntimeAbility` checks these object-owned volumes after registered ordinary volumes. It requires no entry per cell, column, or chunk and works before nearby graphics stream in. Translation, visibility and disposal are respected. Layer restoration recreates the volume with the runtime, avoiding stale registrations.

The live movement loop samples that volume using its existing torso check. Players can cross the water surface, swim using existing controls, and leave water. The solid lakebed remains available to collision. There is no procedural logic in Sandbox controllers: Build and Play use the same world and existing permissions.

## Files changed for water

- `VoxelMaterialIds.mjs`, `VoxelTerrainParameters.mjs`, `VoxelTerrainGenerator.mjs`: canonical index, fixed level and finite water cells.
- `VoxelChunkMesher.mjs`: liquid boundary face rules and solid-only voxel counts.
- `ProceduralVoxelWorldRuntime.mjs`, new `VoxelLiquidVolume.mjs`: one owned analytic liquid adapter.
- `EnvironmentRuntimeAbility.mjs`: discover object-owned point volumes through the shared movement path.
- New `VoxelWater.test.mjs`; existing canonical material tests and browser material fixture: water regression coverage and five-material pooling.
- New `scripts/voxel-water-session-browser.mjs`; Sandbox browser fixture: live Build/Play rendering, surface crossing, swimming, exit and identical shoreline after save/reentry.
- Water report, machine-readable performance results and existing terrain overview.

The preceding canonical-material work remains in the same dirty tree. All 18 dirty native JavaScript files pass headers and the strict fewer-than-200 nonblank/noncomment-line check; maximum 108. Changed supporting scripts are also below 200 total lines.

## Verification

All three procedural test files pass (17 cases). Coverage includes canonical water identity shared with ordinary/equation/authored materials, liquid properties, pinned wet/dry coordinates, deterministic save regeneration, finite/partial bounds, water/air and water/solid faces, cross-chunk culling, solid lakebed height, volume detection, visibility/translation/disposal, ordinary volume compatibility and compact saves. Existing grass, soil, stone and limestone checks pass.

The real Electron/SwiftShader procedural harness passes streaming, WebGL rendering, ground movement, finite boundaries, raycasting, HTML save/reload, history, disposal and authored patterns. The real Sandbox session harness passes Build and Play, renders and raycasts canonical water, moves through its surface without solid collision, observes the live `isSwimming` transition and exit, and compares the shoreline across saved session reentry. Existing Build authoring and Play restrictions remain covered. The fixture may choose any Sandbox seed; it discovers a deep wet coordinate and pins that shoreline across the session reload.

```sh
node --loader ./scripts/html-test-loader.mjs --test ApplicationSystem/public/MetaWorld/ProceduralVoxelWorld/*.test.mjs
env -u ELECTRON_RUN_AS_NODE node_modules/.bin/electron scripts/procedural-world.electron.cjs --no-sandbox
env -u ELECTRON_RUN_AS_NODE NV_WORLD_BROWSER=sandbox-session-browser.mjs node_modules/.bin/electron scripts/procedural-world.electron.cjs --no-sandbox
node scripts/voxel-material-benchmark.mjs
```

## Performance and limits

Same-session Node samples, 100 chunks after ten warmups:

| Operation | Before median / p95 | Water median / p95 |
| --- | --- | --- |
| Generation | .491 / 1.048 ms | .570 / 1.153 ms |
| Meshing | 3.543 / 16.867 ms | 4.921 / 12.490 ms |

Generation adds approximately .079 ms median with no catalog work per voxel. Additional exposed water surfaces increase meshing work. These are short local measurements, not production frame guarantees.

The radius-eight browser fixture keeps 1156 chunk records and the same two logical objects/two solid colliders including the authored box. Compared with the preceding material milestone, meshes increase 642 → 681, exposed faces 654640 → 777467, and geometry bytes 70701120 → 83966436 (about 18.8%). Pool size increases four → five. The water run takes 4.86 seconds to drain the queue, with a 50.1 ms worst chunk; the older browser baseline took 2.55 seconds, but conditions differ, so this is not a controlled latency comparison. Normal streaming remains one chunk per update and can hitch. [Recorded measurements](procedural-voxel-water-performance.json) preserve both runs.

Water is static and read-only, with no flow, rivers, oxygen, drowning, inventory, currents or fluid propagation. Generic transparency sorting can still show intersecting-surface artifacts; no bespoke shader or refraction was added. Existing swimming is torso-based rather than continuous submerged-body physics. The volume queries runtime material identity, so future sparse overrides can supply water/air/solid changes through that query, but the heightfield collision model would also need upgrading for carved holes or caves.

The smallest next water milestone is targeted shoreline/underwater visual validation on hardware WebGL, including transparent sorting and submerged camera presentation, while retaining the shared liquid behavior. Worker-based meshing remains the next streaming improvement.
