# Editable world text

## Architecture investigation (before implementation)

The Virtual World editor uses GameView `worldLoading.mjs`, an array of authored objects, and the MetaWorld layer bridge. The bridge owns selection, visibility, history snapshots and source definitions. `worldSave.serializeMesh` is the extension point for source-only serialization. Paths demonstrate managed object restoration and selective runtime updates. Text will reuse those contracts rather than export generated textures as editable content.

The separate GLTF viewer and SVG editor need no changes. SVG and HTML font tools already use browser fonts; Three.js includes font loaders but those do not provide general Unicode shaping. Canvas uses the browser shaping engine and supports combining marks and multiline layout without splitting code points. Existing application fonts include OFL/MIT-licensed Cozette; configurable local font URLs can reference application or Notebook assets. Materials resolve through WorldObjectMaterialResolver. Existing inspector and movement tools operate on mesh roots. Build/Play permissions are enforced by WorldAuthoringPermissions. Memory-station display behavior will be an extension hook rather than a new manager.

Surface attachments use stable parent layer IDs and local transforms. Generated text remains an independently selectable root mesh with child render geometry. Engraving is a non-destructive visual relief, not a collision cut. Surface projection is planar, not conformal wrapping.

## Delivered behavior

Insert → Text exposes Free-standing Text, Surface Text, Engraved Text (visual), Raised Text, and Sign. Preset changes also update the sign materials, dimensions, frame and post coherently. Matching callback commands are `insertFreeStandingText`, `insertSurfaceText`, `insertEngravedText`, `insertRaisedText`, and `insertWorldSign`. Surface modes show a cyan planar preview; click places the draft and opens text properties, Escape cancels placement. Double-click text or select it in the layer inspector to edit. Apply commits one history transaction; Cancel restores the source. Native textarea selection, clipboard, multiline typing, and undo remain native while world movement input is suppressed.

All seven sign presets share the same source schema and renderer. Properties include content, font, dimensions, alignment, spacing, color, opacity, materials, emissive color, extrusion, raster bevel, engraving depth, wear, transform, parent ID, frame/post settings, distance and optional links. Duplicate, Copy object, Paste object and Delete are available in the editor. Object clipboard is internal; text clipboard is the normal OS clipboard. Existing translate/rotate/stretch handles remain available; parent-local positions are retained during grabbing.

`world-text` version 1 definitions persist exact text-local transforms, kind, source content, style, font URL, material IDs, sign settings, parent layer ID, and file/audio/note/memory references. Generated meshes and textures are omitted. Supported mesh parents with text attachments use `preserveLocalTransform` plus an explicit scale rather than baking scale into geometry dimensions; this preserves the inscription’s complete world matrix, including nonuniform parent scale. Script-safe JSON protects literal closing-script text. File, audio and mnemonic note references produce Notebook graph edges through the existing resource-link resolver.

DejaVu Sans and Serif are bundled with their redistribution license. Browser canvas shapes complete Unicode runs, with grapheme-safe wrapping; combining accents and final sigma are preserved. The existing Notebook font picker is embedded in the text editor, and the existing material catalog supplies material choices. Greek-letter buttons optionally include the letter’s name. Custom font URLs can point at application resources or `/Notebook/` resources without embedding fonts. Missing custom fonts fall back to bundled DejaVu Serif, then browser serif if the bundled asset is unavailable. Modern and classical-inspired Greek presets use DejaVu; handwriting uses the platform cursive family, which users can replace with a local font. Font source selection is per object; this does not introduce a separate dependency installer.

Material references use the existing world-material resolver. Limestone, marble and PineWood presets use catalog materials; painted and ink appearances use configurable color, and bronze-like lettering uses metallic shading. The catalog can supply additional materials. Wear is deterministic mask distress and roughness. Material-definition fetches, identical sign structural materials and identical live canvas textures are cached with reference-counted GPU disposal; text edits update only their own runtime. Reference-only and transform-only edits retain their existing generated geometry. Unchanged managed objects are preserved during history restoration.

Memory behavior is an extension API: `bridge.setTextDisplayState({mode:'learning'|'recall'|'normal',revealed:boolean})`. Individual source `displayMode` values are `always`, `interaction`, `learning`, and `hide-recall`. No competing Memory Palace Manager was added. Layer visibility and distance culling remain independent of content.

## Files and modules

New `ApplicationSystem/public/MetaWorld/Text/` modules:

- `TextDefinition.mjs`: schema, presets, normalization and display policy.
- `TextLayout.mjs`: fonts, Unicode shaping, wrapping and deterministic wear.
- `TextTextureCache.mjs`: reference-counted live texture sharing.
- `TextMaterialCache.mjs`: shared catalog requests and sign structural materials.
- `TextPresets.mjs`: coherent sign settings and Greek letter/name helpers.
- `TextEditorHelpers.mjs`: existing Notebook font picker, material choices and Greek insertion controls.
- `TextRelief.mjs`: raster-contour extrusion and bevel geometry.
- `TextRuntime.mjs`: text/sign rendering, serialization and disposal.
- `TextAuthoringBridge.mjs`: history, attachments, duplication and internal clipboard.
- `TextEditor.mjs`: native editing dialog and live preview.
- `TextPlacement.mjs`: raycast placement and cancellation.
- `TextDefinition.test.mjs`: source and layout tests.

Integration changes: GameView `worldLoading.mjs`, `worldSave.mjs`, `objectInspector.mjs`, `inputHandlers.mjs`; movement abilities `EditorSelectionCommandAbility.mjs`, `ObjectGrabAbility.mjs`, `PickingAbility.mjs`; `WorldAuthoringPermissions.mjs`; `insertToolbar.json`; new `worldTextWidget.mjs` and the five insertion callbacks; `MetaWorldPortalLinks.mjs` and its resource tests. Added canonical `Materials/Solids/Bronze.json` and `Ceramic.json` and registered their catalog rows. Added `fonts/dejavu/DejaVuSans.ttf`, `DejaVuSerif.ttf`, `LICENSE`, and `scripts/world-text-browser.mjs`. The existing Electron harness now exposes the font picker’s unused standalone-panel export in its test stub. Existing Aegean/terrain workspace edits were retained. The GLTF and SVG editors were not modified.

## Validation

Executed:

```sh
node --test ApplicationSystem/public/MetaWorld/Text/TextDefinition.test.mjs ApplicationSystem/public/MetaWorld/Paths/Paths.test.mjs ApplicationSystem/public/PanelInstances/ViewPanels/GameViewDependencies/worldPauseState.test.mjs ApplicationSystem/public/PanelInstances/InfoPanels/GraphManagerDependencies/LinkRecords.metaworldResources.test.mjs
env -u ELECTRON_RUN_AS_NODE NV_WORLD_BROWSER=world-text-browser.mjs node_modules/.bin/electron --no-sandbox scripts/procedural-world.electron.cjs
env -u ELECTRON_RUN_AS_NODE NV_WORLD_BROWSER=paths-browser.mjs node_modules/.bin/electron --no-sandbox scripts/procedural-world.electron.cjs
```

The text browser suite verifies legacy worlds, Unicode/multiline content, real raycast placement on a rotated object, visual engraving depth, raised text, every sign preset, preview/cancel/commit, one-step undo of edits, undo/redo insertion, duplication, parent movement, deletion/undo of text and primitive parents, exact save/reload matrices with nonuniform scale, GUI preset changes, Greek letter/name insertion, Notebook font references, hidden-source persistence, missing fonts, graph associations, texture reuse and disposal. The existing path browser suite passed creation, properties, walking collision, grading, history, save/load, regeneration, Sandbox Play guards and rendered-pixel checks.

A 1,000-sign software-WebGL run took 126 ms to construct, with approximately 20.76 ms/frame CPU render submission and 2,000 draw calls. These are local harness observations, not hardware GPU timing or an FPS guarantee. Identical text shared one texture and identical sign structures shared materials; disposal restored the texture cache count. Concurrent regression runs measured approximately 30–55 ms/frame, demonstrating substantial software-renderer contention. The fixture reports a material-registry endpoint 404 because it uses a static server; canonical file resolution still works.

Manual acceptance checklist (not a claim of completed manual testing):

1. In Sandbox Build, select limestone and insert visual engraved `Α`; adjust depth and size, move the boulder, save and reopen.
2. Repeat on a vertical wall, horizontal tablet and sloped stone; confirm preview normals and offset.
3. Create raised bronze-like letters and each sign preset; check front/side materials and post/frame toggles.
4. Type/paste `ἄλφα ά σς` and multiline passages; exercise native selection, Ctrl+A/C/V/Z/Y, arrows, Home/End and Delete.
5. Commit, undo/redo, duplicate, copy/paste objects, toggle layers, delete and undo; verify unrelated terrain identity.
6. Move, rotate and scale text with editor handles and properties; move its parent and reopen the saved world.
7. Set file, note and audio references and inspect Notebook graph edges.
8. Exercise memory visibility hooks, missing fonts, and Sandbox Play authoring restrictions.
9. Inspect small and large inscriptions visually on hardware graphics; benchmark representative unique text, not only repeated signs.

## Limitations

Engraving is explicitly a visual effect, not CSG subtraction or a collision change. Projection is planar; there is no conformal wrapping. Raised geometry uses a bounded raster contour (up to 256 samples per axis); bevels are approximate and lettering is not typographic vector geometry. Signs currently have visual structure without new physical colliders. Wrapping is grapheme-safe but not language-aware word breaking; a fixed-height box clips overflow, so increase height for longer passages. Custom fonts are local same-origin URLs; no new global layered-font registry/installer was added. Cursive quality depends on the selected font. Material texture maps are not replicated; catalog colors and physical shading parameters are supported. Memory interaction reveal is an extension hook, not a new interaction manager. Arbitrary grouping uses the parent layer ID rather than introducing a group editor. Textures are shared, but draw calls are not globally instanced or atlas-batched; thousands of unique signs need additional performance work.
