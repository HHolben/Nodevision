<!-- Nodevision/docs/procedural-voxel-materials.md -->
<!-- This report documents canonical material resolution for procedural terrain, development generator compatibility, verification, and remaining physics limitations. -->

# Canonical procedural voxel materials

This report records the material milestone before water generation. See the [water update](procedural-voxel-water.md) for the current five-material pool, shared swimming adapter and updated measurements.

## 1. Before: separate rendering, partially shared metadata

The procedural path was **partially shared**, not a fully canonical material implementation. `VoxelTerrainGenerator.mjs` contained a private array of literal colors. Its three solid entries had `physicsMaterialId` labels `grass`, `soil`, and **`limestone`**; the gray entry was not actually canonical stone. `ProceduralVoxelWorldRuntime.mjs` ignored those palette physics fields, emitted vertex colors into one MeshStandardMaterial, and tagged every chunk and the heightfield collider as grass.

The surrounding world architecture already used a shared material catalog. `WorldObjectMaterialDefaults.mjs` loaded the resource-path registry first, then `Materials.csv` and JSON definitions as fallback. Equation material selection and authored `VoxelMaterialConfigAbility` used that catalog. Equation form configuration persisted `physicsMaterialId`, `physicsMaterialFile`, and `MatterState`; ordinary world colliders carried the physics ID. `BounceMaterialAbility` resolved collider IDs through catalog metadata. `TerrainTool/terrainPresets.mjs` read catalog definitions and `terrainMaterial.mjs` created rendering resources.

Repository source searches covered materialId, physicsMaterialId, materialFile, MatterState/matterState, stone, water, grass and limestone. Canonical grass, limestone, soil, sand and water existed. There was no separate canonical stone, rock or dirt JSON definition. Soil is the existing canonical identity for the generator's subsoil role; no duplicate dirt material was introduced.

## 2. Canonical definitions

| ID | Definition | Default color | Matter state / density | Static / kinetic friction | Restitution |
| --- | --- | --- | --- | --- | --- |
| grass | `Materials/Solids/grass.json` (reused) | `#3f8f46` | solid / 1200 kg/m³ | .86 / .58 | .06 |
| soil | `Materials/Solids/soil.json` (reused) | `#6b5137` | solid / 1500 kg/m³ | .92 / .64 | .04 |
| stone | `Materials/Solids/stone.json` (added) | `#858583` | solid / 2600 kg/m³ | .74 / .50 | .10 |
| limestone | `Materials/Solids/limestone.json` (reused) | `#b8b59f` | solid / 2550 kg/m³ | .74 / .50 | .10 |

Grass and limestone were not duplicated or recolored. Stone follows the same JSON schema and is registered in both `Materials.csv` and the built-in fallback rows, making it available to equation, ordinary-world, authored-voxel and procedural consumers. Water's existing liquid state, .48 opacity, non-solid collider and density 997 remain unchanged.

## 3. Resolution and runtime palette

`WorldObjectMaterialResolver.mjs` resolves the existing catalog entry into identity, source file, rendering parameters, matter state and the original collider metadata. It respects the catalog's resource-path resolution; a missing catalog definition can be loaded from its canonical file. It is not a second material taxonomy.

The generator uses compact bytes:

| Runtime index | Canonical meaning |
| ---: | --- |
| 0 | air/empty-cell sentinel, no material allocation |
| 1 | grass |
| 2 | soil |
| 3 | stone |
| 4 | limestone |

`VoxelMaterialIds.mjs` contains only this mapping. Colors and physical properties are absent from the generator. `VoxelMaterialPalette.mjs` resolves four definitions once per runtime, then reuses the existing terrain material factory. Catalog loading is shared/cached across consumers. Generation and meshing perform no filesystem, fetch or catalog lookup per cell.

The existing synchronous terrain factory still returns a logical root immediately. `runtime.ready` resolves true after materials load, or false with `runtime.materialError` on failure. Streaming waits for the palette; analytic ground sampling and spawn placement remain available immediately. Disposing while loading prevents late chunk creation and disposes late material resources.

## 4. Deterministic limestone

`VoxelTerrainParameters.mjs` centralizes V1 parameters. The original height noise is retained. The same coordinate hash and smooth value-noise function provide a material field at wavelength 192 voxels, using seed salt 104729. Where that field exceeds .57, a ten-voxel-thick limestone stratum starts at `floor(18 + 14 * field)`. Grass and the four-cell soil layer take precedence; deeper rock remains stone.

There is no sequential RNG and no iteration-order dependency. The field creates broad coherent regions rather than isolated random blocks. In a fixed 63×63 grid of columns sampled every 16 cells, at y=32 and seed 123456, limestone occurs in **1198 of 3969 columns** (about 30.2%). It does not occur everywhere.

Pinned V1 regression coordinates, in local integer voxel coordinates:

| Seed | Coordinate | ID |
| ---: | --- | --- |
| 123456 | (0,75,0) | grass |
| 123456 | (0,74,0) | soil |
| 123456 | (0,0,0) | stone |
| 123456 | (0,32,0) | limestone |
| 123456 | (0,76,0) | air |

## 5. Generator compatibility and persistence

The generator remains **`nodevision-terrain-v1`, version 1**. V1 is under development and is **not frozen** as a permanent visual compatibility contract. This refinement changes material identity and distribution for existing development V1 definitions when regenerated. It adds no V2, legacy-material mode or migration machinery.

Fixed parameters are centralized in code; generator ID/version/seed and existing dimensions, voxel size, chunk settings and placement remain in the saved definition. Chunk bytes, material instances, palettes and child meshes are never serialized. Once V1 is frozen, changes to deterministic output must use a new generator version. Catalog appearance can still follow user material-library changes independently of generator identity.

## 6. Rendering and inspection

Each nonempty chunk still creates **one mesh**. Indices are grouped deterministically by material; a mixed chunk has **at most four groups/draws**, and an entire terrain runtime shares **four Three.js materials**. There is no material allocation per voxel or per chunk. Vertex colors are removed because canonical pooled materials supply color and rendering properties. Texture resources, if used by a catalog definition, are owned and disposed with the runtime pool.

Developer inspection APIs:

```js
runtime.getVoxelMaterialId(x, y, z); // local integer coordinates; e.g. "limestone"
runtime.getVoxelMaterial(x, y, z);   // resolved canonical metadata after runtime.ready
root.userData.colliderRef.sampleMaterial(worldX, worldY, worldZ);
hit.object.material[hit.face.materialIndex].userData.materialId;
```

No per-frame inspection UI was added. Chunk metadata no longer falsely labels every rendered face grass. A WebGL cutaway regression raycasts the actual exposed stone, limestone, soil and grass faces and checks their Three.js material identities.

## 7. Physics and matter state

The heightfield's walking surface is always grass in this generator, so its ground collider retains canonical grass identity and resolves the same catalog restitution through `BounceMaterialAbility` as other objects. The collider also exposes the canonical definition, material file and matter state. Deeper voxel queries return the actual stone/limestone/soil collider metadata, including friction and density, without copying a separate set of physical constants.

This does **not** add a friction solver or individual block bodies. Existing Game View movement does not generally consume the catalog's static/kinetic friction coefficients; the standalone `MetaWorldPhysics` floor also uses its pre-existing damping logic. Those limitations remain. The analytic terrain collision model assumes a solid heightfield and cannot model liquid voxels, holes, caves or arbitrary non-solid material overrides. Water resolves through the same canonical resolver and passes metadata regression tests, but procedural water generation/collision was not added.

## 8. Tests

Both test files pass, comprising 14 focused cases:

- `ProceduralVoxelWorld.test.mjs`: existing validation, boundaries, seed determinism, face culling, streaming/disposal, compact persistence and authored patterns.
- `VoxelCanonicalMaterials.test.mjs`: canonical grass/soil/stone/limestone/water resolution; fixed coordinates and limestone coverage/coherence; chunk/query equivalence; mixed-material groups and colors; pooled disposal; runtime inspection and canonical bounce metadata; ordinary object IDs; authored voxel config persistence; equation material matching and layer serialization; catalog overrides; and disposal during asynchronous material loading.

The real Electron Game View harness passes loading, streaming, software-WebGL rendering, ground movement, world boundaries, raycasts, HTML save/reload, layer history, disposal, ordinary objects and authored voxel-pattern persistence. It additionally verifies actual cutaway face material identities and the four-material pool. The local fixture intentionally has no resource-registry endpoint and exercises the real CSV/JSON fallback.

Commands:

```sh
node --loader ./scripts/html-test-loader.mjs --test ApplicationSystem/public/MetaWorld/ProceduralVoxelWorld/ProceduralVoxelWorld.test.mjs ApplicationSystem/public/MetaWorld/ProceduralVoxelWorld/VoxelCanonicalMaterials.test.mjs
env -u ELECTRON_RUN_AS_NODE node_modules/.bin/electron scripts/procedural-world.electron.cjs --no-sandbox
node scripts/voxel-material-benchmark.mjs
```

## 9. Performance

A same-session Node benchmark measured 100 representative chunks after ten warmup chunks, with the same seed and coordinate sequence:

| Operation | Before median / p95 | After median / p95 |
| --- | --- | --- |
| Generate chunk | .191 / .287 ms | .243 / .666 ms |
| Mesh chunk | 1.244 / 6.186 ms | 1.690 / 5.115 ms |

Generation adds one low-frequency field evaluation per column, not a catalog lookup per voxel. The additional median generation cost was about .052 ms per chunk. Grouping adds some meshing work; these short timings are not a broad performance guarantee.

The updated Electron radius-eight run retained 1156 chunk records, 642 meshes, 654640 exposed faces and two logical objects/two colliders including the authored box. Total population took about 2.55 s with a maximum chunk build of 32.7 ms on this run. Geometry storage was **70,701,120 bytes**, compared with the prior vertex-color baseline's **102,123,840 bytes**. The older recorded browser baseline used different execution conditions; its timing is not a controlled speedup comparison. [Machine-readable measurements](procedural-voxel-material-performance.json) preserve the representative results.

## 10. Files and remaining bypasses

Changed: material CSV/catalog facade; procedural generator, mesher, runtime and existing tests; procedural browser regression and performance documentation. Added: canonical stone JSON; catalog rows/CSV/identity/loading modules extracted from the oversized defaults module; shared definition resolver; voxel ID mapping, material pool, V1 parameters, canonical-material tests and test fixtures; benchmark and cutaway browser check.

All **15 added/modified native JavaScript modules** pass the file-header and strict fewer-than-200-code-lines check; the maximum is **108**. JSON/CSV definitions are exempt under the repository rule. No standards file was changed.

Authored voxels still preserve their explicit color/opacity overrides and existing material fields. Ordinary world objects still render authored `def.color` rather than universally applying catalog visuals; equation UI defaults come from catalog selection and are saved explicitly. Legacy terrain-tool presets and the analytic/standalone physics limitations above remain. These are existing object behaviors, not a new procedural material taxonomy. Future block editing must update collision as well as mesh/material identity before exposing underground surfaces as walkable terrain.
