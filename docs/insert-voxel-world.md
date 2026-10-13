# Insert → Voxel World

Implemented in Virtual World Editing and VR World Editing. Generate inserts one logical object; Cancel and invalid inputs leave the document unchanged. Layers selects the object, and the existing Inspect / Modify panel displays its definition, streaming status, and **Edit Generation Parameters** action. The normal inspection action can also resolve a generated chunk to its owning terrain object.

## Architecture audit and reuse

- `ToolbarJSONfiles/insertToolbar.json` and the existing callback loader register the command.
- `registerMetaWorldLayerBridge` in `worldLoading.mjs` already owns object definitions, Layers, dirty state, and undo/redo snapshots. A small `VoxelWorldAuthoringBridge.mjs` adapter adds insertion and regeneration to that bridge.
- `ProceduralVoxelWorldRuntime`, `VoxelTerrainGenerator`, `VoxelChunkManager`, `VoxelChunkMesher`, `VoxelFeatureCollision`, and `VoxelLiquidVolume` supply the existing engine. No separate voxel engine or world reset is introduced.
- `VoxelMaterialPalette`, canonical materials, seeded biomes, waterways, caves, and tree providers are reused. Existing Sandbox definitions continue to use their original defaults.
- The existing `serializeMesh` and MetaWorld loader already save/restore compact procedural objects and exclude generated chunks. The new metadata follows that path.
- The existing floating inventory-panel component supplies the dialog and Properties presentation.

## Configuration

| Field | Default / supported range |
|---|---|
| World Name | Voxel World; 1–120 characters |
| Seed | Random signed 32-bit value; text accepted through deterministic FNV-style UTF-16 hashing; numeric safe integers normalized to signed 32-bit |
| World Size X / Z | 256 m; quarter-meter values from 1 to 4096 m |
| Minimum / Maximum Height | -16 / 64 m; quarter-meter limits within -256 to 256 m; positive span at most 256 m |
| Voxel Size | 0.25 m, read-only because V1 requires it |
| Chunk Size | 32 per axis, read-only because V1 requires it |
| Terrain Type | Existing V1 generator |
| Advanced | Trees/vegetation, water, and caves, enabled by default |

Roughness, noise scale, editable water elevation, forced biome selection, and alternate presets are omitted: they are not supported per-object configurations of this generator. Disabling water retains existing landforms and dry waterway beds. Disabling vegetation or caves bypasses those existing generators.

## Local coordinates and persistence

Insertion centers the horizontal footprint around scene coordinates (0, 0) and puts the logical origin's Y coordinate on the existing ground plane. Local X/Z coordinates run from zero to the configured width/depth. Local minimum elevation offsets the voxel volume downward without moving the object's logical origin. Mesh placement, solid collision, feature collision, liquids, and spawn sampling use the same offset. Regeneration preserves the current scene position and object ID.

An object has type `procedural-voxel-world` and retains the existing `id`, `name`, `position`, `size`, `voxelSize`, `generator: {id: "nodevision-terrain-v1", version: 1, seed}`, and `chunks: {voxelsPerAxis: 32, loadRadius}` fields. Additions are `heightLimits: {min,max}`, `generation: {vegetation,water,caves}`, `materialPalette: "nodevision-canonical-v1"`, `biomeSource: "nodevision-biomes-v1"`, and `boundaryMode: "open"`. Only the normalized numeric seed is persisted. Generated cells and meshes are not serialized.

Unknown generator IDs/versions and unsupported reference identifiers fail validation. Future incompatible generator changes must use a new version and retain the V1 implementation for saved V1 documents. Existing documents without authoring extensions retain the original terrain origin, feature defaults, and closed Sandbox boundary behavior. Insertion does not enable Sandbox gameplay, astronomy, or ground-only metadata.

## Lifecycle and limits

Insertion and regeneration use the existing world snapshot history. Regeneration disposes old chunk geometry, materials, collision references, and pending streaming queues before registering the replacement under the same identity. Deletion, undo/redo, and world teardown reuse existing disposal paths. Disposed runtimes cannot resume when asynchronous material loading finishes.

Each frame builds at most one fixed-size chunk per terrain. Vertical occupancy queries are now deferred to one queued column per update instead of scanning all nearby columns on a streaming-center change. No full-world voxel volume is allocated. Streaming continues while the simulation is paused, using the active camera. Properties reports loaded and queued work. Hide pauses streaming; deletion cancels it and releases resources. Generation still runs incrementally on the main thread; an individual expensive chunk can exceed a frame budget.

One procedural terrain object per scene is supported by this insertion command. A second insertion is rejected explicitly; unrelated authored objects are preserved. Rotation and non-unit scaling remain unsupported. Generated terrain cells remain read-only and manual cell deltas are not persisted; the dialog and Properties state this limitation. Separate authored objects are not discarded during regeneration.

## Validation

- All 13 voxel/Sandbox-planner Node test files passed, including new authoring validation, deterministic seeds, origin/collision agreement, fixed-volume allocation, deferred column work, and resource disposal.
- `insert-voxel-world-browser.mjs` passed in Electron: actual command/dialog, cancel, invalid dimensions, rendering, Layers, selection/Properties, compact HTML save/reload, regeneration identity/placement, undo/redo, unrelated-object preservation, and deletion.
- `voxel-world-sandbox-browser.mjs` passed: actual Build/Play startup, regeneration, compact save, seeded reentry, authoring restrictions, and teardown.
- The older full `sandbox-session-browser.mjs` fails its fixed `Build: rendered MapleFoliage` assertion on both the modified tree and untouched HEAD application modules. This pre-existing landscape fixture is not changed here.

```sh
node --loader ./scripts/html-test-loader.mjs --test ApplicationSystem/public/MetaWorld/SandboxWorldPlanner.test.mjs ApplicationSystem/public/MetaWorld/ProceduralVoxelWorld/*.test.mjs
env -u ELECTRON_RUN_AS_NODE NV_WORLD_BROWSER=insert-voxel-world-browser.mjs xvfb-run -a node_modules/.bin/electron --no-sandbox --disable-dev-shm-usage scripts/procedural-world.electron.cjs
env -u ELECTRON_RUN_AS_NODE NV_WORLD_BROWSER=voxel-world-sandbox-browser.mjs xvfb-run -a node_modules/.bin/electron --no-sandbox --disable-dev-shm-usage scripts/procedural-world.electron.cjs
```

## Files

New modules: `VoxelAuthoringDefinition.mjs`, `VoxelWorldAuthoringBridge.mjs`, `VoxelWorldDialog.mjs`, `VoxelWorldProperties.mjs`, and `VoxelWorldAuthoring.test.mjs` under `ApplicationSystem/public/MetaWorld/ProceduralVoxelWorld/`; `ToolbarCallbacks/insert/insertVoxelWorld.mjs`; the two browser fixtures named above.

Updated voxel modules: `VoxelWorldDefinition.mjs`, `VoxelTerrainGenerator.mjs`, `VoxelBaseTerrain.mjs`, `VoxelChunkManager.mjs`, `ProceduralVoxelWorldRuntime.mjs`, `VoxelFeatureCollision.mjs`, and `VoxelLiquidVolume.mjs`.

Integration hooks: `ToolbarJSONfiles/insertToolbar.json`, `GameViewDependencies/worldLoading.mjs`, `objectInspector.mjs`, `initScene.mjs`, and `Abilities/InspectionModificationAbilities/ConsoleInspectionAbility.mjs`; `scripts/procedural-world.electron.cjs` enables the focused session fixture. This document records the audit and implementation. Existing large integration files receive only small hooks; new feature modules stay under the project's 200-line limit.
