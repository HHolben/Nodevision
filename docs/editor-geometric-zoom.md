# HTML and SVG editor geometric zoom

Ctrl+Alt+wheel magnifies the document/artwork in the active graphical editor. Ctrl+Fn+wheel uses the same route when the browser exposes Fn. Some keyboards handle Fn entirely in firmware; Alt is the fallback. Ctrl+Alt with +, −, or 0 enlarges, reduces, or resets geometric magnification. Shift+wheel without Ctrl remains horizontal scrolling.

HTML now uses a transformed runtime layer with a stable layout width and explicit scroll extent. Geometric magnification preserves line breaks, layout coordinates, and authored content. Ctrl alone changes the independent reading/reflow scale. Resetting geometric magnification leaves the reading scale intact. Image handles refresh on zoom changes.

SVG now transforms a runtime canvas layer instead of changing the SVG layout viewport on zoom. Artwork and strokes magnify uniformly while the viewBox, native editing coordinates, serialized source, and dirty state remain intact. SVG currently has no semantic zoom handler; Ctrl alone does not substitute geometric magnification. Scrollbars reserve stable space so their appearance does not resize the layout during magnification.

Validation:

- `python3 scripts/test-panel-zoom-browser.py --editor-scroll-only`: passed. Exercises actual HTML/SVG editor mounts under retained-tab ownership; measures rendered dimensions, unchanged HTML wrapping and SVG viewport, semantic/geometric independence, exposed Fn routing, coordinate round trips, source/dirty preservation, and Shift-wheel horizontal scrolling.
- `panelZoomInput.test.mjs`, `panelZoomCapabilities.test.mjs`, `SvgScaleGeometry.test.mjs`, `SvgPreservation.test.mjs`, and `HtmlSaveSafety.test.mjs`: passed.
- Browser Fn coverage is synthetic; physical Fn availability depends on the keyboard/browser.

## Whole-editor scope when no panel is selected

Click empty space in the main toolbar, sub-toolbar, or a panel toolbar to clear panel selection. Buttons, menus, labels, and inputs retain the current selection and perform their normal actions. Empty panel-toolbar clicks are stopped before they can reselect their parent panel.

With no selection, zoom gestures and the zoom toolbar target the full application shell (toolbars, workspace, and status bar). Ctrl+wheel changes the independent interface reading/reflow scale; Ctrl+Alt+wheel or browser-exposed Ctrl+Fn+wheel magnifies the existing layout. Geometric overflow can be scrolled. Ctrl+Alt+0 resets magnification; Ctrl+0 resets reading scale. The zoom controls display “Entire editor.” Clicking panel content selects that panel again; its local zoom resumes without changing the global scales.

The application adapter uses separate runtime wrappers and independent scale state, leaving every panel's stored zoom unchanged. Toolbar deselection clears active-cell, floating-panel, highlight, and last-active zoom references. Normal Shift-wheel gestures continue to use scrolling.

Validation: `python3 scripts/test-panel-zoom-browser.py --application-zoom` passes 18 browser checks covering real selection clearing, toolbar controls, retained global/local state, measured layout versus magnification, iframe forwarding, reset, and cleanup. The existing focused editor browser suite and zoom input/capability tests also pass.
