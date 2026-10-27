# Phase 2: temporary world voxel editing

The Virtual World Editor now offers **Add Block, Voxel Brush, Erase Voxels, Paint Voxels, Pick Voxel Material, and Revert to Persistent World** in its existing inventory. Equip a tool in a hotbar slot and use the established Use input. Attack applies Erase; **G** opens material/color/alpha and brush settings. Add places one adjacent cell per press. Brush strokes interpolate camera samples on the initial target plane and finish as one undo action when released. Cubic and spherical brushes use the GOX brush implementation, with sizes 1–16.

The inventory status displays the material, brush shape/size, and **Temporary cells: N (not saved)**. Settings include **Clear Temporary Edits**, with deliberate confirmation. Clear is undoable. Revert restores the persistent world; Erase makes the current cell empty.

## Reused components and composition

This extends the native world loader, inventory/hotbar, movement ability loop, G-settings convention, material catalog/resolver, GOX brush validation/expansion, construction evaluator, GOX chunk renderer, terrain chunk manager, voxel/greedy meshers, Surface Nets representation pipeline, world history, and terminal command registry. It does not add an independent toolbar or terrain generator.

Evaluation order:

1. Existing procedural terrain, features, and path excavation.
2. Existing persistent construction footprints and GOX occupancy.
3. Session cell opinions.

`TerrainSession.mjs` wraps the existing construction-composed generator. `generator.persistent` and runtime `getPersistentVoxel` remain available independently. Terrain meshing, ground/body collision, runtime picking, material sampling, and voxel tools read the effective field. Path support clipping suppresses authored path surfaces where a temporary opinion replaces the supporting cell. Arbitrary polygonal models and unsupported floating path geometry are not voxelized.

Linked construction geometry uses a disposable render model whose chunk maps initially share immutable asset chunks. Only changed chunks are copied; affected cells are masked and the existing GOX renderer remeshes neighboring chunks. Revert restores original bytes. Persistent GOX sampling and bounds stay independent of the masked renderer. Construction collision suppresses overridden cells; occupied session cells are rendered and collided by the existing terrain runtime.

## Data model and limits

A logical world session owns a sparse map:

```text
32³ chunk coordinate → local cell index → { at: [x,y,z], value }

undefined / absent: inherit the persistent world
null:               explicitly empty
voxel object:       explicitly occupied
```

Coordinates are integer cells at 0.25 meters, relative to a stable session grid origin taken from the first procedural terrain, including its floor offset. Negative coordinates use floor division. Additional terrain grids must align to that origin. Editing is bounded to existing procedural terrain extents; construction voxels within those extents are editable.

An occupied value retains canonical `materialId`, four RGBA bytes, solidity, and optional material file, matter state, canonical palette index, custom-color flag, and source construction/GOX reference. GOX values retain their RGBA and source provenance rather than becoming generic stone. Native sampled materials can reuse their canonical rendering palette. Custom RGBA materials receive transient indices 256–4095; voxel, greedy, and polygonal mesh buffers retain these wider indices. Stable indices are available before asynchronous rendering resources load, including during spawn placement.

Limits: 16,384 cells per batch/stroke, 131,072 active overrides per session, 3,840 custom material variants per terrain runtime, and 1,024 cells between interpolated brush samples. Clear can remove the bounded entire session in one transaction. Invalid coordinates, out-of-bounds cells, and excessive operations reject before applying that batch. A failed interactive stroke cancels its prior samples.

Erase policy:

- Removing persistent occupancy leaves an explicit empty opinion.
- Removing a temporary block over persistent air deletes the unnecessary opinion.
- Removing a painted/replaced persistent cell leaves it explicitly empty.
- Revert always removes the opinion, restoring current persistent occupancy and material.

Add/Brush skip occupied cells. Paint only changes occupied cells. Pick samples without changing occupancy. Brush points are deduplicated; fast dragging interpolates stamps rather than leaving gaps.

## Permissions, lifecycle, and history

The UI authoring adapter requires Build/creative mode and the existing world/view authoring permission. It refuses edits in Play and read-only contexts. The lower-level session service contains no persistence or mode policy, so future controlled gameplay actions can reuse it through their own permission adapter.

Sessions are in-memory and keyed by normalized world path. Saving HTML, switching representations, and recreating the same world view preserve the layer. Ordinary panel deactivation and forced temporary Sandbox view cleanup detach scene resources while retaining the logical session; actual Build → Play → Build transitions have a dedicated browser regression. Explicit tab close offers discard/cancel, and direct replacement of an active world also offers discard/cancel. Browser unload warns if any retained session has changes. Explicit discard/close disposes the layer; reopening then starts fresh. No session data is written to HTML, GOX, construction definitions, or storage.

The native undo/redo stacks accept both persistent snapshot strings and `{kind:'session', undo, redo}` transactions. Temporary transactions store previous/next opinions only. A completed brush stroke, paint, placement, revert, batch, or Clear occupies one timeline entry. Starting a persistent operation finishes any open voxel stroke first. Undo follows the chronological mixed timeline: persistent entries restore world definitions, while temporary entries restore opinions against the currently composed persistent world. Session edits never mark the persistent HTML document dirty. History remains bounded to 80 entries and is retained with the logical session across temporary view recreation.

Input uses the existing Use/Attack/G bindings and inventory selection. It declines editing while a field, contenteditable region, dialog, text console, or inventory menu owns input. Placement/erase/revert previews are editor helpers excluded from world serialization.

## Regeneration and representations

Changed cells are queued and deduplicated until a frame/stroke flush. Terrain invalidation deduplicates affected 32³ chunks and includes neighboring cells for exposed faces and Surface Nets halos. The native regional invalidation method releases only affected resident chunks and schedules rebuilding through the existing manager. Sparse column indices ensure edited underground or formerly empty vertical chunks are requested without scanning the entire override collection.

The same effective occupancy supplies both voxel and polygonal terrain generation. Polygonal mode retains Surface Nets smoothing; voxel edits still collide and target on the exact cell grid. Construction/imported GOX remains voxel geometry. STL/glTF/GLB behavior is unchanged. Material resources and previews are disposed with their scene runtime.

## Terminal interface

The shared registry exposes `voxel.session`, with action and options arguments:

- `add`, `brush`, `erase`, `paint`, `pick`, `revert`: equip that inventory tool.
- `settings`: open G settings.
- `count`: return modified-cell count.
- `clear`: clear transient opinions as one undoable operation.
- `edit`: apply `{tool, at}` or `{tool, points, material}` through the authoring permission adapter.
- `revert-cell`: remove opinions at `{at}` or `{points}`.

Example registry arguments: `["edit", {"tool":"erase", "at":[31,4,31]}]`. These are session-grid coordinates, not meters. Existing world undo/redo commands share the same transaction timeline.

## Files

Added under `ApplicationSystem/public/MetaWorld/SessionVoxels/`:

- `SessionLayer.mjs`: sparse opinions, atomic updates, transactions, interpolated brushes.
- `TerrainSession.mjs`: strongest composition layer and edited chunk levels.
- `SessionPalette.mjs`: stable transient material indices and render resources.
- `Raycast.mjs`: effective occupancy grid traversal.
- `WorldSession.mjs`: logical session retention, discard and unload protection.
- `Authoring.mjs`: runtime binding, permissions, invalidation and native history adapter.
- `Settings.mjs`: G dialog using existing materials and brush conventions.
- `Command.mjs`: shared terminal adapter.
- `SessionLayer.test.mjs`: semantics, limits, brushes, raycasting and mesh material tests.

Added `SessionVoxelToolAbility.mjs` in Game View craft abilities, `scripts/session-voxels-browser.mjs`, `scripts/session-voxels-sandbox-browser.mjs`, and `scripts/test-session-voxels-browser.py`.

Modified native integration points:

- `Constructions/ConstructionRuntime.mjs`: transient GOX masks and collision filtering.
- `ProceduralVoxelWorldRuntime.mjs`, `VoxelMaterialPalette.mjs`, `VoxelGreedyMesher.mjs`, `TerrainRepresentation/SurfaceNets.mjs`: composition, regional rebuilding, material lifetime and wider palette indices.
- `Paths/PathAuthoringBridge.mjs`: temporary support suppression.
- `WorldAuthoringPermissions.mjs`: read-only count query.
- Game View `worldLoading.mjs`, `GameView.mjs`, `movementUpdate.mjs`, `MovementUpdateLoop.mjs`, `playerInventory.mjs`: session/history/lifecycle, movement tools, inventory and feedback.
- `Commands/CommandDefinitions.mjs`, `NodevisionCommandRegistry.mjs`: command registration.
- `panels/panelTabs.mjs`: cancellable explicit-close hook; forced temporary view cleanup preserves session state.

## Validation

- 21 Node test files: session layer, constructions, paths, procedural terrain, and terrain representations.
- 68 temporary-voxel Chromium checks: placement/collision, excavation, material sampling/painting, construction masking/revert, original asset isolation, chunk boundaries, mixed history, native tool input and brush dragging, G/input isolation, permissions, save/reload isolation, representation switching, close cancellation, discard and reopening.
- Real Sandbox Build → Save → Play → Build test: temporary state survives the actual session and panel lifecycle; Play remains read-only; discard restores terrain.
- Existing construction browser suite: 52 checks.
- Existing GOX browser suite: 236 checks.
- Existing path browser suite: native input, path joins/excavation/clearance/collision, representation/save/history and rendering.
- Existing terrain-representation browser suite: GOX/STL/glTF/GLB independence, representation changes, persistence and history.

Commands:

```sh
node --loader ./scripts/html-test-loader.mjs --test \
  ApplicationSystem/public/MetaWorld/SessionVoxels/*.test.mjs \
  ApplicationSystem/public/MetaWorld/Constructions/*.test.mjs \
  ApplicationSystem/public/MetaWorld/Paths/*.test.mjs \
  ApplicationSystem/public/MetaWorld/ProceduralVoxelWorld/*.test.mjs \
  ApplicationSystem/public/MetaWorld/TerrainRepresentation/*.test.mjs
python3 scripts/test-session-voxels-browser.py
python3 scripts/test-session-voxels-browser.py --sandbox
python3 scripts/test-constructions-browser.py
python3 scripts/test-paths-browser.py
python3 scripts/test-terrain-representation-browser.py
python3 scripts/test-gox-browser.py
```

## Limits and Phase 3

Temporary edits are intentionally lost on confirmed discard or browser reload; File Save does not protect them. Forced temporary-view cleanup retains the logical in-memory layer until the world is explicitly closed/discarded or Nodevision exits. Editing currently requires an aligned procedural terrain extent; isolated construction geometry outside those bounds is not editable. Surface Nets is a smoothed view of the same discrete occupancy, so its drawn surface is not an exact cubical collision boundary. Brush previews show the shape's extent, while integer cells determine the exact stamp. Custom GOX color painting preserves RGBA/source identity but does not reproduce every GOX layer shader property or texture.

Phase 3 can add explicit capture-to-construction and persistence adapters, controlled gameplay mining permissions, richer material-property transfer, and construction editing beyond terrain bounds. Inventory consumption, gameplay saves, multiplayer, arbitrary mesh voxelization, and USD import/export remain outside this iteration.
