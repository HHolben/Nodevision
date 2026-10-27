# GOX Edit → Extrude

Select occupied voxels in the active editable layer, then open **Edit → Extrude** or press **E**. Move the pointer to preview an integer-grid sweep. Press **X**, **Y**, or **Z** after E to constrain the axis. Enter or a left click commits; Escape or a right click cancels. The subtoolbar also provides axis buttons, an integer distance field, Commit, and Cancel. It opens only when requested. Shortcuts ignore editable fields and dialogs.

## Implementation and reused components

New modules under `ApplicationSystem/public/Voxels/`:

- `VoxelExtrusion.mjs`: cached selection snapshot, incremental sweep, occupancy policy, and transactional commit.
- `VoxelExtrusionProjection.mjs`: camera projection, distance snapping, and automatic axis inference.
- `VoxelExtrusionOverlay.mjs`: pooled transient instanced preview meshes and direction arrow.
- `GoxExtrusion.mjs`: modal interaction and cancellation lifecycle.
- `VoxelExtrusion.test.mjs`: geometry, validation, projection, history, and codec coverage.

Modified voxel modules: `GoxPanel.mjs`, `GoxCommands.mjs`, `GoxControls.mjs`, and `VoxelOperations.mjs`. Integration also modifies `CursorFamilies/providers/GoxCursorProvider.mjs` and `ToolbarJSONfiles/editToolbar.json`, adds `ToolbarJSONfiles/goxExtrudeToolbar.mjs`, and adds `scripts/gox-extrude-browser.mjs` to `scripts/gox-browser.mjs`.

The feature reuses VoxelDocument's active-layer selection, editability checks, sparse voxel storage, chunk updates, transactions, undo/redo, and existing GOX codec/save path. Preview geometry lives in the existing build overlay and borrows its cube geometry. Shared toolbar mounting, active-tool notifications, cursor provider, and `voxel.execute` command routing remain authoritative. Existing shortcuts support single combinations; extrusion uses the existing modal-axis interaction pattern to support successive E/X/Y/Z keystrokes.

## Pointer mapping

At modal entry, project the selection center and a one-voxel offset along each axis through the current camera. Distance is the rounded dot product of pointer displacement with that projected vector, divided by its squared length. Thus positive and negative directions follow the camera rather than fixed screen directions. Camera controls are temporarily disabled and projection remains fixed during the operation.

An axis projecting to less than three pixels uses a stable fallback: upward means positive, with the scale derived from the camera-up projection and clamped to 4–200 pixels per voxel. General extrusion waits for six pixels of movement, scores projected axes by directional alignment with a small exposed-face preference, and locks the best axis. Nearly view-parallel axes are excluded from inference; explicit axis controls remain available.

## Geometry, overlap, and history

Every integer step sweeps the original selected set, including irregular, disconnected, and multicolored selections. Coordinate maps deduplicate cells. Original occupied cells in the active layer remain unchanged; unrelated occupied cells appear as red wireframe overlap. Newly proposed cells are translucent, while the original selection remains visible. New cells inherit exact source RGBA. The earliest sweep step wins color conflicts; sources use lexicographic coordinate order for deterministic processing.

Preview updates extend or shrink cached sweep levels and reuse instanced overlay buffers without rebuilding document meshes. Preview data never enters the document, dirty state, history, or serialization. A commit adds all new cells in one existing document transaction. The endpoint translated selection becomes selected, including any preexisting occupied endpoint cells without recoloring them. A zero-distance or fully blocked commit adds no undo entry. Undo restores the original geometry and selection; redo restores the extension. Standard save and reopen use the unchanged GOX format.

Changing panels, losing window focus, disposing the editor, or invoking another editing action cancels the modal operation and restores camera controls. Save can run during a preview and includes only committed geometry.

## Terminal access

Use the existing `voxel.execute` command with these action/argument pairs:

| Action | Arguments | Result |
| --- | --- | --- |
| `extrude` | `{"axis":"auto"}` | Begin general extrusion |
| `extrude-x`, `extrude-y`, `extrude-z` | `{}` | Begin or constrain extrusion |
| `extrude-distance` | `{"steps":4}` | Set signed integer displacement on the chosen/inferred axis |
| `extrude-commit` | `{}` | Commit the preview |
| `extrude-cancel` | `{}` | Cancel the preview |

Choose an explicit axis before setting a numeric distance, or supply `axis` with the distance arguments. These commands use the same controller as mouse and keyboard actions.

## Validation and limits

The automated Node run passes all 10 voxel, file-view, and HTML save-safety test files. Extrusion tests cover all six directions, rectangular and irregular/disconnected groups, depth overlap, deterministic RGBA, occupied endpoints, reversal/zero, no-op history, stale snapshots and layer restrictions, limits, a 1,024-voxel incremental sweep, and GOX round trips. The browser suite passes all 158 checks. Browser integration covers shared toolbar activation, E/EX/EY/EZ, typing, camera-relative direction, fallback, preview save exclusion, commit/cancel, undo/redo, terminal actions, panel switching, disposal, and save/reopen.

This iteration supports axis-aligned extrusion within the active layer. Occupancy checks apply to that layer; other layers remain untouched. Limits are 65,536 selected voxels, 4,096 steps, and 262,144 source-cell visits per sweep, with existing coordinate bounds enforced. View-parallel axes use the documented upward-positive fallback. There is no diagonal extrusion or cross-layer selection merging.

## Numeric keyboard distances

While the canvas has focus during extrusion, type a signed integer to override mouse distance: `E`, `X`, `1`, `2`, `Enter` extrudes +12 voxels; `E`, `Z`, `-`, `3`, `Enter` extrudes −3. Toolbar-started extrusion focuses the canvas and accepts the same keys. These are voxel counts, independent of the world-space display scale.

Digits update the existing preview immediately. Backspace removes one character; clearing the buffer restores mouse control on subsequent movement. X/Y/Z changes the axis while preserving the typed magnitude and sign. Pointer movement cannot overwrite a numeric value. Escape cancels, while Enter or a canvas left click commits through the existing transaction. The toolbar distance field and `extrude-distance` command also establish a numeric override.

General extrusion uses the existing camera/pointer inference. If no axis has been established, typing a number retains it and asks for X/Y/Z or enough pointer movement to infer an axis. Commit remains blocked until an axis is established; no default axis is guessed. Positive numbers always follow the positive chosen axis.

A leading minus sign alone is pending input. Fractional input is retained as invalid so it cannot silently become a different integer; Backspace can correct it. Invalid, unsafe, or over-limit values clear the proposed sweep and block commit, preserving the document and history. Existing coordinate, selection and source-cell limits still apply before preview allocation. Canvas keyboard handling continues to ignore text fields, dialogs, editable content and Ctrl/Meta/Alt shortcuts.

Numeric implementation changes are in `Voxels/GoxExtrusion.mjs`, the panel shortcut focus guard in `Voxels/GoxPanel.mjs`, and `ToolbarJSONfiles/goxExtrudeToolbar.mjs`; `scripts/gox-numeric-extrude-browser.mjs` is registered by `scripts/gox-browser.mjs`. Numeric input reuses `VoxelExtrusion`, transient overlays and existing commit/save logic without a separate geometry path. Decimal distances, expression evaluation and physical-unit input are not supported.

Numeric-input validation: all **236 GOX browser checks** pass, including positive/negative numeric extrusion on each axis, multi-digit entry, Backspace, preserved sign on axis changes, mouse override/resumption, locked automatic axis, toolbar numeric values, cancellation/zero, fractional/unsafe/over-limit rejection, input focus isolation, endpoint RGBA, undo/redo and save/reopen. All **5 voxel test files** pass. Syntax checks and `git diff --check` pass.
