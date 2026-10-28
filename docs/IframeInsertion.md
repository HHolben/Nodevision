# Iframe insertion repair

Insert → IFRAME and Insert → Media → Insert iframe now open the same Insert Media panel. The virtual world's game-object iframe button also opens this panel. The resource selector offers **Notebook** and **Internet**. Notebook references are relative to the owning document; `/Notebook/...` is also supported. Internet sources require HTTP or HTTPS. References remain unchanged in saved source.

## Root cause

The original `insertIFRAME` callback emitted `<iframe src="..." title=...</a>`: an unquoted title and the wrong closing tag. It called `document.execCommand` directly after browser prompts, bypassing the HTML editor's remembered insertion range and history routing. The toolbar exposed it only in HTML mode.

The virtual world already had iframe meshes and projected DOM frames, but used a separate URL prompt. Its loading and saving code treated an empty sandbox as missing, substituted permissive permissions, or removed the sandbox attribute. The repair preserves empty sandbox values through insertion, rendering, history and serialization.

## Shared implementation and modified modules

- `ToolbarJSONfiles/insertMediaIframe.mjs`: shared media form, source choice, validation, captured editor target, HTML/PHP insertion adapters and world bridge dispatch. Reuses `openInsertMediaPanel`, media origin capture and asset-context validation.
- `Media/IframeProperties.mjs`: shared defaults, URL and dimension validation, safe DOM attribute assignment, imported-value handling and world definition construction.
- `Media/IframeEditing.mjs`: HTML/PHP selection, properties, preview, clipboard, duplicate and deletion, using existing media handles and HTML transactions. Runtime source resolution and sandbox restrictions use source provenance.
- `Media/PhpIframeObjects.mjs` and `PhpEditorUI.mjs`: selectable previews of literal iframe elements in PHP, with source-range replacement through the existing textarea and native undo. Surrounding PHP is never serialized through an HTML parser.
- `ToolbarCallbacks/insertCallbacks.js`, `ToolbarCallbacks/insert/insertIFRAME.mjs`, `insertToolbar.json`, `insertMediaWidget.mjs`, `worldShapeWidget.mjs`: repair the original callback and connect all entry points to the media form.
- `HTMLeditorImplParts/InitializeHtmlEditorTools.mjs`, `ConnectHtmlImageInteraction.mjs`, `InitializeHtmlImageHandles.mjs`, `CreateStartCornerTransformHandler.mjs`, `CreateSyncImageHandlesNowHandler.mjs`: install iframe editing and reuse image/media resize handles; iframe gestures use the existing transaction boundary. Image rotation remains image-specific.
- `HtmlSourceProvenance.mjs`: explicit authored-attribute updates, preserving editor-only runtime substitutions independently of saved values.
- `GameViewDependencies/worldLoading.mjs`, `worldSave.mjs`, `objectInspector.mjs`, `iframeProjection.mjs`: preserve sandbox restrictions and iframe settings, resolve new relative references against the world document, and project the configured viewport through existing world meshes. Existing world selection, transforms, inspector and history remain in use.
- `Commands/CommandDefinitions.mjs` and `NodevisionCommandRegistry.mjs`: expose `editor.insert.iframe` through the existing command infrastructure.
- `Media/IframeProperties.test.mjs`, `scripts/iframe-browser.mjs`, `scripts/iframe.electron.cjs`: validation and browser regression coverage.

## Workflow

Choose Notebook or Internet, enter a source, and configure width, height, title, loading, fullscreen, sandbox, permissions policy and border. Defaults are 560 × 315 pixels, lazy loading, no fullscreen grant and an empty restrictive sandbox. Cancel leaves the document unchanged.

HTML inserts at the captured selection/caret, or at the editor end without a caret. Click an iframe or select it through Layers, then use the existing corner handles or Properties to resize it. The iframe toolbar provides Properties, Preview, Delete and Duplicate. Enter opens properties, Delete/Backspace deletes, and ordinary copy/cut commands copy authored markup. Cut/paste provides flow placement; existing layout-canvas and world transforms retain their established behavior.

PHP inserts at the source caret only when the shared media scanner identifies a safe HTML position outside PHP blocks, tags and raw-text content. Literal iframes appear in an Embedded iframe objects pane with keyboard-selectable buttons, the same property form and the same resize handles. Edits replace only the corresponding source range and participate in native textarea undo/redo. The existing PHP save hook writes the updated source.

Preview opens an isolated iframe in an existing media panel; Close returns to parent editing. It does not automatically grant scripts or forms. The editor keeps iframe content from capturing selection clicks. The virtual world uses its existing iframe object selection and inspector workflow.

## Persistence and security

HTML uses its existing source serializer, provenance and history. Relative sources and authored sandbox attributes survive save and source replacement; resolved URLs and selection UI are not saved. Imported iframe settings are not replaced with insertion defaults. Unknown attributes remain intact when editing supported properties.

New sources reject filesystem, script, data and other unsupported schemes. Attributes are assigned with DOM APIs rather than interpolated HTML. Editor previews remain sandboxed; scripts plus same-origin are not granted together. Existing authored security attributes are preserved in source, while runtime previews may apply stricter restrictions. No CSP, X-Frame-Options or frame-ancestors bypass was added.

A blank or blocked iframe remains in the document. The editor explains that the resource may be unavailable or may reject embedding; browser restrictions prevent reliable diagnosis of every cross-origin load failure.

## Verification

Passed the focused Electron browser suite using real HTML and PHP editor modules, the shared media form, real DOM iframes, native textarea history, the real world bridge, projected world frames and the world serializer. Notebook reads and saves use in-memory fixtures. Coverage includes cancellation, safe source insertion, escaped attributes, relative and absolute URLs, selection, property updates, resizing, undo/redo, clipboard, duplicate/delete, HTML save/source replacement, PHP save/reopen with intact PHP blocks, imported attributes, blocked embedding and virtual-world insertion/history/serialization. A real fixture response supplies `X-Frame-Options: DENY`.

Passed six focused Node test files: iframe properties and mode availability; existing media toolbar and origin-context tests; HTML transactions, history restoration and save-safety tests. The existing Electron HTML foundation/mixed-history runner also passed. `git diff --check` passed.

Run the browser suite with:

```sh
env -u ELECTRON_RUN_AS_NODE xvfb-run -a node_modules/.bin/electron --no-sandbox scripts/iframe.electron.cjs
```

The `--no-sandbox` switch is confined to the existing local Electron test-harness convention; application sandbox policy is unchanged.

## Remaining limitations

- External sites can refuse embedding, and restrictive sandbox settings can limit their functionality.
- PHP-generated or PHP-interpolated iframe markup is not rewritten graphically. The conservative scanner may also decline complex PHP syntax such as heredocs; use the existing source editor and configured server preview for these cases.
- The PHP object pane displays literal embedded objects rather than rendering the full mixed PHP page. Server-side content continues to use the existing preview mechanism.
- Browser tests verify real editor/runtime behavior with fixture storage, not a deployed PHP server or every external website.
