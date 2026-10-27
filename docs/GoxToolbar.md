# GOX Insert → Block toolbar

The GOX panel previously constructed its own complete toolbar through `GoxControls.controls(api, root)`. Separately, Insert and View hosted a small `goxBuildToolbar` widget with its own unsynchronized mode/tool inputs. The editor also stored color and tool-control references in panel DOM elements, making the local toolbar part of its state dependencies.

The panel now contains status, coordinate output, and the voxel viewport. The complete existing controls are hosted by the standard **Insert → Block** subtoolbar. Add Block, brush, erase, paint, pick color, selection, box selection, orbit, shape tools, fill, color/alpha, brush size, settings, Save, Undo/Redo, Frame, Layers, Finish line, and the parameterized command form remain available. The redundant View widget has been removed. No editing capability was left unmigrated.

## Shared infrastructure and state

`insertToolbar.json` declares Block under Insert and its controls under Block. The widget uses the existing `createToolbar` script-host mechanism, contextual toolbar rendering, and `showToolbarSubToolbar`/`hideToolbarSubToolbar` functions. It does not implement toolbar management. Mounting is deferred to a microtask because cached toolbar scripts can initialize while their hosts are still in a detached fragment. Only the live subtoolbar mounts controls; prebuilt dropdown copies do not.

All controls invoke the existing `api.safe`/`api.run` actions. `VoxelBuildActions`, `VoxelDocument`, pointer tools, viewport, cursor provider, and the `voxel.execute` command registration remain authoritative. Color now belongs to the document API rather than a color input. Tool, mode, brush, settings, and color changes notify subscribed controls; remounts read current API values. Detached widgets unsubscribe and disconnect their observers.

Mode and tool remain separate. Read-only files stay in View mode and disable Build/Selection mode choices and editing tool options. Existing command-level enforcement remains in place. Advanced transforms and numeric operations remain accessible through the shared command form and terminal.

## Activation and keyboard access

Opening a GOX editor activates Block. Existing `activePanelChanged` notifications and the panel-tab activation hook reactivate it when returning to an editor or restoring its tab. A context-entry guard prevents normal pointer/focus interactions from replacing a manually selected toolbar. Leaving GOX hides Block only if it is still the active subtoolbar; other editors retain control of their own toolbar state. Closing an inactive GOX panel does not hide the active panel's controls.

G opens a transient settings dialog using the same `VoxelBuildControls` fields, even when another toolbar is selected. Native keyboard-accessible selects, buttons, and the command form provide access to migrated actions. Existing B, Enter, Escape, Ctrl/Cmd+S, and undo/redo shortcuts remain in the viewport. Cursor-menu and terminal tool changes update the shared tool selection. Terminal routing now skips hidden GOX tab content when several GOX documents share a panel cell.

## Files changed

Under `ApplicationSystem/public/`:

- `Voxels/GoxPanel.mjs`: remove local toolbar, initialize API-owned control state, activate/deactivate Block on context transitions, synchronize action changes.
- `Voxels/GoxControls.mjs`: shared toolbar controls, API-owned color, transient G dialog, subscription cleanup.
- `Voxels/VoxelBuildControls.mjs`: reusable settings fields with explicit synchronization rather than editor-owned DOM references.
- `Voxels/GoxCommands.mjs`: select the visible GOX tab for existing terminal actions.
- `ToolbarJSONfiles/goxBuildToolbar.mjs`: mount the shared controls.
- `ToolbarJSONfiles/insertToolbar.json`, `viewToolbar.json`: dedicated Insert → Block hierarchy and removal of duplicate View controls.

Tests: new `scripts/gox-toolbar-browser.mjs`; updated `scripts/gox-browser.mjs`, `gox-build-browser.mjs`, and `test-gox-browser.py`. The fixture now loads the real toolbar implementation and JSON rather than mocking toolbar state updates.

## Verification

- `node --test ApplicationSystem/public/Voxels/*.test.mjs`: all four test files pass (codec, persistence, building, operations).
- `python3 scripts/test-gox-browser.py`: browser coverage includes automatic activation, no local toolbar, every tool, cross-interface state synchronization, manual toolbar selection, HTML/SVG/other-editor context transitions, tab restoration hook, multiple GOX tabs, inactive-tab disposal, read-only controls, and no duplicate live toolbar widgets.
- Existing browser checks exercise actual voxel drawing and drag interpolation, painting/erasing, selection/transforms, locked/hidden layers, history, G settings, saving/reopening, camera controls, world references, and GLTF viewing.

There are no GOX file-format, voxel-representation, rendering-engine, or persistence-format changes.
