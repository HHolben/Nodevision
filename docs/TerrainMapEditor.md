# Interactive terrain map editor — Phase 2

## What is implemented

`.nvmap` is now a native graphical document, with elevation sculpting, biome and surface-material painting, layered visualization, document history, atomic saving and linked-world previews. It continues to use the Phase 1 format, sampler, voxel generator, terrain composition pipeline and renderers.

To create a map, choose **File → New File**, enter a filename ending in `.nvmap`, and leave “Start from a template” unchecked. The next form asks for the name, dimensions, sample spacing, initial elevation, biome, optional material override and coordinate origin. Width and length must be whole multiples of the spacing. Fractional spacing and negative/fractional elevations are supported. Creation does not require a virtual world.

Open a map through the standard graphical editor or File View. A world using a custom map exposes **Edit Terrain Map** in its terrain properties. That action focuses an already open map editor when possible. Multiple different maps have independent editing state and histories. Save writes the current document; Save As uses the existing template-form dialog to create a new asset and retarget the map tab. Existing worlds keep their original relative references.

## Architecture investigation and reuse

The existing graphical editor is selected by `PanelInstances/ModuleMap.csv`; its panel lifecycle, tab metadata and file selection are shared with GOX, SVG, PNG and HTML editors. The new editor registers there rather than creating a window manager. Native dirty-tab close handling and saved-layout guards now recognize its document API. Its own listeners are scoped to its root/canvas and released on disposal.

The existing `PanelActiveTool` registry and contextual Cursor provider mechanism expose map tools to the shared Cursor toolbar. The editor also has a local tool selector. `SVGLayersPanel` already accepts an `attachHost` layer provider, so the map supplies its three logical layers and tool settings through that interface. The established split/dock system opens and manages this panel. No SVG image layers or second panel framework were introduced.

CSV's immutable snapshot history was extracted into `PanelInstances/Common/SnapshotHistory.mjs`; CSV keeps its original adapter and tests. Map history uses that same primitive with copy-on-write tile maps. A stroke records references to changed tiles, not serialized copies of the entire raster. Native save routing recognizes the active map document, including its owned tool panel. Binary maps bypass the graphical editor's text/HTML live-content fallback.

Phase 1's reader now accepts an in-memory tile overlay and palette extension. The overlay invalidates only intersecting cached tiles and uses the existing interpolation halo. Binding broadcasts those changes to linked runtimes; their existing generator cache clearing, chunk invalidation, path dependency tracking and rendering remain in charge. The editor does not modify world object definitions, bake paths, or replace constructions.

## Tools and interaction

- **Raise / Lower:** meters per second, radius in meters, hard/linear/smooth falloff and optional pen pressure.
- **Smooth:** averages the immediate 3×3 sample neighborhood, using a stable pre-dab neighborhood. Strength is a convergence rate in inverse seconds.
- **Flatten:** converges toward a numeric target elevation, also in inverse seconds.
- **Set Elevation:** writes the exact target value throughout the footprint; fractional and negative targets remain Float64.
- **Sample Elevation:** bilinear sample at the cursor, also copied to the Flatten/Set target.
- **Biome / Material:** hard-edged discrete painting using existing registry identifiers. Biome names come from the existing temperate/snowy/Aegean definitions. Neither brush modifies elevation or the other categorical layer.
- **Erase Override:** writes material index zero, restoring biome-derived surface selection. Subsurface generation remains the existing terrain generator's responsibility.
- **Sample Biome / Sample Material:** nearest-node categorical eyedroppers.
- **Select:** draws a rectangular navigation selection for Zoom to Selection; it is not an editing mask.

Raise, Lower, Smooth and Flatten resample elapsed stroke time at 60 Hz. Fast movement is subdivided spatially, with the time contribution divided across subdivisions. Mouse event frequency therefore does not multiply strength. Set/biome/material strokes use distance subdivision to avoid gaps. Pressure affects elevation rates only when enabled. Stationary held brushes continue to apply time-based changes.

Left mouse/pen draws with the selected tool. Middle mouse, Space-drag or Pan navigates. Touch pans; two touches pinch-zoom. Pen input takes priority over touch navigation. Wheel zooms around the pointer. Fit Map, Zoom to Selection and plus/minus keys provide additional navigation. Pointer capture retains a stroke outside the canvas; cancellation and Escape roll it back. Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z or Ctrl+Y, and Ctrl/Cmd+S are owned by the focused map editor, not installed as global editing handlers.

The circular cursor stays at the configured physical radius as zoom changes. The status area reports local X/Z coordinates, interpolated elevation in meters, biome and explicit/inherited material. Map coordinates are horizontal X/Z, consistent with Phase 1; Y remains vertical elevation. Numeric tool targets include the map's vertical origin.

## Visualization and layers

Elevation has an adjustable display range and color/grayscale choice. Hillshade is derived only for display. Biome and material views use stable identifier colors; inherited materials use a checker pattern. Composite combines categorical colors with elevation-derived shading. These are editor visualization colors, not a second material registry or a promise of exact rendered material color.

Elevation, Biomes and Terrain Materials each support selection, visibility and locking in the shared Layers panel. Selecting a layer chooses its corresponding brush. Visibility affects only the current map view; hidden data is still saved and generated. Locking prevents brush transactions on that layer. Tool, camera, selection, visibility, lock and display settings are session UI state; they are not added to the raster schema.

## History and data residency

`Editor/Document.mjs` owns an immutable committed tile map and a separate pending stroke. It clones a tile only on its first write in that stroke. Commit adds one shared-history entry; cancel restores the previous state without adding an entry. Undo/redo restores exact numeric tile bytes and emits the bounds of changed tiles. Saved revision identity is tracked, so undoing a save becomes dirty and redoing to that revision becomes clean.

Untouched tiles are read by byte range and retained in an LRU. The default read cache is 64 MiB. Modified/original tile storage is limited to 32 MiB of distinct touched tiles, and each history direction has a conservative 64 MiB snapshot accounting budget plus a 25-entry limit. Tile buffers are structurally shared where possible. These are memory budgets, not limits on map dimensions. When a long editing session reaches the touched-tile budget, save and reopen before editing additional regions. Saving deliberately retains the current history and its original tile data.

The canvas bitmap is viewport-sized. It culls outside the viewport and adaptively samples the displayed field, admitting at most 128 directly sampled tiles per render; hillshade can access neighboring samples. At very low zoom on huge maps, the overview becomes coarser. There is no precomputed overview pyramid yet. Dirty edits redraw the bounded visible canvas using cached source tiles rather than rebuilding a map-sized image. A dab is limited to 262,144 candidate samples and a motion segment to 4,096 subdivisions; oversized operations report a request to reduce radius or zoom in.

## Save architecture and failure handling

The existing Notebook save router now has `/api/terrain-map/revision` and `/api/terrain-map/save`. The map editor sends the manifest and modified binary tiles only; it never downloads or serializes the whole large map to save a small edit.

The server validates paths, schema, palettes, tile coordinates and tile contents, uses the existing LAN write policy and Notebook backups, and shares the existing per-file write lock. It streams unchanged tiles from the original file and replaces modified tiles into a temporary sibling file. It syncs that file, verifies the source revision again, then atomically renames it over the destination. A rejected or failed write leaves the previous destination intact and removes the temporary file. Save As refuses an existing destination. Source revisions use filesystem identity, length and nanosecond modification/change timestamps; conflicting saves require reload rather than silently overwriting another revision.

Manifest metadata and unknown optional extensions are retained. Existing palette entries cannot be reordered, and grid/size/origin changes are rejected by this editing save path. New palette references are appended. Tile values retain the Phase 1 Float64 elevation and UInt32 categorical representation. No precision-reducing image conversion occurs.

Server replacement is currently O(file size) in disk I/O even for a small patch, preserving single-file atomicity. Browser save payload is bounded by the 32 MiB modified-tile budget and the existing 50 MiB JSON request limit. This phase does not implement resumable uploads or an on-disk sparse journal. New blank map creation also streams the full file and needs sufficient disk space.

## Saved files versus linked previews

Linked 3D preview uses actual existing Virtual World terrain. Open a world referencing the map and the map editor in separate native panels/tabs; camera and rendering controls remain those of the world. No heightmap-textured plane or separate terrain renderer is created.

The 2D view updates during a stroke. By default, a completed stroke, undo or redo publishes its affected bounds once to every world referencing the same resolved asset path in this application instance. This batches expensive 3D work at transaction boundaries. Unsaved data remains in an overlay and is never written just to preview it. Turning off **Linked 3D preview** restores disk-backed terrain; Refresh linked preview republishes the current committed state when preview is enabled.

Closing the map editor removes its overlay and linked worlds return to the saved file. The normal dirty-document close prompt protects unsaved edits. Saving persists the data; Save As moves the editor/preview to the new asset and leaves worlds referencing the old asset on their original saved map. Separate browser processes do not receive in-memory previews. External edits are detected through source revisions/ETags and require reload. Multiple linked worlds in the same process receive the same committed overlay.

## Changed files

New client modules:

- `MetaWorld/TerrainMaps/Editor/{Document,Canvas,Panel,Persistence,Create,Open,Tools,Palette}.mjs` and `Document.test.mjs`.
- `MetaWorld/TerrainMaps/Preview.mjs`.
- `PanelInstances/Common/SnapshotHistory.mjs`.
- `PanelInstances/EditorPanels/GraphicalEditors/NVMAPeditor.mjs` and `PanelInstances/ViewPanels/FileViewers/ViewNVMAP.mjs`.
- `CursorFamilies/providers/TerrainMapCursorProvider.mjs`.

Extended client modules:

- Phase 1 `TerrainMaps/{Reader,Binding}.mjs` and terrain `VoxelWorldProperties.mjs`.
- `PanelInstances/ModuleMap.csv`, `InfoPanels/{SVGLayersPanel,NewDocumentOverlay}.mjs`.
- `EditorPanels/GraphicalEditors/CSVHistory.mjs` and graphical editor host activation/live-content routing.
- `TemplateSystem/{NewDocumentController,TemplateFormDialog}.mjs`.
- `ToolbarCallbacks/file/saveFile.mjs`, `ToolbarCallbacks/view/ViewLayers.mjs`, `panels/{panelTabs,savedLayouts}.mjs`.

Server: added `routes/api/fileSaveRoutes/terrainMapSave.mjs` and tests; extended the existing `fileSaveRoutes.js` router and `conditionalWrite.mjs` lock helper.

Tests: added `scripts/{terrain-map-editor-browser,test-terrain-map-editor-browser,terrain-map-native-input}.mjs`; the shared browser runner has an opt-in native map-input hook. Earlier Phase 1 files and unrelated pre-existing HTML/calligraphy/footnote edits remain in the working tree and were preserved.

## Validation

- 33 Node test files passed across terrain maps, voxel generation, geography, paths, constructions, session voxels, terrain representations, CSV/HTML history and atomic persistence.
- New editing tests cover all elevation tools, negative/fractional values, falloff/pressure, timing determinism, interpolation, tile boundaries, palette painting/erasing, layer locks, cancellation, undo/redo, independent histories, lossless reopening, immutable preview snapshots and very large virtual maps with only nearby tile reads.
- New save tests cover create, patch save, Save As, exact Float64 preservation, source conflicts, malformed patches, path rejection, temporary-file cleanup and simulated failed-save rollback.
- New multi-consumer tests verify preview publication to two worlds, retention of distant cached tiles and reversion to disk data without a write.
- Native editor browser fixture: 35 checks passed using the real save router and a temporary Notebook, including New Map, module registration, shared Layers panel, mouse/pen behavior, undo/redo, locks, view modes, Save As, reopen and actual collision updates, voxel/polygonal rendering and bounded chunk invalidation.
- Real Chromium input checks passed for pointer capture, interpolated mouse strokes, Ctrl+Z, pen Escape cancellation and touch navigation.
- Existing terrain-map world browser tests passed, including voxel/polygonal switching, HTML save/reopen and GOX/STL/glTF/GLB independence.
- Existing SVG Layers and CSV interaction browser suites passed. Current PNG shared-toolbar and decoded-pixel analysis smoke suites passed.
- The older default PNG analysis fixture fails at its initial inline-menu lookup (`menu.hidden` on null). The unchanged PNG implementation mounts that menu in the shared toolbar instead; the current `--toolbar` and `--smoke` fixtures above test that contract. No PNG implementation was changed for this task.

Run the native editor suite with `node scripts/test-terrain-map-editor-browser.mjs`. Run the Node tests using `node --loader ./scripts/html-test-loader.mjs --test` with the relevant test paths. The tests use synthetic large-map addressing, not multi-terabyte physical files. They are correctness/resource-bound checks, not a broad hardware benchmark.

## Known limits and Phase 3 recommendations

No flood-fill, blended biome painting, river/lake authoring, erosion, DEM conversion, masks or contour editing is included. There is no dedicated 3D preview window: preview uses linked worlds. Three-dimensional updates occur at stroke boundaries. UI/view settings and history are session-local, while map data and metadata persist. Locks do not prevent history restoration. Palette additions can remain as unused entries after cancellation or undo, preserving stable indices.

For Phase 3, retain the document tile transaction API (`begin`, `point`, `commit`, `cancel`, `undo`, `redo`), immutable preview snapshots, shared Layers provider and source overlay notifications. Add overview pyramids and worker-based brush/render processing before increasing operation budgets. Consider a bounded disk-backed edit journal/resumable save transaction for long sessions, and benchmark chunk refresh latency before enabling mid-stroke 3D updates. Future raster channels need explicit format/version rules rather than storing editor painting state in world HTML.
