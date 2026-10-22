# GOX Voxel Build Mode

Open a `.gox` document and choose **Build Mode** in its toolbar, or use **View → Voxel Interaction**. **Insert → Voxel Building Tools** and the existing Cursor menu expose the same tools. View, Build, and Selection / Transform modes retain the same document, camera, selection, active layer, color, settings and history. Unsupported GOX documents remain read-only.

## Interaction

- **Add** places one voxel on the visible face, or on the construction plane in an empty scene. **Brush** uses the configured cubic or spherical stamp. Dragging interpolates an integer-grid line between pointer samples, deduplicates writes and commits one undo entry.
- **Erase** and **Paint** operate on existing voxels in the active visible, unlocked layer. Painting retains geometry. **Pick** samples the visible voxel's RGBA without changing the active layer. Fill paints a connected region of matching color; the command form can include all connected colors.
- **Line** accepts successive vertices. Press Enter or **Finish line** to commit every segment together. Escape cancels the unfinished line. Other shapes use two clicks, with a live voxel preview between clicks.
- Choose **Orbit** to move the camera with the left button. Right drag pans. A stationary right click opens contextual tools/settings. The orientation widget, frame commands and perspective/orthographic controls are retained; middle-button input is unnecessary.
- **G** opens tool settings; **B** toggles Build/View while viewport focus is active. These shortcuts do not capture text-field input. Ctrl/Cmd+S, undo and redo use the existing save and history paths. Escape rolls back the entire current stroke or preview, preserving the selection.

Preview geometry is an independent instanced draw batch, not document geometry or one Mesh per voxel. It shows grid-aligned affected cells in the active RGBA color; erase is red. Chunk and neighboring-face invalidation remains the existing renderer's responsibility. Previews and guides are disposed when replaced or the panel closes.

## Construction and precision

The initial workplane is **XZ at Y=0**. G settings choose XY/XZ/YZ and integer height, free/X/Y/Z/XY/XZ/YZ constraints, anchor coordinates, major grid interval, bounds, symmetry axes/origin, shape axis, shell thickness and collision behavior. Coordinates appear in the toolbar. GOX's existing Z-up camera and stored coordinates are unchanged; changing planes does not rotate or rescale source data.

Supported drawing tools: single voxel, cubic/spherical brush, multi-segment line, filled/outline rectangle, solid/hollow/walls-only box, sphere, ellipsoid and solid/hollow cylinder. Numeric dimensions are available through the keyboard-accessible **Voxel commands** form and the same terminal actions. Hollow cylinders are open tubes along their chosen axis. Spheres drawn from two corners use the largest endpoint displacement for equal extents; ellipsoids retain independent extents. Material properties remain layer-level native GOX visual properties; no physical metadata is inferred from color.

Symmetry reflects voxel coordinates about the integer origin, deduplicating cells on reflection planes. Axis constraints use the first shape point or the configured anchor. Settings persist across tools/modes in the current panel session, not across application restarts.

## Selection and collision behavior

Single/additive/subtractive and two-corner box selection are mouse tools. Connected, all, layer and color selection are available in Voxel commands. Copy/cut/paste/delete, duplicate, move, 90-degree rotate, mirror, and movement between layers reuse `VoxelDocument` transactions. Transform previews use `preview`, followed by `commit-preview` or Escape. GUI users choose these actions in the command form.

The default collision policy is **merge**: occupied destinations keep their contents, and blocked move sources remain in place. **Cancel** rejects the entire operation on collision. **Replace** explicitly overwrites destinations. Selected source cells that are actually moving do not count as collisions. Transform pivots accept `origin:[x,y,z]`, `pivot:"bounds"` (minimum corner), or `pivot:"center"` (bounding center rounded down to the integer grid). Rotation/mirror are grid operations, not arbitrary-angle mesh transforms.

Layers remain independent even at overlapping coordinates. Raycasting uses the nearest visible surface; exact-depth ties follow layer/render traversal order. Selection can activate the hit layer. Erase/paint/fill refuse a hit belonging to another layer rather than silently editing a hidden surface. Hide other layers to access an occluded active layer. Session-only layer locks do not mark the saved document dirty.

## Commands

Use `NodevisionCommands.run('voxel.execute', [action, parameters])` with an active GOX document. Every action below is also in the Voxel commands GUI.

```js
await NodevisionCommands.run('voxel.execute', ['mode', {name:'build'}]);
await NodevisionCommands.run('voxel.execute', ['settings', {plane:'xz',height:0,collision:'merge'}]);
await NodevisionCommands.run('voxel.execute', ['box', {at:[-6,0,-3],dimensions:[12,8,6],hollow:true,thickness:1}]);
await NodevisionCommands.run('voxel.execute', ['cylinder', {at:[0,8,0],radius:3,height:8,axis:'y'}]);
await NodevisionCommands.run('voxel.execute', ['ellipsoid', {at:[0,18,0],radii:[5,2,3]}]);
await NodevisionCommands.run('voxel.execute', ['select', {kind:'all'}]);
await NodevisionCommands.run('voxel.execute', ['preview', {action:'move',parameters:{offset:[0,0,10],collision:'cancel'}}]);
await NodevisionCommands.run('voxel.execute', ['commit-preview']);
await NodevisionCommands.run('voxel.execute', ['save']);
```

`fill-empty` requires `at`, `min`, and `max`. It computes the empty connected region before writing and rejects a region reaching the explicit bounds. `replace-color` accepts `match` and `color` RGBA arrays and only changes the active selection. `select` with `{kind:'color',color:[r,g,b,a]}` matches all four channels in the active layer.

## Implementation and validation

Reused unchanged: sparse GOX model, independent codec, native persistence, shared Layers provider, Three/OrbitControls/orientation widget, command registry and referenced Virtual World assets. No additional dependency or Goxel source was added.

Extended files: `GoxPanel.mjs`, `GoxControls.mjs`, `GoxCommands.mjs`, `VoxelOperations.mjs`, `VoxelViewport.mjs`, `GoxCursorProvider.mjs`, `viewToolbar.json` and `insertToolbar.json`. New modules under `public/Voxels/` separate build geometry, settings, pointer gestures, controls, command adapters, preview/guides, contextual actions, collision transfers and bounded empty fill. `ToolbarJSONfiles/goxBuildToolbar.mjs` connects standard menus. Regression coverage is in `VoxelBuild.test.mjs` and `scripts/gox-build-browser.mjs`, called by the existing GOX browser runner.

Node tests cover geometry counts, numeric dimensions, interpolation across negative coordinates/chunks, constraints/symmetry, collisions, leaks, colors, layers, locks and create/build/save/reopen/edit/save. Browser checks exercise actual raycasts and synthetic pointer/keyboard events in the real WebGL viewport, previews, complete gesture history, cancellation, modes, G settings and persistence. Results: **83 Node tests**, **52 GOX browser checks** (including GLTF viewer), **9 GOX world checks**, the SVG Layers suite, and image-analysis toolbar/statistics smoke checks passed. The older full PNG analysis fixture still assumes an inline toolbar and fails against the existing shared-toolbar architecture; the new smoke fixture exercises the current mounting contract without changing production image-analysis code. No human interactive QA was performed.

Official Goxel opened a generated box-and-cylinder document and exported exactly all 171 expected voxel coordinates and RGB values. The independent Goxel-authored fixture and existing RGBA/layer/metadata round-trip tests remain in the codec suite. This interoperability check uses an external temporary test binary, never shipped with Nodevision.

Reproduce the focused checks with:

```sh
node --test --test-isolation=none ApplicationSystem/public/Voxels/*.test.mjs ApplicationSystem/AssetDownloads/Tests/*.test.mjs ApplicationSystem/public/ToolbarJSONfiles/insertMedia*.test.mjs
python3 scripts/test-gox-browser.py
python3 scripts/test-svg-layers-browser.py
python3 scripts/test-png-analysis-browser.py --toolbar
python3 scripts/test-png-analysis-browser.py --smoke
env -u ELECTRON_RUN_AS_NODE NV_WORLD_BROWSER=gox-world-browser.mjs xvfb-run -a node_modules/electron/dist/electron --no-sandbox scripts/procedural-world.electron.cjs
```

## Remaining limits

- Advanced numeric operations and transform previews use the command form; there are no drag transform gizmos or optional fly camera.
- Selection is confined to one layer at a time. Locks and build settings are session-only.
- Shape previews and commits are bounded to 262,144 cells and currently synchronous. Large previews can be expensive; worker/budgeted geometry is the next performance improvement.
- Transform previews show accepted destination cells in the active preview color, not every source voxel's original material/color. Drawing previews show proposed cells; merge may omit occupied cells when committing.
- Box selection uses two grid points. On an empty construction plane both points share its height; use numeric bounds for depth or pick existing surfaces at differing depths.
- Existing transparency-sorting, unsupported semantic GOX, embedded-preview and source-reload limitations remain as documented in `GOXVoxels.md`.
