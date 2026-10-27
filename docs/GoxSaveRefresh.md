# GOX saving and viewer refresh

## Root cause and original save result

The old `handleFileSavedForView` compared a save notification to the global `FileViewModuleState.lastRenderedPath`. That path can outlive its viewer. A match called `updateViewPanel` without an explicit target, which logged “View panel element not found” when no viewer existed. It also ignored additional matching viewers and used a navigation/rendering path that changed global editor context.

The reported stack reaches `notifyFileSaved` **after** `saveViaApi` resolves. That API rejects unsuccessful HTTP responses or responses without `success: true`. The missing-panel branch logged an error and returned `false`; it did not throw. Therefore this trace indicates a server-reported successful write followed by a UI refresh error, rather than a failed GOX write. The historical file itself cannot be verified from the console trace; regression tests now verify saved bytes and reopened contents.

## Corrected flow

1. All existing save entry points converge on `api.save`: File/toolbar Save, Ctrl/Cmd+S, the shared GOX Save control, and `voxel.execute save`.
2. Save commits any pending stroke, captures its document revision and a copy-on-write snapshot, then serializes GOX bytes. Queued writes retain their requested snapshots.
3. `saveViaApi` must succeed before `savedRevision` advances. Genuine serialization or persistence failures still reject; no success notification is emitted. A later edit remains dirty because its revision differs from the persisted revision.
4. Editor status refresh and save-completion bookkeeping occur after persistence. Failures here receive explicit post-save diagnostics and cannot retroactively reject a successful write.
5. The file-save handler discovers actual FileView roots using the existing root markers and file-path helpers. It refreshes every mounted consumer of the same normalized, case-sensitive path. Unrelated documents and graphical editors are not replaced.
6. Refreshes are serialized per root, with newer notifications retained. Hidden tabs defer refresh until activation. GOX consumers currently editing or containing unsaved changes are protected. Destroyed/disconnected roots are ignored. FileView destruction marks the root unusable before cleanup.
7. The explicit `refreshOnly` path refreshes content without performing navigation or changing the active file/selection. GOX and HTML background rendering avoid taking toolbar/layer ownership. GOX can restore its own active viewer context only if that viewer still owns the active panel when loading completes, preserving a manually selected toolbar.

`updateViewPanel` now returns `false` for absent, detached, or destroyed targets without reporting an error. Real reload failures are reported as **“File saved, but viewer refresh failed”**, including the path and error. Pending GOX loads are cancelled when their DOM root is removed. Viewer module loading also checks that its original target is still current before rendering.

## Modules changed for this fix

Under `ApplicationSystem/public/`:

- `PanelInstances/ViewPanels/FileViewParts/InstallFileViewFocusHandler.mjs`: save notifications target matching viewer roots; activation resumes deferred updates.
- New `FileViewParts/RefreshSavedFileViews.mjs`: normalized matching, per-root queues, lifecycle/dirty guards, content-only refresh.
- `FileViewParts/UpdateViewPanel.mjs`: normal absence handling and explicit content-refresh entry point.
- `FileViewParts/SetupPanel.mjs`: mark destroyed roots and discard deferred work.
- `FileViewParts/RenderFile.mjs`: reject stale targets after asynchronous module loading.
- `FileViewers/ViewGOX.mjs`, `ViewHTML.mjs`: background refresh options.
- `Voxels/GoxPanel.mjs`, `GoxLayers.mjs`: preserve editor ownership, cancel detached loads, separate persisted state from optional UI updates.
- `ToolbarCallbacks/file/saveFile.mjs`: select the visible GOX tab, not a hidden sibling.
- `ToolbarCallbacks/file/saveFile/utils.mjs`: diagnose optional post-write notification/recents failures independently.
- `Voxels/GoxPersistence.test.mjs`: actual filesystem round-trip assertions for multiple layers and metadata.

New `scripts/gox-save-browser.mjs` is invoked by the existing GOX browser suite. Previous toolbar-refactor work remains intact.

## Validation

`node --test ApplicationSystem/public/Voxels/*.test.mjs ApplicationSystem/public/PanelInstances/ViewPanels/FileView*.test.mjs ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditorComponents/HtmlSaveSafety.test.mjs` passes all nine test files.

`python3 scripts/test-gox-browser.py` passes all 123 browser checks and exercises the real shared toolbar and FileView render/notification modules with controlled file API responses. Save regressions cover no viewer, multiple matching viewers, unrelated documents, hidden consumers, write rejection, queued/repeated saves, edits during a write, closing viewers during save/reload, protected editable viewers, unsupported read-only files, terminal/Ctrl+S/standard Save, and meaningful reopening of saved voxel data. Existing drawing, toolbar, camera, history, and GLTF checks remain included.

The native filesystem persistence test writes through the actual server-side binary writer and decodes the resulting file. Assertions cover negative/chunk-crossing positions, RGB/alpha, layer names, visibility, and supported metadata. The GOX codec is unchanged.

## Limits

- GOX layer locks are an existing session-only editor protection; the codec has no supported persisted lock field. This fix does not add a field or claim locks survive reopening. Supported metadata and unsupported read-only originals retain the codec's existing behavior.
- Editable/dirty viewers are intentionally not overwritten. Their deferred update can resume after they are clean, in View mode, and activated; independently edited graphical-editor documents are never automatically replaced.
- A genuine viewer reload failure is diagnosed separately and can be retried by reopening/refreshing the viewer or a subsequent save. It does not roll back a completed write.
