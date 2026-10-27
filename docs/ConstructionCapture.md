# Phase 3 construction capture

## Existing data flow inspected before implementation

The native world loader creates procedural terrain runtimes and independently referenced construction runtimes. `VoxelTerrainGenerator` composes procedural terrain, features, paths and rectangular construction cuts. Construction GOX geometry is decoded through `GoxAssetCache` and rendered by `VoxelScene`; Phase 1 samples its occupancy separately from the terrain-rendering field. Phase 2 wraps that composed generator with `TerrainSession`. `sessionVoxels.session.effective(cell)` first reads a transient opinion and otherwise queries construction geometry and persistent terrain materials. This is the capture sampling boundary.

World HTML serialization contains procedural parameters and construction references, never session cells. Construction definitions use Notebook-safe relative references, stable UUID identities and a version 2 collection of axis-aligned 0.25 m TerrainCut volumes. GOX Z-up cells map to world Y-up as `(gx, gy, gz) → (gx, gz, -gy-1)`. The existing GOX codec writes and reads full v2 documents, with sparse 16³ RGBA blocks and layers. Native file writes use `/api/save`, including base64 binary payloads, without cross-file atomicity.

Native history currently interleaves persistent object snapshots with session opinion transactions. Region capture therefore needs a compound entry, rather than an independent insertion followed by a separate Clear undo action. Existing region invalidation and GOX chunk rendering can remain in charge of meshes and collision; capture does not need a new renderer.

## Implemented workflow

In an editable procedural world, enter Build mode and choose **Edit → Save as Construction**. Drag a region on the world; releasing opens the shared review dialog. An existing capture selection opens the same dialog directly. Selection uses the effective voxel raycast with an anchor-plane fallback. The transient wire box never enters world serialization or history. Escape cancels selection; dialog cancellation disposes its preview and restores keyboard ownership.

The dialog provides name, integer-grid position and width/height/depth, occupied count, included temporary opinion count, approximate intermediate size, destination, and a wireframe preview of the captured GOX geometry. Numeric edits invalidate the previous preview. Coordinates are half-open integer intervals on the session's 0.25 m grid, including negative coordinates and nonzero grid origins. Saving requires explicit acceptance of the stated appearance limitations. Save the world document afterward to persist its new reference.

The registered `construction.capture` command receives the usual argument array `[action, options]`. Actions are `select`, `bounds`, `dialog`, `preview`, `confirm`, and `cancel`. For example, the command handler accepts:

```js
['preview', {bounds: {min: [30, 1, 30], max: [34, 4, 34]}}]
['confirm', {name: 'Captured room', confirm: true, acceptVisualLimitations: true}]
```

A `confirm` action can also include bounds to preview and publish without pointer interaction. Both explicit confirmation flags are still required. This uses the standard command registry, not a separate interpreter.

## Sampling and representation

`ConstructionCapture/Region.mjs` accepts an occupancy provider, containment predicate, opinion provider, bounds, origin, cancellation signal, and progress callback. Its intermediate result is independent of UI, Three.js, GOX and filesystem APIs. It queries every cell through `session.effective`, retaining only occupied cells. Untouched terrain therefore survives the initial TerrainCut volume; erased cells stay absent. Empty excavations produce an empty GOX layer plus a compact rectangular initial TerrainCut volume rather than deletion records.

Material groups retain canonical material ID, optional material file, solidity and matter state. Each group becomes one GOX layer; RGBA is stored per occupied cell. Construction metadata associates these layers with their semantic materials. Construction sampling, terrain material lookup and collision sampling use this provenance instead of converting everything to generic stone. Legacy GOX construction behavior is retained.

Local world cell `(x, y, z)` maps to GOX `(x, -z-1, y)`, with inverse `(gx, gz, -gy-1)`. The cell-origin offset is essential. The normal GOX renderer already converts sRGB vertex colors to linear rendering values; capture uses that existing path. Reload validation compares every occupied and empty cell, exact RGBA, material ID and solidity against the intermediate region.

## Publishing and history

Publication is staged:

1. Validate edit permissions, current world, grid bounds and construction/path overlap.
2. Sample effective cells, recording session revision and persistent object state.
3. Encode with the existing GOX writer and decode/verify it before writing.
4. Write a fresh UUID `.gox`, then its schema-v1 `.construction.json`, under the world's adjacent `Constructions/` directory.
5. Fetch both saved assets without cache, validate geometry and definition, and load an ordinary construction runtime with private staging colliders.
6. Compare the loaded runtime against all captured cells and check that the world and session have not changed.
7. Install the referenced construction and remove only opinions inside its footprint in one synchronous compound history transaction.

Asset ID, instance ID and volume ID remain distinct. The definition records grid origin, grid position, terrainVolumes collection and relative GOX reference. The native instance references the definition through Notebook-safe relative paths and participates in the existing `/World/Constructions/c_<instance-id>` hierarchy. World HTML stores the reference, never captured voxel payloads.

Undo removes the instance and restores captured opinions; redo restores the same instance/assets and reapplies promotion. Outside opinions are untouched. Both use existing native history and regional composition invalidation. Undo never deletes files. A failed or canceled write/reload leaves the world and temporary opinions intact. Since the save API has no conditional multi-file transaction or safe rollback deletion, newly written unlinked UUID assets are retained and their exact paths reported for recovery. Existing assets are never overwritten.

## Implementation files

New files:

- `ApplicationSystem/public/MetaWorld/ConstructionCapture/{Region,Geometry,Publish,Selection,Dialog,Tool}.mjs`: independent sampling, GOX conversion, safe publication, interaction, review and shared command entry points.
- `ConstructionCapture/Region.test.mjs`, `scripts/construction-capture-browser.mjs`, `scripts/test-construction-capture-browser.py`: pure and native browser regression coverage.
- `ApplicationSystem/public/ToolbarCallbacks/edit/saveAsConstruction.mjs` and this report.

Integration changes:

- `SessionVoxels/SessionLayer.mjs` and `Authoring.mjs`: revision tracking, bounded promotion transaction, exposed grid origin and semantic construction sampling.
- `Constructions/{Authoring,ConstructionRuntime,TerrainComposition}.mjs`: normal instance installation, semantic layer sampling, staged collider attachment and captured material composition.
- `ProceduralVoxelWorld/ProceduralVoxelWorldRuntime.mjs`: construction material palette resolver.
- `GameViewDependencies/worldLoading.mjs`: compound capture undo/redo and world-switch cancellation; `GameView.mjs`: teardown cancellation.
- `ToolbarJSONfiles/editToolbar.json`, `Commands/CommandDefinitions.mjs`, `Commands/NodevisionCommandRegistry.mjs`: Edit menu and standard command registration.

Paths above are relative to `ApplicationSystem/public/MetaWorld/` unless a longer path is given; GameView files are under `ApplicationSystem/public/PanelInstances/ViewPanels/`.

## Bounds and limitations

- Maximum 512 cells per axis, 1,048,576 sampled cells, 65,536 occupied cells, 128 material groups and 64 MiB encoded GOX. Sampling iterates 32³ regions, yields every 2,048 cells, reports progress and supports cancellation. Sparse intermediate storage scales with occupancy; the estimate describes intermediate data, not an exact compressed file size.
- Capture is confined to the supported aligned procedural voxel world. Active construction footprint or geometry overlap is rejected before writes; replacement/merging is deferred.
- Non-solid voxels and liquid/gas materials are rejected so capture cannot silently change their collision semantics.
- Non-voxel polygonal path surfaces intersecting the region are rejected conservatively by triangle bounds. Supported terrain voxel roadbeds are sampled through effective terrain occupancy.
- Canonical material identity, available material-file provenance, solidity and RGBA survive. Procedural textures and smooth SurfaceNets appearance are not baked into GOX: captured geometry renders as voxels in either terrain representation. The dialog explicitly discloses and requires acceptance of this visual change.
- The result is a normal linked construction, not a live procedural snapshot. Automatic merging, rotated volumes, arbitrary mesh voxelization, multiplayer persistence and USD import/export remain outside scope.

## Validation

The pure Node suite passed all 22 test files across capture, constructions, session voxels, paths, procedural terrain and terrain representation. An additional occupied-cell limit case also passed.

The native capture browser fixture covers exact before/after/undo/reopen cell comparison, unmodified ground, excavation, paint RGBA and rendered color, semantic material lookup, collision, empty output, chunk boundaries, negative coordinates, selective promotion, stable redo identities/files, write/reload failures, cancellation after a write, stale previews, unsupported solidity, overlap rejection, representation switching, native HTML persistence, permissions, pointer selection, numeric selection, geometry review, cleanup and terminal confirmation.

Completed browser validation:

- Construction capture: **186 checks passed**.
- Phase 1 constructions: **52 checks passed**.
- Phase 2 session voxels: **68 checks passed**.
- GOX editor: **236 checks passed**.
- Terrain representation: passed native asset independence, atomic switching, camera/environment, View control, HTML save/reopen, legacy grid and undo/redo.
- Actual Sandbox lifecycle: passed Build → Save → Play → Build, temporary occupancy, permissions, discard and teardown.

The path browser fixture passed on isolated retry: native mouse drawing/Enter completion, junctions, control-point dragging, excavation, clearances, roadbeds, bridge collision, representation switching, HTML reload, history, permissions and rendered pixels. Its initial concurrent WebGL run timed out. Capture module syntax checks and `git diff --check` also passed.

## Recommended next steps

Add explicit construction replacement/merge ownership rules, richer material assets and fluid-aware persistence before relaxing the current rejection rules. A server-side conditional publication API could remove orphan-file recovery and support safe cleanup. Larger captures should use workers or streaming GOX encoding after measuring the current bounded workload.

Phase 5 capture authors exactly one active subtractive box in `terrainVolumes`. Subsequent focused editing supports independent volumes and geometry beyond them; see [ConstructionEditing.md](ConstructionEditing.md).
