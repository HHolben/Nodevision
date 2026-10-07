<!-- Nodevision/docs/zoom-modifier-followup.md -->
<!-- This report records the requested Ctrl-semantic and Fn-geometric mapping, missing PHP and CSV integrations, regression evidence, and hardware limitations. -->

# Ctrl semantic, Ctrl+Fn geometric

The shared mapping now follows the user's clarified requirement:

- **Ctrl + wheel / Plus / Minus / 0:** semantic step/reset.
- **Ctrl+Fn + wheel / Plus / Minus / 0:** geometric zoom/reset when the event exposes Fn.
- **Ctrl+Alt:** centralized geometric fallback for keyboards whose Fn signal is unavailable.
- **Ctrl+Shift:** reserved fisheye, unsupported; Shift used to type Plus is not interpreted as fisheye.

Unmodified scrolling and unrelated keyboard shortcuts remain unchanged. Toolbar mode selection remains independent of physical gestures. There is no semantic-to-geometric fallback, ancestor dispatch after refusal, or implicit whole-panel CSS scaling.

The single parser is `panels/panelZoomInput.mjs`. Its configuration API is now `configurePanelZoomInput({ geometricModifier: 'Alt' })`; `'None'` disables the alternate chord, and calling without arguments restores Alt. The previous internal `semanticModifier` configuration name is superseded. No saved settings/schema were changed.

## Coverage

| Family | Geometric behavior | Plain Ctrl semantic behavior |
| --- | --- | --- |
| HTML viewer | Existing page-only iframe scale | Reading resize/reflow |
| HTML graphical editor | Existing authored-page presentation shell | Unsupported; does not resize the page |
| PHP viewer and PHP editor's rendered preview | Shared HTML frame scale; no source injection | Reading resize/reflow for same-origin HTML output |
| PHP source editor | New text-size adapter keeps textarea and syntax overlay aligned | Unsupported; does not resize source text |
| CSV viewer | New shared presentation adapter scales the table only | Unsupported; does not resize cells |
| CSV graphical editor | Existing grid surface/overlay coordinate system | Unsupported; does not resize cells |
| SVG viewer/editor | Existing iframe/canvas scale | Unsupported; does not scale artwork |
| PNG and other raster viewer/editor | Existing decoded-pixel/display scale | Unsupported; does not change backing pixels |
| CodeEditor | Existing Monaco font-size adapter, including real retained sessions | Unsupported; does not change font size or invent folding semantics |

Graph Structure/Annotations, File Manager Compact/Detailed and other registered geometric panels inherit the same centralized input mapping. Unsupported semantic modes intentionally do nothing; no new semantic representation is invented for bitmap pixels or source code.

## Architecture and source safety

`HtmlFrameZoom.mjs` reuses `HtmlViewerZoom.mjs` for accessible PHP output and manages registration across frame loads. It neither injects authored page styles nor evaluates PHP. The PHP source editor mounts a focused `PhpEditorZoom.mjs` adapter; only three integration lines were added to its existing implementation. Preview input has its own embedded owner and cannot also resize source text.

Cross-origin pages cannot supply input events or an outline to the parent. They expose an explicit outer-frame geometric adapter for toolbar controls only; native input inside them remains outside the parent's reach. Navigating a previously outlined frame across origins exposed a `WindowProxy.removeEventListener` SecurityError during Layers cleanup. Cleanup now tolerates that specific navigation error and still releases the old outline and registration.

CSV viewer scale applies to the existing read-only table, not the containing panel. No CSV parsing, editing, serialization or history behavior changed. All new native adapter modules are below the programming standard's 200-line limit. The existing PHP editor is already over that limit; this task adds only import/mount/dispose hooks rather than broadly restructuring that unrelated implementation. This is not a claim that all touched legacy files satisfy the line limit.

## Validation

Passed:

- Four Node test files: `panelZoomInput`, `panelZoomCapabilities`, `htmlLayersContext`, `HtmlLayerInvalidation`.
- `python3 scripts/test-panel-zoom-browser.py`: active/retained/nested ownership, both physical intent routes, fallback configuration, unsupported modes, real Monaco and its production lifecycle, HTML view/editor, PHP view/source/preview, CSV view/editor, SVG view/editor, image viewport and PDF adapter checks. Source snapshots, selection, model versions, write counters, independent state and teardown are checked.
- `python3 scripts/test-workspace-improvements-browser.py`: actual PNG editor Ctrl refusal and exposed-Fn scaling, preserved native backing pixels, image viewport routing, and existing workspace regressions.
- Syntax checks for changed modules and `git diff --check`.

The PHP tests mount the production PHP editor and viewer against a local HTML response fixture; they do not certify a PHP interpreter or remote server. The cross-origin navigation test uses a second local hostname. Graph browser gesture expectations were updated; its expensive large-graph benchmark was not rerun because graph rendering was unchanged and the shared suite covers its native adapter.

Fn browser tests explicitly supply an observable Fn modifier to verify routing through real adapters and iframe bridges. They are **not a physical-keyboard test**. The previous Electron input probe did not observe Fn; actual firmware behavior remains unverified. If Fn is swallowed before reaching Chromium, no JavaScript mapping can distinguish Ctrl+Fn from Ctrl. Ctrl+Alt and the geometric toolbar are the working alternatives; the application does not claim to recover an absent signal.

Update, 2026-10-07: [HTML reading zoom](html-viewer-zoom.md) replaces the original Outline/Page implementation. Both reading reflow and geometric magnification keep the page visible; SVG viewer geometric zoom retains internal geometry. The mapping described above is unchanged.
