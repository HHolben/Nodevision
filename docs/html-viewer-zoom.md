<!-- Nodevision/docs/html-viewer-zoom.md -->
<!-- This report documents HTML reading reflow and geometric magnification, the removal of outline takeover, source and lifecycle invariants, and real-browser regression coverage. -->

# HTML Viewer: reading reflow and geometric magnification

Updated 2026-10-07 to match the user's clarified meanings. The earlier Outline/Page interpretation was incorrect for reading zoom: it hid the page, and geometric commands then scaled the hidden iframe. Zoom no longer creates an outline or hides the page. Layers remains a separate inspection feature.

| Mode | Meaning | Input | Reset |
| --- | --- | --- | --- |
| Semantic / reading | Enlarge the rendered page while reducing its CSS layout viewport so responsive text wraps within the viewer | Ctrl + wheel or Plus/Minus | Ctrl+0 restores reading scale 1 |
| Geometric | Magnify the existing layout, including SVG detail, without changing its layout viewport or line wrapping | Ctrl+Fn where exposed; Ctrl+Alt fallback | Modified 0 restores magnification 1 |
| Fisheye | Unsupported, reserved | Ctrl+Shift | No behavior |

The existing toolbar exposes both modes with independent plus/minus/reset controls. HTML no longer advertises Outline/Page choices. Reading zoom is continuous; it opts out of the shared discrete semantic-wheel accumulator. Graph and other discrete semantic representations retain their existing stepping behavior.

## Implementation and invariants

`panels/documentFrameZoom.mjs` registers one capability owner with independent reading and geometric factors. It changes only the outer iframe presentation:

- Reading factor R sets the frame viewport to baseline width/R and height/R and applies CSS zoom R. The displayed page width remains constant at geometric scale 1, while text becomes larger and wraps within the narrower layout viewport.
- Geometric factor G applies `transform: scale(G)` around the top-left corner. A geometric command neither measures nor resizes the iframe viewport. At a given reading factor, its line wrapping and internal SVG coordinates remain unchanged.
- Panel resizing updates baseline dimensions using the owner's border box. Magnification-induced scrollbars do not change the baseline or cause geometric gestures to reflow the page. Hidden retained tabs keep their last dimensions.
- Neither mode touches the authored document, reloads it, replaces selection, invokes editing history, or saves content. Application controls remain unscaled. Both factors reset independently and are local to the viewer instance.

`HtmlViewerZoom.mjs` is the HTML adapter over that helper. Same-origin PHP output and PHP editor previews use it through `HtmlFrameZoom.mjs`. `ViewSVG.mjs` uses the same helper with reading zoom disabled, giving SVG viewing direct magnification without changing the SVG viewport. Existing SVG editor canvas zoom remains unchanged.

Bounds are 0.5–8 for reading and 0.1–8 for geometric magnification. Reading zoom behaves like page zoom, enlarging text and other page content together; it does not override authored font sizes. Fixed-width content may still overflow rather than rewrap, according to its authored CSS. Geometric zoom can intentionally exceed the visible panel and use the existing scroll area to inspect detail. No pointer-anchored camera or saved-layout schema was added.

Frame replacement resets both scales and removes the old event bridge and resize observer. Disposal unregisters both modes and restores previous iframe styles. Cross-origin frame contents cannot be intercepted; the PHP wrapper retains explicit outer-frame toolbar scaling only. Physical Fn availability remains hardware/browser-dependent, so Ctrl+Alt and toolbar geometric controls remain available.

## Validation

`python3 scripts/test-panel-zoom-browser.py` passes with production-viewer tests that measure:

- Actual text block height and iframe viewport width: reading zoom increases wrapping and displayed text size without expanding the page's displayed width.
- Actual viewport and paragraph dimensions: Fn and Alt geometric zoom leave both unchanged while increasing visual magnification.
- Internal SVG shape dimensions and source remain unchanged under direct magnification.
- Small Ctrl-wheel deltas are applied immediately; unsupported fisheye, invalid old Outline commands and hidden/inactive owners are refused appropriately.
- Separate toolbar and keyboard commands, independent resets, panel resizing, hidden-tab dimension preservation, and two independent viewer instances.
- 100 reading transitions and 20 geometric commands with zero authored-DOM mutations, no frame reload, unchanged Nodevision state and retained browser text selection.
- Document replacement, old iframe bridge removal, observer/registration disposal and restoration of frame styles.
- Same-origin PHP viewer/preview and cross-origin restrictions, plus the existing native Graph, CSV, SVG editor, image, Monaco and PDF fallback regressions.

Four focused Node test files pass: `panelZoomInput`, `panelZoomCapabilities`, `htmlLayersContext`, and `HtmlLayerInvalidation`. Syntax and whitespace checks pass. Fn signals in automated tests are supplied explicitly; no physical keyboard detectability claim is made.

The 2,000-region fixture measures command execution separately from later browser painting. One measured run gave reading commands 0.1 ms median / 0.3 ms p95 and geometric commands 0.1 ms / 0.2 ms. These are not end-to-end paint latency guarantees or a comparison with the removed outline renderer.

## Scope

Changes: the new shared `documentFrameZoom.mjs`, replacement HTML adapter, SVG viewer integration, the shared router's continuous-semantic metadata gate, and updated HTML/PHP/SVG browser assertions. The capability registry and input modifier mapping are reused. No separate zoom manager or fisheye behavior was introduced. Other panel families retain their existing supported/unsupported representations; this correction implements reading reflow for HTML-producing viewers and previews.
