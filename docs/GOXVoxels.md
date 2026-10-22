# Native GOX documents

Nodevision has a native GOX viewer and graphical editor. Create a file ending in `.gox` using File → New, then open it normally. Existing files resolve through `PanelInstances/ModuleMap.csv`. The viewer/editor toggle keeps the current viewport, document, selection and history in the same panel.

See [Voxel Build Mode](GOXBuildMode.md) for mode switching, construction planes, live previews, collision policies and the expanded toolset.

## Editing

The contextual Cursor menu remains in its existing position before File. The viewport offers orbit, select, add, erase, paint, picker, line, box, sphere/ellipsoid and fill tools. Left drag edits; right drag pans. Orbit uses left drag in the Orbit tool; wheel zoom is optional because camera controls are also accessible through the shared orientation widget and command form. Shape tools take two clicks; multi-segment Line finishes with Enter or Finish line. Ctrl/Cmd+S saves, Ctrl/Cmd+Z undoes, Ctrl/Cmd+Shift+Z redoes, Delete erases the selection, and Escape cancels a stroke or shape.

The color input preserves RGB plus a separate alpha byte. Brush size ranges from 1 to 16, with cubic/spherical stamps, axis constraints and symmetry available in Voxel commands. A stroke commits as one history entry. Paint changes only occupied voxels. Build Mode previews the proposed voxel cells using a separate instanced batch.

Advanced operations are available in the keyboard-accessible **Voxel commands** form. Choose an action, edit its JSON parameters and press Run. The form and terminal use the same validated document operations; it is not a separate scripting language. For example:

| Action | Parameters |
| --- | --- |
| `select` | `{"at":[0,0,0],"to":[8,8,8],"mode":"replace"}` — box selection |
| `select` | `{"kind":"all"}` — active layer |
| `select` | `{"kind":"connected","at":[0,0,0],"sameColor":false}` |
| `select` | `{"at":[0,0,0],"to":[8,8,8],"mode":"invert"}` |
| `move` | `{"offset":[1,0,0]}` |
| `rotate` | `{"axis":"z","origin":[0,0,0]}` — positive 90° |
| `mirror` | `{"axis":"x","origin":[0,0,0]}` |
| `paste` | `{"offset":[2,0,0]}` — relative to copied coordinates |
| `sphere` | `{"at":[0,0,0],"to":[12,8,4]}` — ellipsoid |
| `box` | `{"at":[0,0,0],"to":[8,8,8],"hollow":true}` |
| `brush` | `{"size":3,"shape":"sphere","symmetry":["x"],"axis":"z","plane":0}` |
| `layer` | `{"kind":"rename","name":"Roof"}` |
| `layer` | `{"kind":"reorder","index":0}` |
| `layer` | `{"kind":"duplicate"}` or `{"kind":"delete"}` |
| `layer` | `{"kind":"merge","index":1}` — matching materials required |
| `move-layer` | `{"index":1}` — move selected voxels |
| `material` | `{"index":0,"name":"Metal appearance","color":[1,1,1,1],"metallic":0.8,"roughness":0.3,"emission":[0,0,0]}` |
| `layer` | `{"kind":"material","index":0}` |
| `save-as` | `{"path":"Models/copy.gox"}` — saves and retargets the current document/tab |
| `camera` | `{"view":"front"}`; also rear, left, right, top and bottom |
| `camera` | `{"position":[30,-40,30],"target":[0,0,0]}` |
| `projection` | `{"orthographic":true}` |
| `frame` | `{"selection":true}` |
| `scale` | `{"value":0.1}` — display scale only |

`copy`, `cut`, `delete`, `undo`, `redo`, `cancel`, `save`, `download` and `layers` need no parameters. Selection also supports `add` and `subtract` modes. Shift-click adds; Alt-click subtracts. Layer indices start at zero. Selections belong to one active layer; geometry edits require it to be visible and unlocked. Transform destinations use non-destructive merge by default; explicit replace and cancel collision policies are available.

The ordinary Layers panel hosts the GOX provider. It exposes active layer, visibility, lock and creation; the command form exposes the remaining layer operations. Viewer visibility overrides are transient and do not dirty or save the document. Locks are session-only because no undocumented lock attribute is written to GOX.

## Terminal and persistence

The existing Nodevision command registry discovers `voxel.execute` and `voxel.place` before any GOX panel is loaded. From the Nodevision console:

```js
await NodevisionCommands.run('file.create', ['Models/new.gox']);
await NodevisionCommands.run('viewer.open', ['Models/new.gox']);
await NodevisionCommands.run('voxel.execute', ['mode', {editing:true}]);
await NodevisionCommands.run('voxel.execute', ['box', {at:[0,0,0],to:[8,8,8]}]);
await NodevisionCommands.run('voxel.execute', ['save']);
await NodevisionCommands.run('voxel.place', ['Models/new.gox', {position:[0,1,-2],scale:[0.1,0.1,0.1]}]);
```

The last command requires an active editable world. Use the normal Insert Media → Model workflow for mouse/keyboard placement from a Notebook reference, or upload a local GOX file through that workflow using referenced storage. Inline world GOX is deliberately rejected.

Normal Save, native binary writes, backups, tab dirty checks and layout dirty checks are reused. Saves snapshot the current revision and serialize through a queue so concurrent saves cannot overwrite newer edits with an older buffer. Download exports the current document, including unsaved changes. Save As uses the existing save endpoint and its overwrite/backup behavior.

## Format and compatibility

The codec is independent JavaScript. There is no Goxel source, executable or new dependency in the application. Binary format references were Goxel's [format implementation](https://github.com/guillaumechereau/goxel/blob/master/src/formats/gox.c) and [internal data documentation](https://github.com/guillaumechereau/goxel/blob/master/INTERNALS.md), used to establish layout facts rather than copied or translated algorithms.

Supported: GOX versions 1 and 2; `GOX ` header; little-endian chunk records; `BL16` 64×64, 8-bit RGB/RGBA non-interlaced PNG blocks; 20-byte layer block references; dictionary metadata; named layers; visibility; material references; standard material color, metallic, roughness and emission properties. Positions are exact integers. Version 1 block positions are adjusted by −8 on import and +8 on export. The PNG codec handles filters 0–4 and validates CRCs without canvas color conversion or alpha premultiplication. GOX chunk CRC fields follow Goxel's zero/ignored convention.

Image, preview, camera and light payloads are retained. Material dictionary fields are preserved when editing supported properties. Unknown top-level chunks and unsupported layer semantics (linked/procedural layers, nonidentity transforms, nonnormal composition, unaligned blocks or unfamiliar layer attributes) make the document read-only. A read-only export returns the original bytes exactly. Invalid structures, references and encoded block data are rejected. Unsupported semantic documents may display only the stored voxel representation, not their full procedural result.

The editor uses Z-up voxel coordinates. World artwork rotates this basis into Nodevision's Y-up world as `(x, z, -y)`. World object scale is independent of the terrain's 0.25-meter voxels. No source coordinates are rescaled on save. Multiple placements share decoded immutable data while retaining independent render objects, transforms and visibility overrides. Source edits become visible when placements are reloaded; there is no live source watching yet.

## Reused and new components

Reused: bundled Three.js, OrbitControls, ViewportOrientationWidget, ModuleMap resolution, contextual cursor providers, the shared Layers panel, command registry, native create/save endpoints, tab metadata/dirty handling, Insert Media resource references, world layer history and serialization, and download provenance sidecars.

New code is under `ApplicationSystem/public/Voxels/`: binary/PNG/GOX codecs, sparse model, operation/history engine, material and brush helpers, chunk meshing/scene, viewport, panel controls, Layers adapter, command handlers and shared world asset cache/loader. Entry points are `ViewGOX.mjs`, `GOXeditor.mjs` and `GoxCursorProvider.mjs`.

Integration changes are confined to ModuleMap/FileExtensions, shared Layers provider collection, command definitions/loaders, Save, tab/layout dirty checks, blank-file creation, world loading/saving/disposal, model insertion/asset discovery, downloaded resource classification, download signature/codec validation and project destinations. Existing online providers are not advertised as supplying GOX unless their adapters actually return GOX formats. Attribution remains in existing sidecars/world metadata, never undocumented GOX chunks.

## Limits and extension points

- Rendering batches visible faces per chunk into opaque/translucent meshes; no per-voxel Mesh objects. A voxel edit invalidates its chunk and neighboring faces. Initial meshing yields between batches and is cancelled on panel close. Geometry, materials, controls, observers and cache references are disposed.
- Safety limits: 128 MiB input, 8,192 total layer block references, 20,000 records, coordinates within ±1,000,000, 262,144 cells per region operation, and 3 million rendered vertices. History retains at most 64 transactions. Large shape operations are bounded but currently synchronous; a worker mesher and budgeted operation scheduler are next performance improvements.
- Translucent surfaces use Three.js transparency sorting, which is approximate for intersecting surfaces. Meshing is face-culling, not greedy meshing. Material rendering approximates Goxel's appearance; it does not reproduce its ray tracer.
- PNG palette/interlaced blocks, editable procedural/linked layers and transform matrices are not supported. Version 1 is round-trip tested but does not yet have an independent legacy fixture.
- Camera/light/preview metadata is preserved, not regenerated from the current viewport. An imported embedded thumbnail can therefore remain stale after edits.
- Advanced selection, transformation and material operations use the command form; interactive transform handles, cross-layer selections and persistent layer locks are extension points. No nonfunctional controls are shown.
- Initial world integration is referenced artwork only: no terrain conversion, carving or physics. HTML Insert Media inserts GOX as a normal file link; GOX is not yet embedded as a portable standalone HTML model viewer.

## Validation

The included independent fixture was authored as four coordinate/color lines and imported and saved with unmodified Debian Goxel 0.11.0. Its provenance and input are in `Voxels/fixtures/README.md`. Nodevision imported that file, added a fifth voxel, saved it, and official Goxel 0.15.1 opened it and exported all five expected coordinates/colors. Executables were temporary test tools outside the repository.

Automated suites cover codec validation, sparse RGBA and layer round trips, malformed files, unknown preservation, materials, shapes, selections, transforms, brush settings, history, native create/save, download validation and attribution. Browser tests cover actual GOX panels, GLTF loading, GPU cleanup, shortcuts, terminal commands, material rendering, save/reopen, Save As, projection, resizing and transient viewer visibility. The world suite covers placement, source sharing, native undo/redo, save/reopen and authoring restrictions. Existing SVG Layers and downloaded-world-image regressions are also run.

Validation results: 83 passing Node tests (GOX, asset downloads and Insert Media), 52 GOX browser checks, 48 universal asset workflow checks including GOX insertion controls, 9 GOX world checks, 7 downloaded-world-asset checks, and the existing SVG Layers browser suite. GLTF coverage exercises the existing viewer; it is not a complete graphical-editor regression suite.

Commands:

```sh
node --test --test-isolation=none ApplicationSystem/public/Voxels/*.test.mjs ApplicationSystem/AssetDownloads/Tests/*.test.mjs ApplicationSystem/public/ToolbarJSONfiles/insertMedia*.test.mjs
python3 scripts/test-gox-browser.py
python3 scripts/test-universal-assets-browser.py
python3 scripts/test-svg-layers-browser.py
env -u ELECTRON_RUN_AS_NODE NV_WORLD_BROWSER=gox-world-browser.mjs xvfb-run -a node_modules/electron/dist/electron --no-sandbox scripts/procedural-world.electron.cjs
```
