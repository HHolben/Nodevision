<!-- Nodevision/docs/virtual-world-paths.md -->
<!-- This document describes physical path authoring, derived geometry, non-destructive procedural terrain constraints, persistence, validation, and known limits. -->
# Virtual World Paths

## Architecture Audit

The existing Game View owns the editable scene, object list, colliders, and world document. `worldLoading.mjs` registers objects with the shared MetaWorld layer bridge; that bridge already owns snapshot-based undo/redo. `worldSave.mjs` serializes authoritative object definitions into the existing JSON or embedded HTML world definition. `MetaWorldLayerState.mjs` supplies layer selection, ordering, visibility, and renaming. The existing object inspector hosts the new path controls.

Insert commands are registered in `ToolbarJSONfiles/insertToolbar.json` and resolved from `ToolbarCallbacks/insert`. `VectorDrawing/VectorInteraction.mjs` already implements sequential line placement, hover, Enter/double-click, Backspace, and cancellation. Paths adapt that controller to XZ coordinates and preserve picked elevations separately. SVG gesture behavior is unchanged.

Procedural terrain already separates a compact seeded definition, an unmodified heightfield, bounded generated-feature providers, chunk meshing, streamed residency, and player collision. It did not have persistent path constraints. A small derived-field adapter now sits between the original heightfield and the final voxel field. No separate editor, history, material catalog, navigation graph, or save format was introduced.

## Authoring

- **Insert > Path** is available in Virtual World Editing and Sandbox Build. Shared view permissions block both the command and bridge mutations in Sandbox Play.
- Click terrain or the world's default ground to place points. Hover previews the next segment. Enter or double-click finishes; Escape discards the draft; Backspace removes the last point. One click never commits a path.
- Invalid geometry reports an error and retains the draft for correction. No partial object, terrain change, or history entry is created.
- Select the completed object in the viewport or Layers. Its existing inspector opens in floating mode beside the viewport. Control points and centerline are editor-only helpers.
- Drag a handle to another terrain location, or edit XYZ coordinates in Properties. Handle dragging commits one history operation on release. Numeric inputs support authoritative elevation changes. Add inserts a midpoint in the next control-point segment; Remove deletes a point.
- Move the whole path using its position fields or the existing translation/grab tools. Width, interpolation, material, visibility, collision, grading, transition width, and exclusion are editable. Mesh rotation/scaling is intentionally unavailable because it would violate the cross-slope invariant.
- A path is an ordinary deletable, reorderable world layer. Layer renaming goes through the path update/history API. Visual ordering does not choose terrain constraint priority.

## Representation and Persistence

`type: "physical-path"` definitions live in `world.objects`. Fields are:

| Field | Default / Meaning |
| --- | --- |
| `id`, `name` | Stable generated ID; `Path` |
| `position` | Translation anchor, initially `[0,0,0]` |
| `controlPoints` | Ordered XYZ points relative to the translation anchor |
| `width` | 2 m |
| `interpolation` | `smooth`; also `straight` |
| `crossSlope` | Fixed zero |
| `elevationMode` | `authored`; also `follow-terrain` |
| `terrainInteraction` | `grade`; also `none` |
| `transitionWidth` | 1 m beyond each side |
| `surfaceMaterial` | Existing canonical `gravel` material ID |
| `visible`, `collision`, `proceduralExclusion` | All true |

World-space authored positions are `position + controlPoint`. Translation preserves explicit authored elevations relative to the anchor; regeneration never replaces them with terrain heights. Serialization reads the live translation, including gizmo edits. Original world HTML content remains intact. Mesh buffers, sampled ribbons, caches, chunks, previews, and selection helpers are not serialized.

## Geometry and Collision

Straight paths subdivide each segment by distance. Smooth paths use the bundled Three.js centripetal `CatmullRomCurve3`, sampled at approximately 0.25 m intervals. At each sample, the tangent is projected onto XZ; its horizontal perpendicular places the left and right edges at exactly equal Y and the configured width. No Frenet-frame banking is used.

The surface is a continuous indexed triangle ribbon. Spatially indexed triangle barycentric queries supply the same surface height to grading and the existing `expression-heightfield` player-ground API. A 0.025 m lift separates the visible/collision surface from the graded voxel bed. Roadbed voxels are rounded down, considering the cell corners on slopes, so they do not poke through the smooth surface.

Limits: 2-1024 control points, 4096 m control-polygon length, width 0.1-50 m, transition 0-50 m, and at least 5 cm horizontal separation between consecutive points. Degenerate or reversed triangles, centerline crossings, and overlapping ribbon boundaries are rejected with actionable errors. Steep geometry stays finite, but traversal still obeys the existing player's step and movement rules.

## Terrain and Exclusion

`PathTerrainField.mjs` wraps the unchanged generator base. It samples path constraints in world coordinates, then converts to the terrain's local voxel coordinates including its translated height origin. Solid roadbed columns support cuts and fills; smoothstep blends their edges into the original terrain across the transition zone. The upper metre is solid fill; deeper unaffected geology/caves are retained.

Follow Terrain samples the **original, ungraded** heightfield, using bilinear interpolation. It rebuilds after procedural terrain replacement or translation, avoiding feedback from its own grading. Existing terrain-surface heightfield colliders may also supply elevations. If that source disappears or no longer covers the path, the runtime retains the last valid ribbon and reports a warning; an orphaned path loaded without a source initially uses its stored authored heights so it remains selectable.

All chunks use the same world-space queries. Changing a path invalidates resident chunks intersecting the union of its old/new corridor bounds, with a conservative generated-feature footprint allowance. Dirty chunks keep their old meshes until replacements are ready. Removed high chunks are refreshed too, so terrain cuts leave no stale surfaces. Normal chunk streaming still limits generation to one chunk per update. Continuous whole-object movement coalesces terrain updates after 120 ms of stability; handle edits update on release.

The existing procedural tree provider is filtered by corridor clearance before its bounded feature cache stores candidates. Clearance includes half the road width, transition width, and each feature's horizontal bounding radius. Entire intersecting generated features, including overhangs, are excluded. Authored objects are never removed. Deleting a path restores the original seeded terrain and procedural features.

Overlapping separate paths apply grading in stable ID order, independent of layer ordering. Hidden paths contribute neither grading, exclusion, nor collision. `terrainInteraction: "none"` skips grading but can still exclude vegetation. `collision: false` disables the road collider, not the underlying terrain. `proceduralExclusion: false` preserves generated features.

## Major Files

- `ApplicationSystem/public/MetaWorld/Paths/`: definition validation, geometry/spatial queries, runtime, derived terrain field, bridge, inspector, interaction, and unit tests.
- `MetaWorld/ProceduralVoxelWorld/`: generator adapter, streamed chunk invalidation/replacement, and runtime constraint synchronization.
- `MetaWorld/MetaWorldLoader.mjs`, `MetaWorldLayerState.mjs`, `WorldAuthoringPermissions.mjs`: validation, layer renaming, and shared permissions.
- `PanelInstances/ViewPanels/GameViewDependencies/`: object construction/history, serialization, inspector integration, transform refresh, rotation/scale restrictions.
- `PanelInstances/ViewPanels/GameView.mjs`: owned-resource cleanup.
- `ToolbarJSONfiles/insertToolbar.json`, `ToolbarCallbacks/insert/insertPath.mjs`: menu registration and command.
- `scripts/paths-browser.mjs`, `paths-playwright.mjs`, `voxel-world-sandbox-browser.mjs`: real-world integration and native interaction tests.

## Validation

Focused unit tests cover defaults, malformed points, many-point paths, ascending/descending/curved geometry, cross-flat width, finite triangles, crossings, steep gradients, smoothstep transitions, cut/fill, voxel boundaries, cell clearance, deterministic constraints, actual generated-tree exclusion/restoration, and bounded chunk invalidation.

The Electron integration uses real voxel terrain, canonical material files, world loading/saving, the inspector, history, and the player's ground sampler. It covers sequential creation/cancellation/completion, no duplicate final vertex, point insertion/removal, width/material/position edits, walking collision, delete/undo, HTML save/reload, authored elevation stability, follow-terrain regeneration, and read-only permissions.

Playwright drives native mouse clicks, hover, double-click, handle dragging, and undo. It checks changing canvas pixels and captures 1000 px and 410 px screenshots. Playwright is optional test tooling, not a new production dependency.

Validation result: 14 focused path tests and all 18 selected Node regression files passed. The real-world path integration, native Playwright workflow, existing voxel-authoring integration, Sandbox Build/Play lifecycle, and existing SVG/raster native-drawing suite passed. Screenshot inspection confirmed responsive property controls and nonblank terrain/path rendering. The local browser harness emits pre-existing material-registry fallback, Electron security, and Sandbox ResizeObserver warnings; these did not fail the assertions.

```sh
node ApplicationSystem/public/MetaWorld/Paths/Paths.test.mjs
node --experimental-loader ./ApplicationSystem/public/panels/panelRootImportTestLoader.mjs --test ApplicationSystem/public/MetaWorld/ProceduralVoxelWorld/*.test.mjs ApplicationSystem/public/MetaWorld/Paths/Paths.test.mjs ApplicationSystem/public/MetaWorld/SandboxWorldPlanner.test.mjs ApplicationSystem/public/LinkPortalParity.test.mjs ApplicationSystem/public/VectorDrawing/VectorDrawing.test.mjs ApplicationSystem/public/PanelInstances/ViewPanels/GameViewDependencies/playerBody.test.mjs ApplicationSystem/public/PanelInstances/ViewPanels/GameViewDependencies/worldPauseState.test.mjs
env -u ELECTRON_RUN_AS_NODE NV_WORLD_BROWSER=paths-browser.mjs xvfb-run -a node_modules/.bin/electron --no-sandbox scripts/procedural-world.electron.cjs
env -u ELECTRON_RUN_AS_NODE NV_WORLD_BROWSER=voxel-world-sandbox-browser.mjs xvfb-run -a node_modules/.bin/electron --no-sandbox scripts/procedural-world.electron.cjs
env -u ELECTRON_RUN_AS_NODE xvfb-run -a node_modules/.bin/electron --no-sandbox ApplicationSystem/tests/vectorDrawing.electron.cjs
# NV_PLAYWRIGHT_MODULE may name an absolute path to a separately installed Playwright entry module.
env -u ELECTRON_RUN_AS_NODE xvfb-run -a node scripts/paths-playwright.mjs
```

## Limits and Follow-Up

- Terrain grading is currently implemented for procedural voxel heightfields, not destructive editing of arbitrary imported meshes. Terrain remains quantized to 0.25 m, including transition steps; grading is clipped to the world's finite height span. The smooth road mesh is not quantized.
- Large cuts/fills over a short transition remain steep. The tool does not engineer retaining walls, drainage, bridges, stairs, tunnels, or junction blends.
- Procedural clearance currently filters the existing tree/vegetation feature provider. There is no separate generated-rock instance provider in this pipeline; rocky heightfield terrain is cut/filled. Future feature providers should use the same exclusion predicate.
- Same-path self-intersections are rejected. Separate intersecting paths have deterministic grading but no engineered intersection geometry; avoid different-elevation overlapping roadbeds without turning grading off for the elevated span.
- Edits regenerate the affected path's complete ribbon, not individual spline segments. Chunk updates are incremental but synchronous, following the existing generator's architecture. Worker scheduling and more precise feature-footprint invalidation are future performance improvements.
- Geometry and masks are derived from definitions; paths do not protect unrelated world content from corruption or constitute a backup system.
- Future entity following can consume the ordered centerline and distance samples without changing saved definitions. Memory-palace features can associate landmarks with stable object IDs. Neither requires changing portal hyperlinks or introducing a navigation graph into this physical-path feature.
