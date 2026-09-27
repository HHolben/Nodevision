# SVG Layers in viewer and editor contexts

The SVG Module Map already maps `svg` to `ViewSVG.mjs`, `SVGeditor.mjs`, and its contextual cursor provider. Layers is a View toolbar command, not a separate file-family renderer, so the Module Map remains unchanged.

## Architecture and original problems

`viewToolbar.json` limited Layers to `SVG Editing` and several unrelated document modes. `ViewLayers.mjs` and `SVGLayersPanel.mjs` looked only for `SVGEditorContext.layers`. `ViewSVG.mjs` loaded the SVG into a same-origin iframe without exposing a provider. Consequently, a viewed SVG had neither an eligible toolbar command nor a Layers data source.

The existing `ElementLayers.mjs` manager owns authored `g[data-layer="true"]` layers, active-layer state, and a DOM mutation observer. `ElementLayers/panel.mjs` supplies object controls, selection synchronization, sketch controls, and layer rows. Its object drag handler bubbled into the enclosing layer handler, overwriting the dragged-object state. Its model move method performed a blind `insertBefore`, without transform/style preservation or its own successful-mutation contract.

The graphical editor owns `SVGEditorContext`, dirty state, `SvgUndoStack`, selection, serialization, and the normal save hook. It already announces `nv-svg-editor-context-ready`. Existing `toolbarAction` routing opens `GraphicalEditor` with a file path. These mechanisms are reused; Layers has no separate save/history stack.

## Shared inspection and availability

A document-based `activeFileIsSvg` toolbar condition exposes Layers in viewer, graphical-editor, and other active SVG modes. The other providers retain their previous mode declarations. The common toolbar path resolver now recognizes FileView's actual `Default` mode, preventing stale editor paths from overriding the active viewed file.

`svgLayersContext.mjs` resolves the provider for the active file and mode. `ViewSVG.mjs` attaches the existing manager to the iframe's SVG document with read-only options. Inspection never adds IDs, names, or layer wrappers. Per-view context is retained on the viewer host and reactivated through FileView's panel activation event. Viewer disposal removes the observer and activation listener.

Both modes render the same tree. A synthetic **SVG document** row exposes ordinary groups, drawable root children, and resources without inserting anything into the SVG. Authored layers retain their existing controls. In viewer mode, expansion and inspection selection work locally in the panel; mutation buttons are disabled. The viewer does not impersonate the graphical editor's selection owner. In editor mode, selection still uses `SVGEditorContext` and its existing selection event.

A viewer drop opens or reuses the ordinary graphical editor, waits for its ready event, resolves authored-node addresses, checks that the source still matches, then invokes the editor's reparent operation. A mismatch is rejected instead of applying the gesture to a different object. The panel follows the promoted editor; the iframe document is not modified or saved.

## Dragging and preservation

`ElementLayers/drag.mjs` delegates native drag events at the panel. Object drops append into a layer/group or the document root. Existing authored-layer ordering remains available by dragging the layer name. Feedback changes only the current row; structural invalidity is shown in red. Detailed appearance checks run on drop, with an explanatory status message for rejected operations.

`ElementLayers/reparent.mjs` moves the original node. When required, it creates a compensation group containing the destination-inverse × source-parent transform and differing inherited paint/text properties. The original object's geometry, transform attribute, ID, classes, inline styles, references, metadata, and nested content are retained. Plain moves directly reparent the object without a wrapper.

The helper verifies computed presentation and screen-space transforms across the moved subtree and rolls back mismatches. It rejects hierarchy cycles, locked nodes, resource/nested-viewport destinations, singular matrices, differing XML inheritance/reference bases, animated/scripted SVGs, structural or conditional embedded stylesheets, and changed-ancestry compositing effects such as group opacity, masks, clipping, filters, or blending. Stylesheet effects on a compensation wrapper are also rejected.

Sibling paint order intentionally changes: dropping into a group appends the object to its front in SVG paint order. Preserving a group's overall compositing while moving just one member is not generally possible, so those operations are rejected rather than approximated.

## History, selection, and performance

The editor pushes one custom action onto its existing `SvgUndoStack`, marks the document dirty through `markDocumentDirty`, and selects the moved node through `setSelection`. Undo and redo restore hierarchy and sibling order. `nodeAddress.mjs` resolves replacement nodes when another editor command has restored a serialized snapshot. Normal save serialization and Ctrl+S routing are unchanged.

The existing mutation observer refreshes the tree after a committed edit. Dragover does no whole-SVG scanning, tree rebuilding, style capture, geometry work for object destinations, toolbar updates, or selection broadcasts. Preservation checks and subtree traversal occur only on drop. The Layers tree itself is not virtualized, and committed changes may still rebuild the existing tree.

## Tests

Run:

```sh
node --test ApplicationSystem/public/PanelInstances/Common/Layers/svgLayersContext.test.mjs
python3 scripts/test-svg-layers-browser.py
```

The browser runner uses installed Chromium (or a path passed as its first argument), a local fixture server, the real SVG editor runtime, the real Layers panel/manager, and lightweight workspace/toolbar host stubs. It covers viewer availability and non-mutating inspection; viewer-to-editor promotion; actual drag events; authored and ordinary groups; node/attribute/content integrity; transform and inherited paint preservation; rejected drops; visibility/locking and layer-order controls; real editor history including snapshot replacement; and the normal save hook.

The structural performance regression adds 1,200 objects and sends 300 dragover events, asserting zero document queries, tree rebuilds, geometry reads, toolbar publications, or selection broadcasts during that interval. It uses operation counts rather than machine-dependent timing thresholds.

Remaining limits include conservative rejection of complex compositing, animation, structural CSS, nested viewports, and XML inheritance changes. Cross-origin iframe inspection is unavailable. The tests do not exercise an operating-system drag gesture or the entire workspace layout; they dispatch browser drag events through the real handlers and use the real editor lifecycle after its normal opening request.

## Selection chrome investigation and repair

`SVGeditorRuntime.mjs` previously appended a `g[data-nv-editor-ui="overlay"]` directly to the authored SVG. It held the blue dashed selection rectangle, marquee, transform handles, Bezier/sketch previews, and drawing guides. This was excluded from selectable elements and normal saves, but remained inside root `getBBox()` and the Layers mutation observer's subtree.

The investigation found concrete lifecycle defects: reload copied marked overlays from incoming markup before appending the live overlay again; geometry refresh accepted disconnected selected nodes; selection RAF callbacks could run after editor disposal; and teardown left overlay DOM, ruler observers, and deferred tool work alive. The browser regressions exercise contaminated reload, external deletion, selection replacement/clear, history, and disposal with pending selection work. These are proven failure paths, but do not establish which one produced every historical blue rectangle reported by the user.

The previous normal save path already cloned the document and stripped `[data-nv-editor-ui]` nodes. We did **not** reproduce a correctly marked selection rectangle escaping that filter. Raw live-DOM serialization could include chrome because it was physically inside the document; unmarked historical rectangles cannot safely be distinguished from user artwork by their color. No heuristic deletes ordinary blue rectangles.

`SvgChrome.mjs` now owns a sibling SVG over the viewport. One matrix maps authored SVG coordinates into this overlay; scroll, resize, root viewBox changes, and geometry refresh keep it aligned. The existing drawing/node/selection controllers share their existing overlay group. Pointer events delegate at the common viewport host, so handles remain interactive. Chrome is structurally outside document bounds, Layers, document mutations, clipboard, history snapshots, and save/export content.

`SvgPreservation.mjs` remains the centralized defensive save filter and now also handles a cloned selection root's transient attribute. Initial load and snapshot reload strip marked incoming chrome; copy/duplicate use the same cleanup. A child-list observer checks only the current selection for disconnected nodes. Teardown cancels pending selection/freehand work and tool timers, disconnects observers, destroys chrome and auxiliary menus, and removes the editor wrapper. Deferred selection work checks runtime ownership before publishing.

`scripts/svg-chrome-browser.mjs`, run by the existing browser suite, covers select A → B → clear, dirty/save stability, independent document bounds, zero document mutation records for overlay movement, deletion, undo/redo, clipboard, contaminated reload, viewBox alignment, pointer resizing through the external handles, and closing with pending selection callbacks. It complements the existing layer reparent selection/history coverage. Browser checks pass in Chromium; the focused SVG Node tests pass. A broader run also encountered three failures in untouched sketch recognition tests (`PencilSketchAngleFit`, `PencilSketchTriangleFit`, `ShapeRecognition`).
