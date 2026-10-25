# Terrain-aware paths

Insert → Path now defaults to `terrainInteraction: "excavate"`. Existing saved paths retain their previous `grade`, `overlay`, or `none` behavior. The existing placement, control-point editing, locally flat elevation, inventory selection, G settings, history, and terminal actions remain in use.

The inspector and G dialog expose **Terrain Interaction**, **Path Surface Material**, four clearance distances in meters, and **Show Clearance Envelope**. Upper clearance defaults to 3 m; left, right, and lower default to zero. Left/right extend beyond half-width in the local horizontal tangent frame. The translucent orange envelope and cyan centerline are transient editor helpers. They are never saved as world geometry.

## Occupancy and restoration

A saved `physical-path` definition carries its control points, elevation mode, width, material, position, and `upperClearance`, `leftClearance`, `rightClearance`, `lowerClearance`. It contains no baked terrain edits or bridge mesh. Existing HTML world persistence and layer undo/redo store this definition.

The evaluator derives bounded column operations from the upstream terrain sampler, after existing legacy grading. Generated features are composed and then clipped by the same excavation operations. Stable path-ID ordering determines overlapping operations; later IDs take precedence. Clearing or replacing a path constraint invalidates its old/new horizontal bounds, including surrounding chunk mesh dependencies. Reloading regenerates the same occupancy from the saved source and path definitions. Deleting a path removes its operations, revealing upstream terrain and retaining other modifiers.

The current procedural terrain system has no persistent arbitrary manual voxel-edit layer. This change does not invent one or overwrite source data. Regression tests use an edited upstream sampler to verify independent cell values survive excavation and restoration. If a persistent edit layer is introduced, it belongs upstream of this evaluator.

## Floors, tunnels, and bridges

The existing voxel resolution is 0.25 m. Each intersecting column snaps the path surface downward to a voxel top. Actual solid occupancy in the cell immediately beneath that top determines support; a heightmap or ground far below does not. The selected canonical material replaces the supported floor cell. Gravel uses `LimestoneGravel`, dirt uses `soil`, and paved uses `stone`, consistently for voxels and bridge materials.

Only cells intersecting the configured vertical envelope are cleared. The supported one-voxel floor is retained even with nonzero lower clearance; clearance below it can create an under-floor void. Zero clearances add no volume beyond the quantized surface. The terrain above a tunnel ceiling remains intact. Water and mud are preserved and do not count as support; this is not a drainage simulation.

Supported footprints suppress path surface triangles. Unsupported footprints retain the original ribbon, clipped on the terrain grid, with boundary heights snapped to neighboring supported floors. This handles partial-width bridges and supplies the same clipped triangles to the existing movement collision contract. A separate CPU picking ribbon keeps fully supported paths selectable. No support pillars or fill are generated beneath bridges. Support also checks final occupancy so another path removing the floor restores the unsupported surface.

Voxel meshes and polygonal surface-net meshes consume the same modified occupancy and material indices. Imported GOX, STL, glTF, and GLB objects are not terrain modifier targets. Legacy height-grid surfaces currently remain path overlays; elevation-data terrain imported into the geographic voxel generator supports excavation in both representations.

## Commands

Use existing `path.world` actions with JSON options, for example:

```text
path.world update {"id":"road-id","terrainInteraction":"excavate","upperClearance":3,"leftClearance":0.5,"rightClearance":0.5,"lowerClearance":0,"surfaceMaterial":"gravel"}
path.world clearance-preview {"id":"road-id","visible":true}
```

Without an ID, `clearance-preview` controls the active drawing tool's preview. Clearance properties also work with `create` and `settings`.

## Implementation map

- `MetaWorld/Paths/PathDefinition.mjs`, `PathTool.mjs`, `PathAuthoringBridge.mjs`: validation, new-path defaults, edit/history integration, support synchronization, preview command.
- `PathSegments.mjs`, `PathGeometry.mjs`, new `PathTriangleField.mjs`: local directional queries, clearance bounds, shared triangle-height acceleration.
- New `PathClearance.mjs`: canonical voxel material mapping, directional envelope and upstream support evaluation, column operations.
- `PathTerrainField.mjs`: cached spatial candidates, excavation, floor replacement, final support, tunnel collision sampling, restoration.
- New `PathSurface.mjs`, updated `PathRuntime.mjs`: bounded bridge clipping, transition vertices, matching collision, retained picking geometry.
- New `PathEnvelope.mjs`, `PathClearanceFields.mjs`; updated `PathProperties.mjs`, `PathToolSettings.mjs`, `PathInteraction.mjs`: shared settings and transient preview.
- `ProceduralVoxelWorld/VoxelTerrainGenerator.mjs`, `ProgressiveTerrain.mjs`, `VoxelChunkLevels.mjs`: final feature clipping in scalar/synchronous/progressive generation and loading deep tunnel chunks.
- `Commands/CommandDefinitions.mjs`: discoverable preview action.
- `PathExcavation.test.mjs`, `scripts/path-excavation-browser.mjs`, `scripts/paths-browser.mjs`: regression coverage.

All MetaWorld paths above are under `ApplicationSystem/public/MetaWorld/`; commands are under `ApplicationSystem/public/Commands/`.

## Validation

Ten excavation regression tests cover acceptance scenarios A–H: flat grass replacement without duplicate planes; bounded mountain tunnels; ravines/caves; zero and independent curved clearances; movement/deletion restoration; stable multi-path order; scalar/chunk/progressive agreement across three chunks; serialization; shared polygon extraction/materials; partial-width bridges; translated grids; overlapping floor removal; and supported curved corners.

The broader Paths, ProceduralVoxelWorld, TerrainRepresentation, Geographic, and Aegean Node suite passes with `--test-concurrency=1` (24 test files). One existing time-budget-dependent progressive chunk test failed once during parallel execution and passed in isolation and the sequential suite. Browser coverage exercises real WebGL terrain, new default excavation, property edits, G controls, transient previews, representation switching with identical occupancy, bridge collision, undo/redo, HTML save/reload, and the existing native placement/editing workflow. The representation browser separately verifies linked GOX/STL/glTF/GLB objects remain independent.

## Limits and next steps

- Surface support and excavation are voxel-quantized. Small steps and stair-stepped edges are expected; the preview shows the continuous design envelope rather than exact voxel boundaries.
- Excavation materials must exist in the shared terrain voxel palette; custom rendering-only materials require overlay mode.
- Bridge clipping is synchronous and bounded to 262,144 triangle/cell visits per path. Over-budget edits are rejected before history mutation; split very long/wide routes. A worker or incremental clipper is a future improvement.
- The normal editor uses one generated terrain. Bridge clipping uses its grid origin; multiple simultaneously loaded terrain roots should share X/Z voxel-grid alignment. Independently offset grids need a multi-grid clipper.
- Water remains in place, potentially flooding tunnels. No drainage, structural supports, reinforcement, or junction optimization is included.
- Existing legacy grade mode retains its historical cut/fill behavior; use excavate for bounded tunnels and bridges.
