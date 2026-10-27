# GOX light/dark theme parity

GOX follows Nodevision's existing View → Dark Mode toggle and saved application preference. There is no separate editor theme setting. Opening an editor or read-only GOX viewer uses the current theme; switching themes updates all mounted GOX viewports immediately.

## Comparison with Nodevision 3D editors

The parity review inspected `STLeditor.mjs`, `GLBeditor.mjs`, `ModelFamilyEditor.mjs` (OBJ), `ScadSceneRenderer.mjs`, `toggleDarkMode.mjs`, and `ViewportOrientationWidget.mjs`.

| Behavior | Existing 3D editors | GOX after this change |
| --- | --- | --- |
| Application theme source | `data-nv-theme`, `nv-theme-changed` | Same |
| Light/dark scene background | White / `#0f141b` | Same |
| Grid palette | Muted slate lines; STL/SCAD light lines `#e2e8f0`, OBJ/GLB `#d4dbe6` | Matches STL/SCAD |
| Live switching | Background and grid update | Background, grids, selection, brush, bounds, extrusion arrow and overlap update |
| Orientation widget | Shared themed widget | Same shared widget |
| Cleanup | Remove theme listener on disposal | Same, including transient extrusion listener |
| Document colors | Independent of UI theme | Unchanged RGBA and lighting |

This is a theme/UI parity review of Nodevision's sibling editors, not a claim of full modeling-feature parity with external 3D applications.

## Changes

- `Voxels/GoxTheme.mjs`: light/dark palettes, application event integration, in-place grid recoloring, scoped CSS for GOX editor, shared Block/Extrude controls, settings dialog and Layers controls. Includes focus indicators, disabled states and pressed extrusion-button styling.
- `Voxels/VoxelViewport.mjs`: initialize theme and unsubscribe on disposal. Existing camera, projection and grid object remain intact.
- `Voxels/VoxelBuildOverlay.mjs`: theme construction grids and bounds, including guides rebuilt after settings changes.
- `Voxels/VoxelExtrusionOverlay.mjs`: live arrow and occupied-cell contrast updates; source preview RGB remains unchanged.
- `Voxels/GoxLayers.mjs`: scope theme styling to attached GOX layer hosts and remove that scope when detached.
- `scripts/gox-theme-browser.mjs` and `scripts/gox-browser.mjs`: exercise both themes through the real application toggle, initial dark-mode mounting, repeated changes, overlay colors, native controls, settings, grid rebuilding, orientation widget, unchanged document/camera state and listener disposal.

Light mode uses darker teal selection markers and an amber-brown brush/direction indicator; dark mode uses cyan and yellow. Occupied extrusion cells use a darker red in light mode and a lighter red in dark mode. Translucent new voxel previews retain their source colors.

Validation: `python3 scripts/test-gox-browser.py` passes all **185 browser checks**, including the existing editing, extrusion, save and refresh regressions. Changed modules pass syntax checks and `git diff --check` is clean.
