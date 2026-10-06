# CSV, SVG saves, images, File Manager, and workspace controls

## Reconnaissance and ownership

The checkout already implemented CSV rectangular ranges in `CSVRangeModel.mjs`, pointer/keyboard/clipboard routing in `CSVRangeInteraction.mjs`, constant-size selection overlays in `CSVGridView.mjs`, and model history in `CSVHistory.mjs`. The requested range behavior was verified rather than replaced. A stale source-level test still read the old `tableTools` facade instead of its implementation modules; it now uses the shared modular-source reader. The latency test requires `scripts/csv-editor-test-loader.mjs`.

ModuleMap continues to resolve CSV, SVG, JPG, and raster editors. SVG document serialization remains owned by `SvgPreservation.mjs` and the runtime save hook. The server receives saves through `fileSaveRoutes.js`, including source-path validation, format validation, backup policy, and LAN write checks. The JSON parser runs before those routes with a 50 MiB limit. No size limit was increased.

File Manager uses its existing Core directory list, selection visuals, and directory API. Canonical document selection is owned by `NodevisionSelection.mjs`; workspace activation and document-host attributes identify the active file. The list is a directory browser rather than a persistent expanded tree, so following a deeply nested file opens its parent directory and reveals the existing row.

Workspace serialization already records row/column splits, flex proportions, panel types/classes, tab order, active tabs, orientations, and collapsed sections. Its tab serialization also includes document references, so it cannot be persisted directly as a structural layout. The old Save Current Layout callback posted to `/api/saveLayout`, for which no implementation was found in the inspected application routes.

## CSV interaction and performance

See [CSV range interaction documentation](csv-range-editor.md). Click/drag and Shift-click/Shift-arrow select ranges; dragging inside a selected multi-cell range moves it, while a single-cell move begins at its edge. Double-click or F2 edits. Copy/cut/paste use quoted TSV; Delete clears declared cells. Moves capture the source before clearing, so overlap preserves relative arrangement and commits one history entry. Virtual cells do not expand the CSV merely by being selected.

The real browser regression passed with 36,000 cells and 200 selection plus 200 move previews: no table scans, rebuilds, history writes, document mutations, or toolbar/attention publications during movement. Stable hover also performs no layout reads or style writes. Committed edits still render the grid; this is not a virtualized spreadsheet.

## Oversized SVG saves

`requestSizeError.mjs` converts Express body-parser `entity.too.large` errors into HTTP 413 JSON with `REQUEST_TOO_LARGE` and the actual parser limit when available. Other errors continue through existing middleware. SVG clients also recognize a bare/proxy-generated 413 whose body is not JSON.

`SvgSaveRecovery.mjs` returns false on size rejection and opens a dialog explaining that the document remains unsaved. It reports serialized SVG byte size and the server limit when supplied. Download SVG backup uses a Blob of the exact rejected serialized buffer. Keep editing or Escape dismisses the dialog without altering the document. Retrying uses the normal Save action. This introduces no background autosave or external storage.

Modern SVG save hooks retain dirty state on failure, clear it only on success, and expose a context-owned save method. The toolbar now prefers that method; its fallback filters a cloned SVG instead of serializing the live root directly. The legacy SVG hook now awaits the HTTP result and returns failure, rather than returning before its fetch completes. `DownloadBlob.mjs` shares the existing object-URL download pattern with STL export and delays revocation until after dispatch.

The existing embedded PNG path writes base64 data URLs into SVG image attributes. This can substantially increase requests (base64 alone adds roughly one third before XML/JSON overhead), but no private Notebook scan was performed and no frequency claim is made. SVG cloning, XML serialization, JSON encoding, and server JSON parsing can retain several representations simultaneously. Increasing a global parser limit would increase peak memory exposure. A future authenticated raw SVG/streaming save endpoint should retain all current path/format/write-permission/backup checks and use atomic writes. Optional linked raster assets could help, but must be an explicit user-controlled conversion; nothing is externalized here.

## Image findings

**Blur:** A reproducible destructive path existed in `PNGeditor.replaceCanvasContents`: HTMLImageElement `width`/`height` were preferred over `naturalWidth`/`naturalHeight`. The browser test failed when a 640×480 JPEG displayed at 160×120 became a 160×120 editing canvas. Native dimensions now take priority. Canvas inputs retain their actual backing dimensions.

Separately, JPG viewing used CSS max-size fitting followed by generic panel scaling. Generic 100% therefore meant the fitted preview size, not native image pixels. `ImageViewport.mjs` retains the original decoded image, provides separate Fit and 100% controls, and registers geometric zoom with the common panel system. At 100%, one image pixel is one CSS pixel; on a devicePixelRatio-2 display that spans two device pixels. No intermediate bitmap is created during viewer zoom or rotation. Photographic JPG editing uses normal CSS interpolation instead of the pixel-art rendering style. Pixel-oriented canvas editing retains its native-pixel backing store rather than multiplying the document's pixel dimensions by DPR.

**Keyboard:** The inspected ModuleMap JPG viewer had neither rotation controls nor a custom arrow-pan handler, and the raster editor rotates the actual bitmap by quarter turns. The historical redirected-arrow report could not be conclusively attributed to an existing handler. The shared image viewport now provides explicit screen-direction arrow panning and view rotation, with inverse linear-transform mapping instead of angle-specific cases. Tests verify all four directions at 0°, 90°, 180°, 270°, and 37°. Shift-arrow uses a larger step. This does not claim to fix an unidentified embedded-image or other-panel path.

The HiDPI browser test also verifies that eight raster quarter turns interleaved with zoom/reset preserve the exact canvas data URL, and that native dimensions and 100% CSS size remain unchanged.

## File Manager findings

The grid declared five rows, but its loading row is normally `display:none`. Automatic grid placement then shifted the list into an auto-sized track instead of `minmax(0,1fr)`, allowing the bottom path control to obstruct long lists. Explicit child row assignments preserve the scroll track regardless of loading visibility; no oversized spacer was added.

`activePanelFileSelection.mjs` publishes only a file-backed active panel's explicit document path through the existing canonical store. A distinct `active-panel` event source prevents FileView's selection follower from reopening the file. Attribute-filtered observation handles asynchronous document changes after panel activation. Utility panels do not infer a file from stale globals.

`FileManagerFollowSelection.mjs` reuses directory fetching and visual selection, never dispatches synthetic clicks, and only scrolls when the row is outside the viewport. Generation checks reject stale follow responses and cleanup removes the listener. The Core directory API remains the existing singleton implementation; this change does not independently redesign multiple simultaneous File Manager instances.

## Named structural layouts

View → Layout Controls contains Save Current Layout and Load Saved Layout. Names are trimmed; duplicate names are rejected case-insensitively instead of overwritten. The selector searches locally stored names and loads the selected entry. Storage is application-origin localStorage, separate from Notebook document files and file-bound sessions; layouts are not automatically synchronized across browser profiles.

`savedLayoutModel.mjs` allowlists structural properties and a small set of persistent presentation variables (`theme`, `orientation`, `showToolbar`, `zoom`, `renderMode`). Document paths/references, document-derived tab labels/IDs, content, histories, and arbitrary variables are excluded. Additional persistent settings require deliberate schema extension. The renderer and existing cleanup/collapse hooks restore the arrangement. An existing flex serialization mismatch was fixed so already-serialized flex values are not suffixed a second time.

File-backed viewer/editor panels restore as neutral shells with Open selected file. The normal loader is invoked only on that explicit action. Tab metadata also honors the neutral flag, preventing fallback to the previously selected file. Recognized dirty document contexts block layout replacement until saved or closed; unsaved buffers are never written into the layout.

## Zoom capability contract

`registerPanelZoomCapabilities(element, handlers)` registers geometric, semantic, and fisheye functions independently on a panel instance. `executePanelZoom(element, mode, command)` returns false when unsupported. Each mode receives its own instance-local state object. Optional `getState(mode)` exposes adapter state to controls; registration returns a cleanup function. No mode is implemented by pretending it is another mode.

For example:

```js
const unregister = registerPanelZoomCapabilities(panel, {
  geometric(command, state) { /* Update this panel's spatial viewport. */ },
  semantic(command, state) { /* Change this panel's information granularity. */ },
  fisheye(command, state) { /* Update this panel's focus/context distortion. */ },
  getState(mode) { /* Return this panel's current state for controls. */ },
});
// Call unregister() from the panel's destroy lifecycle.
```

SVG and raster editors adapt their existing zoom implementations. JPG, PNG, and common image viewers use the native-source viewport. Other panels retain the existing geometric wrapper fallback; code-editor/local zoom routing is preserved. The existing zoom toolbar exposes capability availability, and controls dispatch through the adapter when registered.

Default inputs are Ctrl/Cmd-wheel and +/-/0 for geometric zoom, Ctrl/Cmd+Alt-wheel for semantic zoom, and Ctrl/Cmd+Shift-wheel for fisheye zoom. Modified +/- commands also route by mode; Shift used to type `+` remains geometric. `installPanelZoomShortcuts({resolveMode})` accepts a remapping resolver. Fn is not required: it may be handled in hardware without a keyboard event ([keyboard key definitions](https://developer.mozilla.org/en-US/docs/Web/API/UI_Events/Keyboard_event_key_values#modifier_keys)). Semantic and fisheye adapters are intentionally unsupported until a panel implements them.

Wheel input, including trackpads that emit Ctrl-wheel for pinch, is claimed only over the active panel and only when handled. Unmodified scrolling and events outside/inactive panels remain untouched. Native touchscreen pinch is not globally overridden: Pointer Events specifies separate `touch-action` negotiation for browser panning/zooming ([W3C Pointer Events](https://www.w3.org/TR/pointerevents/#the-touch-action-css-property)). A future touch adapter can dispatch the same commands once its panel explicitly owns that gesture. No physical touchscreen or OS-specific trackpad test was performed.

## Verification and limits

Passed:

- CSV model, range, history, and latency tests (latency runs with the CSV test loader).
- Eleven focused `Svg*.test.mjs` files plus Layers context/toolbar regression.
- Real Express parser overflow and retry, SVG recovery, canonical selection, File Manager directory images, tab metadata, saved-layout model/privacy, zoom capabilities, and image matrix tests.
- `python3 scripts/test-csv-browser.py`.
- `python3 scripts/test-svg-layers-browser.py`, including live SVG 413 recovery, dirty state, backup bytes, dismissal, retry, and existing Layers/overlay coverage.
- `python3 scripts/test-workspace-improvements-browser.py`, at devicePixelRatio 2: native/fitted image import regression, exact raster pixels after rotation/zoom, visible keyboard directions, independent zoom routing, short/long lists at multiple heights and UI zoom levels, deep file reveal, canonical activation, utility exclusions, neutral panels, split/tab restoration, and saved-layout search/load.
- Syntax checks for changed JavaScript/JSON, `git diff --check`, and new native-module header/length checks.

The workspace browser suite uses lightweight mounting/toolbar stubs around real image, selection-following, layout-rendering, storage, and neutral-panel helpers. It does not boot the entire Electron application or exercise every existing panel type. Existing large native modules were changed at their integration seams; newly added native modules satisfy the file-length standard. The original image keyboard reproduction remains unconfirmed pending identification of the panel/path involved.


## Changed implementation areas

- CSV: `CSVGridModel.test.mjs` (module-split-aware test repair; existing range implementation retained).
- Save recovery: server middleware and `server.mjs`; `FileInterop/DownloadBlob.mjs` / `SvgSaveRecovery.mjs`; modern SVG runtime save/context publication; both toolbar save routes; legacy `SwitchToSVGediting/initSVGEditor.js`; shared STL download integration.
- Images: `ImageViewport.mjs`, `ImageViewportGeometry.mjs`, `ViewJPG.mjs`, `ViewPNG.mjs`, `ViewImage.mjs`, and `PNGeditor.mjs`.
- File Manager: canonical selection event source, `activePanelFileSelection.mjs`, workspace activation tracking, FileView selection following, `FileManagerFollowSelection.mjs`, FileManager setup/Core integration, and explicit grid rows in `style.css`.
- Layouts: `savedLayoutModel.mjs`, `savedLayouts.mjs`, `neutralLayoutPanel.mjs`, workspace panel loader/renderer, tab metadata, View toolbar JSON, and save/load callbacks.
- Zoom: `panelZoomCapabilities.mjs`, `panelZoomPan.mjs`, zoom widgets, and SVG/raster adapter registration and teardown.
- Verification: focused model/HTTP tests, `svg-save-recovery-browser.mjs`, the expanded SVG suite, and `workspace-improvements-browser.mjs` with its local Chromium runner.
