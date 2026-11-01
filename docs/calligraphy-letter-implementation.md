# Calligraphy Letter implementation

Implemented for the graphical HTML editor. The requested PHP graphical editing support remains incomplete: the existing PHP editor contains a source textarea and a read-only simulated/server preview, not an editable document surface. `HtmlSourceDocument.mjs` explicitly refuses PHP source to avoid syntax loss. In PHP mode the new command explains this limitation and does not call a stale HTML editor. Safe PHP support requires mapping editable HTML regions back to PHP source; that is not introduced by this change.

## Existing functionality and reuse

`HtmlImageText.mjs` and its parts implement “Replace Selected Text with Image”: original text remains inside a `span.nodevision-image-text`, while `data-nodevision-image-src` and a CSS background define its appearance. Existing helpers select, resize, replace, serialize, rehydrate, and unwrap these spans. Existing typography tooling writes `@font-face` declarations for Notebook fonts. Three.js already bundles `lib/three/libs/opentype.module.js`; no dependency was added.

The new command uses those spans, layout controls, selection state, and the DOM history journal. “Convert to Text” names the existing removal command. “Edit Image Here” now accepts image-text contexts as well as images, passes their actual source to the existing temporary-resource preparation, and restores the edited source on the semantic span. A history transaction covers the inline edit. Source changes occur after reattaching the span so undo can observe them.

## Representation and behavior

Each non-whitespace grapheme becomes an independent span whose only text content is the original grapheme. It has an SVG data URL background; there is no second visible text node or accessibility label duplicating the character. The span is atomic (`contenteditable="false"`) to prevent accidental edits to the identity while its appearance is unchanged. Restoring it unwraps the original text.

The command converts individual text ranges in reverse order, preserving surrounding inline markup, paragraphs, and table cells. Whitespace remains ordinary text. A collapsed caret inserts A. All graphics are prepared before mutation; edits or a panel switch during font loading cancel the operation. Conversion is recorded as one history entry. Unicode segmentation uses `Intl.Segmenter`. Partial graphemes and graphemes split across formatting nodes are refused without changing the document rather than generating broken components.

Layout uses the selected range's advance width, font metrics, em dimensions, and a descent baseline offset. An overflow-contained inline box prevents its invisible semantic text from increasing line height. Existing Text Image Layout controls resize letters, and normal cut/paste moves them within text flow.

Data URLs keep completed letters portable without creating one external asset per character. Equal content generates equal URLs, although markup necessarily repeats the source for separate objects. Graphical editing still uses the existing temporary Notebook resource workflow.

## Font generation and limitations

The shared `Typography/CalligraphyGlyph.mjs` service discovers an unambiguous accessible primary `@font-face` with matching weight/style and normal stretch. It loads and parses the font with the bundled OpenType implementation and generates actual paths for supported single Latin characters. Conversion caches the font promise per typography within the operation. Font embedding restriction bits are checked conservatively; these flags are not a complete license determination.

Variable fonts, explicit OpenType features/caps, non-normal stretch, complex shaping, missing glyphs, inaccessible/system-only font files, and parser failures use SVG `<text>` with the requested computed typography. A visible warning explains that this is font-dependent and may change appearance elsewhere. The fallback does not silently claim to be a matching portable outline. Unsupported formats such as WOFF2 can take this fallback.

Cross-letter kerning, ligatures, contextual joining, and exact decorative overhangs are not guaranteed for independently editable objects. Complex-script graphemes remain semantically intact but independent SVG text may render differently. Font-dependent SVG images cannot inherit a parent document's private web-font resources. Background printing depends on browser print settings despite `print-color-adjust: exact`; PDF text extraction and platform clipboard interoperability were not verified. Search/text extraction of the HTML DOM sees the original text once.

## Files changed

Under `ApplicationSystem/public/`:

- `Typography/CalligraphyGlyph.mjs`: shared font resolution, outline generation, and explicit fallback.
- `ToolbarCallbacks/insert/insertCalligraphyLetter.mjs`: active-editor routing and PHP guard.
- `ToolbarJSONfiles/insertToolbar.json`: Insert → Text → Calligraphy Letter.
- `ToolbarJSONfiles/editToolbar.json`: graphical editing entry and Convert to Text label.
- `PanelInstances/EditorPanels/GraphicalEditors/HTMLeditorComponents/HtmlCalligraphy.mjs`: grapheme conversion and flow layout.
- In that directory's `HTMLeditorImplParts/`: `CreateCalligraphyHandler.mjs`, `RegisterHTMLLayoutTools.mjs`, `ConnectHtmlImageInteraction.mjs`, `PrepareInlineImageEditor.mjs`, `MountInlineImageEditor.mjs`, `OpenInsertImageForm.mjs`, and `CreateCloseInlineImageEditorHandler.mjs`: command registration, SVG-edit compatibility, and history.

Other files: `scripts/calligraphy-browser.mjs`, `scripts/run-calligraphy-browser.mjs`, and this report.

## Validation

`node scripts/run-calligraphy-browser.mjs`: **26 checks passed in Chromium**. Covers individual SVGs, surrounding text, caret A insertion, multiple characters, whitespace, Unicode clusters, partial/cross-format cluster rejection, stale-operation refusal, DOM text extraction, table integrity, serialized HTML reopen and clipboard-like HTML round trip, geometry replacement, resizing, moving, restoration, baseline/wrapping, unavailable fonts, explicit OpenType fallback, actual CSS font discovery/parsing, vector outlines, and the real inline-edit finish handler with undo/redo.

The edit-finish test mocks Notebook save/load endpoints and uses the real finish/history code. It does not automate drawing inside the full SVG editor. Clipboard coverage is serialized HTML round-trip coverage, not operating-system clipboard testing.

`node --test` passed all three selected existing test files: `HtmlDomHistory.test.mjs`, `HtmlEditorTransactions.test.mjs`, and `HtmlSaveSafety.test.mjs`. JavaScript syntax and `git diff --check` checks also passed.

Follow-up priorities: PHP source mapping; a capable shaping/variable-font pipeline and font resource embedding; cross-format graphemes; full SVG UI/OS clipboard/print/PDF integration tests; better handling of glyph bearings and decorative overhangs.
