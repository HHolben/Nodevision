# Voxel World inventory and hotbar integration

In Virtual World Build mode, open inventory, select **Voxel World** in **Tools**, assign it to a compatible slot, and close inventory. Select that slot and press **G** (the existing selected-tool Adjust action). Configure the world and choose **Apply Settings**, then aim at a surface and use the normal **Use** placement control. The bounds preview shows the configured world before terrain generation. Escape or the tool's Attack action cancels placement; switching tools removes the preview.

**Insert → Voxel World** equips the same inventory item and opens the same settings form. It now follows the same configure-then-place workflow, instead of generating immediately at the origin. Successful placement returns to an empty hand and retains settings for the next activation.

## Shared implementation

- The inventory identifier is the existing canonical object type, `procedural-voxel-world`. Its Tools entry and Insert command share `icons/VoxelWorldIcon.svg`.
- `VoxelWorldTool.mjs` shares activation and settings entry points. Inventory selection is the sole active-tool source; `WorldCursorProvider.mjs` reads it for the cursor indicator.
- `VoxelWorldToolState.mjs` retains validated form values per world bridge. Toolbar and hotbar share the original text seed and all applied settings.
- `VoxelWorldToolAbility.mjs` registers `adjust`, `use`, and `attack` in the existing selected-item action registry. G reaches `adjust` through the existing command handler. Placement calls `bridge.addVoxelWorld` with a standard definition from `definitionFromVoxelForm`.
- `VoxelWorldDialog.mjs` serves insertion settings and existing object regeneration. The new configuration callback applies settings without mutating the scene. Validation and cancellation preserve previous settings.
- The existing generator, streaming runtime, object hierarchy, undo/redo, and HTML serialization are unchanged. Preview bounds are neither authored objects nor colliders and are disposed on tool changes and inventory disposal.

A surface hit identifies the horizontal center and elevation zero of the world. The existing snap modifier rounds that point before placement. Minimum and maximum elevations remain relative to that point. Build mode and view authoring permissions are checked before configuration and placement; Play mode cannot use this authoring tool.

## Settings and existing limits

The shared form exposes world name, seed, Starting biome, X/Z dimensions, elevation limits, fixed voxel/chunk sizes, vegetation, water, and caves. Starting biome offers Automatic (from seed), Aegean Greek Wilderness, Temperate Rolling Hills, and Snowy Pine Forest. Aegean settings additionally expose coastline, geology, season source, sea level, vegetation density, oak woodland, and mountains.

**Render distance** was added to the canonical form using the existing `chunks.loadRadius` property (1–8 chunks). There is no new generation or serialization format.

Temperate and snowy starts guarantee the selected climate around the horizontal placement center. The central region spans up to 64 m in radius (scaled down for smaller worlds), then smoothly blends into the original seeded climate over the next radius. Terrain relief and seed remain unchanged; surface materials and vegetation use the selected climate. Aegean uses its existing coastal environment throughout the world. Automatic retains the original seeded terrain. Existing worlds without a starting-biome choice generate unchanged. The optional `startingBiome` definition field persists through placement, regeneration, history, and save/reload. An enabled-biome list, configurable roughness, and procedural building/structure lists remain unsupported; there are no placeholder controls for these. Voxel size remains 0.25 m and chunk size 32 voxels, as required by the existing runtime. The existing one-Voxel-World-per-scene restriction remains.

Applied tool settings survive tool and entry-point changes for the current world bridge. Hotbar assignments follow the existing viewer-session lifetime; other inventory items do not currently save slot assignments across application sessions. Saved terrain retains its generation parameters through the existing world definition.

## Verification

```sh
node --loader ./scripts/html-test-loader.mjs --test ApplicationSystem/public/MetaWorld/ProceduralVoxelWorld/*.test.mjs ApplicationSystem/public/MetaWorld/Aegean/*.test.mjs
python3 scripts/test-voxel-tool-browser.py
python3 scripts/test-voxel-tool-browser.py --insert
```

The Node suite passes all 17 test files. The inventory browser suite passes 62 checks and covers registration, compatible hotbar/off-hand assignments, G routing, settings validation, toolbar synchronization, bounds preview, aimed placement, cancellation, Build/Play and read-only restrictions, undo/redo, and HTML save/reload. The existing Insert browser regression also passes with Aegean selected, including actual software-WebGL rendering, deterministic generation, Properties regeneration, hierarchy, history, and disposal. The browser fixture stubs unrelated panel services and filesystem API responses while exercising the production inventory, tool, bridge, generator, and save/load modules.
