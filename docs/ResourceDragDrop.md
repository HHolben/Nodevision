# Notebook resource drag-and-drop

File Manager and Graph Manager can link existing Notebook files directly into supported editors. Files stay in place; dropping does not copy or convert them.

## Existing architecture reused

File Manager already supplies Notebook paths, multi-selection JSON, URI/text flavors and desktop file export through `NotebookExternalFileInterop`. Graph Manager represents actual files with Cytoscape nodes carrying `type: file` and `fullPath`; concept and relationship nodes are distinct. Docked editors own their DOM roots and contexts, while world editing has one active runtime.

The implementation extends those identities and retains existing transfer flavors. `utils/notebookPath.mjs` supplies relative paths. HTML uses `insertHTMLAtCaret`, source provenance and transactions. PHP uses the existing safe-markup scanner and textarea undo. SVG uses `insertImageFromInsertion`, layer insertion, image sizing and snapshot history. Worlds use `ModelPlacement`, the object-file loader, media bridge, raycasting and native serialization. Insert → Media and drops share semantic HTML markup through `Media/LinkedResourceMarkup.mjs`.

## Shared contract and extension API

`ResourceDrop/ResourceTransfer.mjs` publishes `application/x-nodevision-resource+json`:

```js
{ type: 'nodevision-resource', version: 1, sourcePanel: 'file-manager',
  resources: [{ path: 'Project/Assets/Picture.png', isDirectory: false }] }
```

Canonical Notebook paths identify resources independently of panel or filename. Only the typed flavor triggers linking; ordinary text, external Files and existing document-object drags retain their handlers. A shared in-memory payload supports browsers' protected dragover data store. Folders and multiple-file drops are rejected.

Editors call `registerResourceDropTarget(root, adapter)` and release its returned cleanup function when disposed. `adapter.capture(resource, pointer)` returns a label, optional caret rectangle or world position, a `validate()` guard, and an `insert()` operation using the editor's history API. Optional preview/clearPreview hooks render editor-specific feedback. The common handler checks existence before mutation, validates the captured destination again after asynchronous work, routes errors and prevents concurrent drops. Registration is per receiving root, independent of whichever editor was previously active.

Graph nodes use canvas gestures rather than native DOM dragstart. Dragging a file node outside the graph routes the same payload to the target under the pointer and restores the node's original graph position. Normal node movement inside the graph and Ctrl/Meta/Shift gestures retain existing behavior. Escape cancels. File Manager retains move/copy payloads; Alt-drag invokes its native Electron desktop-export path, while ordinary drags retain browser data for internal linking.

## Relative paths and persistence

Raw Notebook identities are encoded before calling the existing relative resolver, preserving spaces, Unicode, literal percent signs, question marks and hashes. HTML/PHP `src`/`href` and SVG image references are relative to the containing document, including across project directories. Runtime presentation resolves these references against the Notebook document directory. HTML provenance and SVG clone cleanup retain authored relative values during save, history and clipboard operations. Temporary drag indicators are outside saved content.

World `modelFile`, `objectFile` and `imageFile` fields retain canonical Notebook-relative identities required by their existing schema; they are not filesystem-absolute paths or document-relative `../` paths. Linked world iframe sources are document-relative. GOX remains a GOX reference, and glTF/GLB remain polygonal asset references.

Unsaved documents, invalid paths, missing resources, inappropriate PHP regions, read-only destinations and locked SVG layers reject the drop with feedback. Existing Insert → Media/import workflows remain available for unsupported cases. There is no automatic conversion or fallback import.

Graph dependency scanning and File Manager's existing move/rename link-impact workflow continue to see ordinary native references. This feature adds no independent dependency graph and does not rewrite unrelated documents. Moving a linked resource can break links unless handled by the existing link-maintenance workflow.

## Supported destinations

| Editor | Resource representation |
| --- | --- |
| HTML | PNG/JPEG/GIF/WebP/SVG/AVIF/BMP images; MP4/WebM video; MP3/WAV/OGG audio; other files as hyperlinks |
| PHP | Same markup in safe HTML regions of the source pane; PHP blocks and tag syntax are protected |
| SVG | Externally referenced images in the active unlocked layer; inverse screen transform determines coordinates and native image sizing preserves aspect ratio |
| Virtual World | GOX/glTF/GLB through model placement; STL/OBJ/SCAD through existing object-file insertion; images as existing image objects; HTML/HTM/PHP as iframe objects |
| Other graphical editors | Explicit rejection where the native format has no persistent linked-resource representation; existing import remains available |

HTML drops resolve a pointer caret, including table cells, and preserve surrounding text. SVG feedback marks the pointer; world feedback includes a transient world-space marker on the raycast surface. Successful insertions use native undo/redo. Existing selection, transform and save behavior remains owned by each editor.

## Verification

Added `ResourceTransfer.test.mjs` for relative relationships, special characters, unsafe/unsaved paths, compatible source contracts, folder/multiple-file rejection, semantic media selection and escaping. Existing file interoperability and iframe property tests also pass.

Added `scripts/resource-drop-browser.mjs`, run by `scripts/iframe.electron.cjs --resources`. It exercises real HTML, PHP and SVG editors and the real world bridge/loaders with fixture storage. Checks cover both source adapters into HTML/SVG/world; exact caret and transformed SVG placement; table/media dispatch; canceled previews; missing and read-only rejection; receiving-panel isolation; SVG layer locks; relative save/reload, copy/paste and duplicate; PHP preservation/native undo; GOX/glTF/STL identities; world placement, history and serialization.

Also ran the existing iframe browser suite (including virtual-world iframe projection, save and undo/redo), HTML foundation/history suite and SVG modular runtime regression suite.

```sh
node --experimental-loader ./scripts/html-test-loader.mjs --test ApplicationSystem/public/ResourceDrop/ResourceTransfer.test.mjs ApplicationSystem/public/Media/IframeProperties.test.mjs ApplicationSystem/public/FileInterop/NotebookExternalFileInterop.test.mjs
env -u ELECTRON_RUN_AS_NODE xvfb-run -a node_modules/.bin/electron --no-sandbox scripts/iframe.electron.cjs --resources
```

## Limits

The PHP editor exposes source plus server preview and literal iframe objects, not a general WYSIWYG representation of generated PHP. Resource drops therefore target its safe source regions. Only one active world runtime is supported by the existing world architecture; a stale world rejects drops. Batch/folder linking and non-file conceptual graph nodes are unsupported.

The browser harness uses synthetic native drag events and simulated Cytoscape node gestures against real adapters; it does not automate a complete installed desktop docking session or external OS drag/export. Fixture reads/saves and model serializers are tested rather than a deployed server/filesystem round trip. OBJ/SCAD, every image codec and arbitrary third-party models are dispatched through existing loaders but are not individually fixture-tested here.

## World inventory and hotbar

`InventoryResourceDrops.mjs` registers the floating inventory content and HUD hotbar as nested resource targets. GOX/GLB/glTF drops assign the targeted slot or add an inventory item without placing it in the world. Slot handlers retain their existing inventory-item drag behavior and allow resource/file drops to reach the model adapter. Graph Manager pointer drops resolve the same targets. Local files have a separate validated import handler, using existing binary-save helpers and unique asset names. All listeners and targets are released with the inventory.
