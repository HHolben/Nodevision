<!-- Nodevision/docs/panel-zoom-rollout.md -->
<!-- This report records the implemented zoom interaction contract, native adapters, validation evidence, limitations, and standards audit for the app-wide rollout. -->

# Panel zoom rollout

Status: implementation and validation, 2026-10-06. This report supersedes the implementation descriptions in the earlier [architecture reconnaissance](panel-zoom-architecture.md). The [Graph semantic prototype](graph-semantic-zoom-prototype.md) remains the basis of annotation detail; [directory scope](graph-directory-scope-investigation.md) remains an investigation, not implemented zoom.

## 1. Inventory and actual capability matrix

`implemented` means an explicitly registered adapter. An unregistered family reports all three capabilities false; there is no implicit geometric CSS fallback. Viewers and editors have distinct ownership and cleanup.

| Family | Geometric coordinate system / state | Semantic | Reset / fit | Fisheye |
| --- | --- | --- | --- | --- |
| Graph Manager | Implemented: Cytoscape camera; instance camera state | Implemented: Structure / Annotations | Camera scale 1 around current viewport center / Cytoscape fit | Unsupported, reserved |
| SVG editor | Implemented: existing canvas scale; SVG session | Unsupported: canvas layer/object projection pending | Baseline 1 / unsupported through registry | Unsupported, reserved |
| SVG viewer | Implemented: runtime iframe presentation scale; frame instance | Unsupported: viewer Layers inspection is separate | 1 / unsupported | Unsupported, reserved |
| HTML graphical editor | Implemented: runtime presentation shell around editable page; shell instance | Unsupported: region/element projection pending | 1 / unsupported | Unsupported, reserved |
| HTML viewer | Implemented: same-origin iframe presentation scale; frame instance | Unsupported | 1 / unsupported | Unsupported, reserved |
| CSV graphical editor | Implemented: native grid surface and overlays; view instance | Unsupported: table overview projection pending | 1 / unsupported | Unsupported, reserved |
| Image viewer | Implemented: decoded pixels, rotation and inverse-transform pan; viewport instance | Unsupported: no semantic bitmap representation | 1 pixel per CSS pixel / existing fit | Unsupported, reserved |
| Raster/image editor | Implemented: existing display scale without changing canvas backing size; editor state | Unsupported | Baseline decoded-pixel scale / no explicit registry fit | Unsupported, reserved |
| CodeEditor | Implemented: Monaco font size; retained editor session | Unsupported: folding remains an editing/navigation control | Session default font size / unsupported | Unsupported, reserved |
| PDF viewer/editor | Implemented: native page scale and matching overlays; PDF workspace | Unsupported: no existing thumbnail overview | Initial page scale (default 1.15) / unsupported | Unsupported, reserved |
| File Manager | Implemented: file-list row presentation scale; panel instance | Implemented: Compact names / Names and icons | Row scale 1; semantic detailed / unsupported | Unsupported, reserved |
| Layers panels | Unsupported; existing expand/collapse remains explicit | Unsupported | No shared reset/fit | Unsupported, reserved |
| Properties panels | Unsupported; application text/UI sizing remains separate | Unsupported | No shared reset/fit | Unsupported, reserved |
| Game View | Unsupported; gameplay camera and object controls remain separate | Unsupported | No shared reset/fit | Unsupported, reserved |
| Audio and other InfoPanels | Unsupported unless a future adapter opts in | Unsupported | No shared reset/fit | Unsupported, reserved |

The pre-rollout inventory, local listeners, state owners and coordinate defects are documented in architecture sections 1–5. That inventory is historical: Graph used outer CSS scaling, CodeEditor had independent local/global routes, HTML frames had a separate route, CSV had a client/local coordinate mismatch, and PDF was absent from the shared registry.

## 2. Intent and modifier routing

`panels/panelZoomInput.mjs` exports `ZoomIntent.Geometric`, `.Semantic` and `.Fisheye`. Ctrl (and retained Meta compatibility) routes geometric input. Detectable Fn requests semantic input; the default fallback is Alt. Shift requests reserved fisheye input. Shift used to type keyboard `+` retains ordinary geometric behavior. Semantic Ctrl+Alt+Plus/Minus/0 follows the same parser as wheel input. Wheel pixel, line and page units are normalized centrally. Unmodified wheel is unchanged.

The mode selector controls its own explicit toolbar buttons; it does not override physical modifier intent. Zero resets the requested mode. Fit is a separate advertised action. No panel interprets its own semantic modifiers.

## 3. Fn investigation

Executed `scripts/zoom-fn-probe.cjs` in Linux Electron **42.2.0**, Chromium **148.0.7778.97**. Electron accepted `sendInputEvent({keyCode:'Fn', ...})`, but the DOM event had empty `key` and `code`, and `getModifierState('Fn')` was false. Injected A and F1 produced normal key/code values and also reported Fn false. Ctrl/Alt were observable.

This is an Electron input-API probe, **not a physical keyboard measurement**. No physical Fn press was available to the automated session. It cannot establish how this machine's keyboard firmware handles Fn. The preferred Fn binding is honored if a real event exposes it; actual physical detectability remains unverified. No fabricated Fn event support is claimed.

## 4. Central fallback configuration

`configurePanelZoomInput({ semanticModifier: 'Alt' })` enables the default Ctrl+Alt fallback. `'None'` disables the fallback while retaining detectable Fn support. `getPanelZoomInputConfiguration()` reports the current mapping. Configuration is session-local and can be changed without modifying any adapter. The semantic toolbar also remains available without a modifier chord.

## 5. Geometric adapters

Graph, SVG, CSV, HTML, images, Monaco and PDF now dispatch through `panelZoomCapabilities`. The registry reports family-specific units rather than treating Monaco pixels as a universal percentage. The toolbar disables percentage input for text-pixel state and shows the text size. Native adapters own scale; the registry only routes commands and reports capability/state metadata.

## 6. Semantic adapters

Graph retains its source-preserving opacity-based Structure / Annotations levels. File Manager reuses existing row names and icons: Compact hides only the icon presentation; Detailed restores it. Neither transition navigates directories, fetches metadata, rebuilds canonical rows or changes the selected anchor. Defaults are Annotations and Detailed. Commands at the level boundaries are claimed no-ops.

## 7. Unsupported modes

Adapters declare unsupported semantic/fisheye modes with false, or omit handlers; both yield explicit false capability results. Missing adapters also report false. SVG and HTML Layers trees are separate inspection providers, not existing alternate canvas/page projections. CSV has no existing table-overview projection. PDF has no installed thumbnail overview. Those semantic modes remain unsupported rather than introducing another renderer or modifying authored content. Plain images and CodeEditor do not invent semantic meanings.

## 8. Graph geometric cleanup

The adapter calls `cy.zoom({ level, renderedPosition })`; pointer gestures retain their rendered anchor, keyboard/reset commands use the viewport center, and fit calls Cytoscape's native fit. There is no outer wrapper transform and no relayout. Semantic level, canonical data, positions and selection remain independent of the camera. Ordinary Cytoscape wheel navigation remains native; modified gestures belong to the shared router. Directory aggregation is unchanged.

## 9. CSV coordinates and performance correction

A dedicated grid surface contains both the table and the two bounded range overlays. Its transform scales them together, while a spacer supplies the scroll extent. Overlay measurement converts client rectangles back to surface-local units. DOM hit testing naturally uses the displayed transform. The scale operation does not rebuild cells or record history.

The first implementation using CSS `zoom` reflowed 20,000 cells and took about 420 ms median per command. It was replaced by the surface transform. The bounded-height regression measured **0.5 ms median / 4.6 ms p95** for the same 20,000-cell fixture. Existing CSV selection, editing, clipboard, drag and cursor tests also pass with 36,000 declared cells.

## 10. HTML content-only presentation

The graphical editor inserts a runtime presentation shell outside `wysiwyg`; only that shell scales. The authored DOM and its source/history observer roots are unchanged. The HTML fixture observes 2,000 authored regions and confirms zero authored mutations. This approach still incurs browser layout for large pages; it is not a virtualized HTML renderer. Viewer scaling affects its iframe presentation and never serializes a view transform into the document.

## 11. CodeEditor routing and modularization

`CodeEditorZoom.mjs` registers text-size commands against the owning Monaco session. The previous global shortcut hooks and local modified-wheel/keyboard routes are removed. Font state stays with retained sessions, and cleanup unregisters the adapter before disposing the editor. The original large module is split into small implementation modules preserving its exported entry points and initialization behavior. This does not redesign its existing active-session model or NBT editing API.

## 12. PDF, image and SVG integration

PDF commands target workspace page scale; requestAnimationFrame coalesces bursts, and render passes are serialized to avoid overlapping canvas tasks. Local PDF buttons use the same adapter. The checkout lacks PDF.js, so validation covers the real fallback workspace plus render scheduling, not installed PDF.js canvas rendering. Native PDF.js verification remains pending wherever that optional dependency is installed.

Image 100% remains one decoded pixel per CSS pixel; rotation and inverse-transform pan are retained. SVG reuses `setSvgCanvasZoom`, including its inverse point mapping and rulers. Its duplicate local Ctrl-wheel route is removed. Registry fit is disabled for SVG because the previous handler incorrectly treated fit as reset.

## 13. Iframe ownership

`panelZoomIframe.mjs` installs one same-origin bridge per frame document, cleans up old listeners, maps child client coordinates to parent client coordinates, and routes the original event through the same gate. It does not synthesize a second wheel event. Inactive owners are refused. Cross-origin documents cannot be intercepted; native browser behavior remains intact and those frames do not acquire a same-origin adapter.

## 14. Ownership and state isolation

Only the active visible panel can receive modified input. Closest embedded registrations form boundaries; refusal never invokes an ancestor. Nested workspace cells resolve their own active panels. Retained hidden tabs and disconnected owners cannot dispatch. Toolbar keyboard focus resolves to the active panel. Unsupported semantic/fisheye input is reserved against local geometric fallthrough. This reservation is not a claim that an unsupported adapter handled a command.

Each adapter stores its own state. Tests maintain different image, SVG, CodeEditor and PDF scales and separate geometric/semantic File Manager state. No new saved-layout fields were introduced. Source references, camera centers, selection identities and pointer anchors are not persisted by this work.

## 15. Performance evidence

Representative command timings from Chromium with software/headless rendering (20 samples; figures are machine/fixture specific):

| Fixture | Median | p95 |
| --- | ---: | ---: |
| CSV, 20,000 cells | 0.5 ms | 4.6 ms |
| HTML, 2,000 regions | 23.1 ms | 72.0 ms |
| SVG, 2,000 objects | 1.9 ms | 4.5 ms |
| Graph geometric, two-node routing fixture | 0.8 ms | 4.0 ms |
| Graph semantic, two-node routing fixture | 0.6 ms | 2.8 ms |

The existing larger Graph suite also passed: at 1,000 nodes / 3,999 edges, semantic commands measured 13.4 ms median / 25.4 ms p95; at 10,000 nodes / 39,999 edges, 176.8 ms / 465.4 ms. Large dense graph repaint remains expensive (up to seconds in this headless run). Semantic changes are discrete, batched, and boundary no-ops; no continuous semantic effect was added.

Owner lookup caches descendant discovery and invalidates on registration and activation changes. Tests instrument repeated wheel dispatch to ensure no per-tick subtree discovery and no application toolbar rebuild. PDF bursts coalesce to one render pass; no unrelated panel is rerendered.

## 16. Regression coverage

- Unit tests: capability isolation/refusal/disposal, modifier mappings, Fn signal handling, fallback configuration, wheel units, keyboard reset and reserved fisheye; real headless Cytoscape semantic invariants.
- `test-panel-zoom-browser.py`: active/inactive/hidden/nested/destroyed ownership, toolbar focus, same-origin bridge, native adapters, CSV overlay and hit testing, HTML authored-DOM immutability, SVG serialized-source/dirty invariants, real Monaco model version invariants, PDF coalescing and fallback alignment, File Manager selection identity, source-write counters and timings.
- `test-csv-browser.py`: existing large-grid selection, editing, clipboard, move, history and cursor regressions.
- `test-workspace-improvements-browser.py`: image pixels, arbitrary rotation/pan, raster backing-pixel preservation, independent mode routing, File Manager layout and saved-layout compatibility.
- `test-graph-semantic-zoom-browser.py`: real Cytoscape semantic state, geometry/selection/camera invariants, production registration, cleanup and larger graph benchmarks.

The browser fixture checks zero file saves/Notebook writes during zoom. No claim is made that every application feature or every hardware-specific input path has been tested.

## 17. Programming standards

The rule is **fewer than 200 nonblank, noncomment lines**, so 200 itself fails. Shared zoom/pan, its toolbar, CodeEditor and PDF implementation were split into focused modules. All native application files added or changed for this rollout are audited separately from pre-existing dirty files. See [the line-count audit](panel-zoom-line-audit.md) for exact scope, counts and outstanding working-tree violations. The full working tree must not be described as conformant while those violations remain.

## 18. Remaining panels

Layers, Properties, Game View and other unregistered InfoPanels intentionally report unsupported content zoom. Audio time-axis adapters and structural SVG/HTML/CSV/PDF semantic projections are future work. Cross-origin input, physical Fn detection and installed PDF.js canvas validation require their respective real environments. Dense graph repaint and large HTML page reflow remain performance limits.

## 19. Explicit answers and fisheye blockers

- **Does Ctrl zoom use the active native coordinate system?** Yes for the registered families in the matrix; unsupported families do not fall back to outer CSS scaling.
- **Can semantic intent route independently app-wide?** Yes. Graph and File Manager implement it; other families report unsupported.
- **Is the Fn fallback centralized and configurable?** Yes, in `panelZoomInput.mjs`; actual physical Fn behavior remains unverified.
- **Can unsupported semantic/fisheye become geometric?** No through the shared router. There is no ancestor or generic fallback, and migrated local listeners cannot reinterpret reserved modes.
- **Are states independent across panel types?** Yes; state lives in each adapter/session, with browser isolation checks.
- **Is authored content unchanged?** The implemented zoom paths perform no source writes, dirty changes or history entries; the tested source, model-version and mutation invariants pass. Optional PDF.js rendering remains unverified in this checkout.
- **Which major families support both modes?** Graph Manager and File Manager.

Fisheye remains a reserved unsupported intent. Before implementation it needs family-specific forward/inverse mappings, interaction and accessibility policy, focus ownership, lifecycle cleanup and performance measurements. No lens, nonlinear renderer, directory aggregation or expanded layout persistence was added.
