# SVG textbox and Text Caret editing

Insert → Textbox previously always appended a rectangle and text inside a group. Even with Bg unchecked, the rectangle retained a visible stroke. Default insertion now appends only `<text>`. Checking Bg still explicitly requests a background/frame. Existing design rectangles are unchanged. Insertion participates in the existing snapshot history.

Choose **Text Caret** in the contextual cursor selector to edit text. The provider maps this tool directly to `toolState.mode = "text-caret"`; the existing tool notification updates the main cursor selector. Empty-canvas clicks finish editing without creating objects. Switching tools restores ordinary graphical selection and drawing behavior.

A native, accessible textarea outside the SVG receives keyboard, clipboard, and composition input. SVG start/end glyph positions, character extents, and screen matrices drive a separate caret and selection overlay. The overlay follows nested transforms, rotation, zoom, and scrolling and is clipped to the editor. It never becomes part of the document. Mouse drag, double-click word selection, triple-click line selection, and Shift-click are supported. Native keyboard navigation handles line/word/platform conventions; basic horizontal movement and deletion use `Intl.Segmenter` grapheme boundaries. Ctrl+S continues to propagate to the application save handler.

Edits change only affected text-node data. Unaffected spans and their attributes remain intact. New lines use ordinary SVG `tspan` elements with `x` and `dy`; removing an explicit line boundary removes the affected span's positioning attributes. Root styles and transforms remain unchanged. The live SVG always contains current text, including when saved during editing.

Typing is grouped into existing document-history snapshots after 800 ms idle or at navigation, paste/cut, focus, tool, history, and document-operation boundaries. There is no separate text undo stack. Undo/redo exits the current editing session and uses the same history as other SVG operations. Document replacement and disposal release input focus, pointer capture, timers, and overlays.

## Supported layouts and limits

- Ordinary horizontal SVG text, inline styled/nested tspans, and explicit multiline tspans are editable when their rendered glyph count can be mapped to text offsets.
- Element/group transforms, including rotation and nonuniform scaling, use native screen geometry. Grapheme-safe edits preserve emoji sequences and combining characters.
- Locked ancestors, hidden elements, and transparent ancestors prevent editing, including after an editing session starts.
- Text paths, non-tspan child elements, `textLength`, per-glyph `rotate`, position lists, vertical writing, raw newline/tab text nodes, and layouts whose whitespace/glyph mapping cannot be resolved fall back to source editing with a status message. An edit producing an unsupported mapping is rolled back.
- Complex bidirectional shaping and platform-specific IME behavior have not been exhaustively validated. Empty text remains valid but has no visible glyph to click after leaving the session.

## Changed modules

Paths below are relative to `ApplicationSystem/public/` unless stated otherwise.

- `ToolbarJSONfiles/svgTextBoxWidget.mjs`: optional background and insertion history.
- `CursorFamilies/providers/SVGCursorProvider.mjs`: contextual Text Caret registration.
- `PanelInstances/EditorPanels/GraphicalEditors/SVGeditorComponents/SvgTextCaret.mjs`: input/session controller.
- In the same directory, `SvgTextModel.mjs` and `SvgTextGeometry.mjs`: structure-preserving edits and screen overlays.
- Its `SVGeditorRuntimeParts/` modules `CreateBlankSvgRoot`, `CreateSetModeHandler`, `ConnectSvgPointerEvents`, `CreateSvgSelectionContext`, `InstallSvgHistoryAndLifecycle`, `CreateRunSvgSnapshotOperationHandler`, and `CreateStartResizeInteractionHandler`: tool, history, replacement, and lifecycle integration.
- `SvgTextModel.test.mjs`: grapheme-safe replacement checks. `SvgLineToolFeedback.test.mjs`: corrected default-parameter parsing in an existing source-test helper.
- Repository `scripts/svg-text-browser.mjs`, `scripts/svg-text-native.mjs`, and `scripts/test-svg-layers-browser.py`: real editor/browser regression and native Chromium input driver.

## Validation

Run from the repository root:

```sh
node --test ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/SVGeditorComponents/Svg*.test.mjs ApplicationSystem/public/CursorFamilies/ContextualCursorFamilyRegistry.test.mjs ApplicationSystem/public/VectorDrawing/*.test.mjs
python3 scripts/test-svg-layers-browser.py --svg-text
python3 scripts/test-svg-layers-browser.py --svg-rotation
python3 scripts/test-svg-layers-browser.py
```

Validation passed: 15 Node test files; 56 SVG text browser checks including native clipboard, navigation, and save-key propagation; 11,906 existing rotation assertions; and the existing layer browser suite. Browser tests use the production editor with a local fixture server and stub unrelated panel services. Persistence tests exercise production serialization and reload, rather than a filesystem save dialog. Existing unrelated working-tree changes were preserved.
