# Raycasting Teleporter

Implemented in the existing Virtual World Editor inventory. This is transient player travel: equipping and firing do not add world objects, record terrain history, modify terrain sources, or change saved permissions.

## Use

1. Open a world in **Virtual World Editing / Build** mode.
2. Open inventory (`0` with the default bindings), choose **Tools**, and click **Raycasting Teleporter** to equip it in the active hand. Close inventory.
3. Aim the center of the active view at a standing surface. The compact teal gun follows the active camera. The destination ring is green for valid placement, red for an unsuitable surface, and amber while preparing data; text also explains the result.
4. **Left-click** to travel. The existing **R/use** input and controller primary/use binding (including button 5) also work.
5. **Right-click or Escape** cancels preparation. Switching tools, opening inventory, changing worlds, or closing the panel also cancels it. Only one request can be pending, for at most ten seconds; movement is held while it prepares.

Default range is **500 metres**, independent of detailed render radius. The inventory item's `teleporterRange` value is clamped to 1–2,000 metres. There is no separate settings panel. Ordinary Viewer/Play use is denied; read-only Viewer inventories do not register the item.

## Implementation

Application changes:

- `GameViewDependencies/RaycastingTeleporter/Target.mjs`: nearest visible collision-owned surface, actual triangle picking for constructions/imports, explicit coarse terrain candidates, and helper/proxy exclusions.
- `RaycastingTeleporter/Destination.mjs`: shared source preparation, nine footprint support samples, slope/edge checks, body clearance, dry support and world bounds, plus synchronized player relocation.
- `RaycastingTeleporter/Controller.mjs`: active-camera ray, immutable pending target, permission checks, duplicate prevention, ten-second timeout, cancellation, final target revalidation, and lifecycle ownership.
- `RaycastingTeleporter/Visuals.mjs`: procedural emitter, ring, firing flash, and explicit geometry/material disposal.
- `Abilities/MovementAbilities/RaycastingTeleporterAbility.mjs`: existing inventory registration and selected-item action handlers.
- `movementUpdate.mjs` and `Abilities/CommandAbilities/MovementUpdateLoop.mjs`: install the ability, consume equipped-tool input before authoring actions, and hold player movement during preparation.
- `MetaWorld/Constructions/ConstructionRuntime.mjs`: mark the selection outline as an editor helper, so it cannot become a destination.

The GameView paths above are under `ApplicationSystem/public/PanelInstances/ViewPanels/`; MetaWorld is under `ApplicationSystem/public/`.

No second inventory, terrain pipeline, player representation, or permanent effect object is introduced. Disposal is attached to existing inventory disposal. The controls' player object is moved, its orientation is preserved, and scalar/vector motion and grounded collision references are updated. Gravity settings remain unchanged.

### Collision and LOD

The nearest solid hit blocks farther destinations even when the nearest surface is unsuitable. Helpers, avatars, decorations without registered colliders, and vegetation proxies are excluded.

A coarse tile is only an aiming candidate. Before moving, the tool waits for existing terrain readiness and, for streamed map sources, requests a bounded footprint through `prepareMapRegion`. It then uses the existing full-resolution composed terrain collider for ground and whole-body occupancy, including authored modifications. Cached geographic samples and the procedural generator can supply authoritative collision without an installed visual chunk. Detailed visual streaming is requested at the verified destination after travel. No collision decision relies solely on a coarse mesh or a missing-data fallback.

Support must remain near the selected height: within 0.55 m for detailed surfaces or 8 m for coarse approximation. The tool rejects steep surfaces, gaps under the avatar footprint, water, blocked clearance, and out-of-bounds positions. It does not search indefinitely for an alternative destination. STL triangle collision uses the existing capsule convention, so placement includes its radius below nominal feet. Conservative bounding colliders can reject visually clear destinations.

Pending requests retain the original hit, player position and world identity. Completion rechecks permissions, selection, ray obstruction, source readiness and clearance. Abort stops waiting immediately even if shared source work continues; it cannot subsequently move the player.

### Imported geometry

Real linked GOX constructions and solid STL object-file geometry are supported through their existing colliders. Standalone GOX/glTF/GLB model assets are currently decorative in Nodevision's model loader; the teleporter deliberately leaves them noncollidable. It does not treat visible triangles as evidence of collision ownership.

## Verification

- Seven focused tests in `RaycastingTeleporter/Teleporter.test.mjs`: nearest solids/helpers, avatar dimensions, water/edges/ceilings, cave floors, slope rejection, coarse authoritative collision and boundaries, source cancellation/failure, and triangle capsule clearance.
- Regression suites: terrain representation switching safety, player body, and world pause state pass.
- `node scripts/test-raycasting-teleporter.mjs`: production GameView, inventory DOM selection, trusted Chromium left-click through real input handlers, geographic cached terrain, coarse destinations, detailed voxel and polygonal destinations, camera/orientation/velocity, delayed readiness, duplicate rejection, cancellation, source failure, Play denial, pending world closure, imported GOX/STL/glTF/GLB and construction loaders, helper cleanup, production save and read-only Viewer reopen.
- The controller binding test supplies a synthetic gamepad through `navigator.getGamepads`; production binding/input/movement handling is exercised. Physical controller hardware was not tested.
- The HTML fixture contains a real 64,960-sample encoded geographic cache. The runner uses an isolated temporary Notebook and actual load/save routes. Terrain serialization and the loaded document definition remain unchanged by travel.
- Dirty native modules pass path/purpose-header, fewer-than-200-code-line, syntax, and whitespace checks.

Run focused tests with:

```sh
node --loader ./scripts/html-test-loader.mjs ApplicationSystem/public/PanelInstances/ViewPanels/GameViewDependencies/RaycastingTeleporter/Teleporter.test.mjs
node scripts/test-raycasting-teleporter.mjs
```

Browser support files are `scripts/raycasting-teleporter-browser.mjs`, `teleporter-assets-browser.mjs`, and `teleporter-chromium-input.mjs`; `run-browser-regression.mjs` has an opt-in native-input hook.

Native Electron GUI testing was not performed; production GameView ran in headless Chromium with software WebGL. The tool validates upright standing destinations and intentionally rejects unsuitable walls instead of searching for a nearby floor. Very large imported meshes still use their existing triangle raycasting cost.

Original `Notebook/test.html` is unchanged. SHA-256:
`75533dd604cbacc1de34bd42e1e3c5a5faeef5f4779b51c520a2e0c0edd81292`.

Earlier Phase C vegetation changes in the working tree were retained.
