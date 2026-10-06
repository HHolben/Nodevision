<!-- Nodevision/docs/panel-zoom-architecture.md -->
<!-- This report examines the current panel zoom implementation and proposes shared capability, event, state, and representation rules without implementing new zoom behavior. -->

# Panel zoom architecture

Implementation update, 2026-10-06: see [the app-wide rollout report](panel-zoom-rollout.md) for the current capability matrix, centralized input mapping, native adapters, tests and remaining limitations. The reconnaissance below records the pre-rollout state.

Status: reconnaissance and proposal, 2026-10-04. This report describes the working tree, including the recent uncommitted workspace improvements. “Current” means implementation found in this tree; “proposed” is not a claim of implemented support. No application code changed for this report.

Nodevision should retain its small per-instance capability registry. Each panel owns its representation and coordinate mapping; the workspace owns routing and mode choice. Geometric, semantic, and fisheye are independent capabilities, not three ways of applying a CSS transform. Unsupported modes remain unavailable. The recommended first prototype is **Graph Manager semantic edge-annotation detail**, with exactly two discrete levels and unchanged topology, positions, and canonical selection.

## 1. Current routing and ownership

The principal implementation is [panelZoomCapabilities.mjs](../ApplicationSystem/public/panels/panelZoomCapabilities.mjs). It registers handlers in a WeakMap keyed by a DOM host, returns an unregister function, creates independent scratch state for each mode, and emits capability/state notifications. `executePanelZoom(panel, mode, command)` returns false for an absent handler and otherwise treats any return except false as handled. `getPanelZoomState` delegates to an optional `getState(mode)`; it does **not** expose the registry scratch state automatically.

Lookup first checks the supplied host, then the first descendant with `data-nv-zoom-capabilities`. It does not itself check whether that descendant belongs to an inactive retained tab or a nested independent panel. The fallback advertises geometric support for connected hosts without a local zoom scope, even when scaling that family's entire DOM is inappropriate. Absence of registration is consequently not an explicit opt-out.

[panelZoomPan.mjs](../ApplicationSystem/public/panels/panelZoomPan.mjs) supplies the generic wrapper/spacer/transform viewport and installs window capture listeners. Ctrl or Meta wheel uses an exponential factor; keyboard plus/equal, minus and zero implement in/out/reset. Both paths require the event's resolved panel to equal the active panel. CodeEditor is intercepted through separate global hooks before capability dispatch. Local zoom scopes suppress the generic fallback. An accepted route prevents default and stops propagation. Wheel delta is clamped but its `deltaMode` is not normalized here.

The active panel resolver prefers the active workspace cell/tab, then remembered elements/names. Event lookup prefers `.panel` before `.nv-panel-tab-content`, making host identity significant. [workspaceActiveTracking.mjs](../ApplicationSystem/public/panels/workspaceParts/workspaceActiveTracking.mjs) activates cells on clicks; FileView additionally installs document/window focus and interaction bridges in [InstallIframeActivation.mjs](../ApplicationSystem/public/PanelInstances/ViewPanels/FileViewParts/InstallIframeActivation.mjs). Activation bridging is not the same thing as forwarding a zoom command across a document boundary.

The existing [zoomPanControlsWidget.mjs](../ApplicationSystem/public/ToolbarJSONfiles/zoomPanControlsWidget.mjs) routes zoom, reset and fit through capabilities but still sends arrow pan controls straight to the generic viewport. Several failed capability actions fall back directly to generic scaling, including local owners. [panelZoomModesWidget.mjs](../ApplicationSystem/public/ToolbarJSONfiles/panelZoomModesWidget.mjs) adds another selector and plus/minus pair. Its selected mode is widget-local: it does not change keyboard/wheel routing. Wheel modes currently use Alt for semantic, Shift for fisheye, and geometric otherwise; typing `+` receives a Shift exception.

Only ImageViewport, PNGeditor and SVG editor publication register production handlers in the inspected panel tree. None registers semantic or fisheye. Module selection remains the responsibility of [ModuleMap.csv](../ApplicationSystem/public/PanelInstances/ModuleMap.csv), not the zoom router. JPG uses PNGeditor; CSV/TSV share CSVeditor; HTML/SVG viewers and editors have distinct hosts and lifecycles.

## 2. Existing implementations and inconsistencies

| Family and evidence | Current behavior and implication |
| --- | --- |
| [GraphManagerCore](../ApplicationSystem/public/PanelInstances/InfoPanels/GraphManagerCore.mjs), `initializeGraph`, `bindGraphViewportSizing` | Cytoscape camera/fit coexist with generic ancestor scaling. Viewport events resize the canvas surface. No shared native camera adapter; two independent scales can exist. Graph state including `cy` and abstraction state is module-level, which limits independent instances. |
| Same module, `directoryScopeVisibleNodeIds`, `fileScopeVisibleNodeIds`, `applyGraphAbstractionFilter`, `rebuildVisibleEdges` | Existing directory-depth and link-distance filters, expanded directory compounds, and edges represented at visible ancestors are real semantic building blocks. Filtering restores/detaches runtime parents, hides nodes, selects the scope root, rebuilds edges and queues a relayout. This is not yet safe selection-preserving zoom. The older GraphCollapseRegion scripts must not become a second implementation. |
| [FileManagerCore](../ApplicationSystem/public/PanelInstances/InfoPanels/FileManagerCore.mjs), `fetchDirectoryContents`, `displayFiles` | Current-directory listing with directory images and file rows. Navigation loads directories; this is not an already implemented multi-resolution tree. Generic scaling only. Following file selection changes/reveals the listing through the existing selection system. |
| HTML editor [MountHtmlEditorShell](../ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditorComponents/HTMLeditorImplParts/MountHtmlEditorShell.mjs) | A scrollable contenteditable `wysiwyg` within an editor wrapper, with no dedicated zoom adapter found. Generic scaling may include editor controls. Keep a future transform outside authored DOM and outside source mutation/history tracking. [HtmlPresentation](../ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditorComponents/HtmlPresentation.mjs) provides explicit presentation provenance when runtime DOM decoration is unavoidable. |
| [ViewHTML](../ApplicationSystem/public/PanelInstances/ViewPanels/FileViewers/ViewHTML.mjs) | Same-origin iframe handlers call generic viewport tools directly, reset pan to zero, and check that an active panel exists rather than that it equals the owner. They reject Alt but not Shift wheel. Thus they bypass both the current mode resolver and its strict active-owner gate. Cross-origin access cannot be assumed. |
| SVG editor [PublishSvgEditorContext](../ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/SVGeditorComponents/SVGeditorRuntimeParts/PublishSvgEditorContext.mjs), [CreateSetSvgCanvasZoomHandler](../ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/SVGeditorComponents/SVGeditorRuntimeParts/CreateSetSvgCanvasZoomHandler.mjs) | Explicit geometric adapter controls session canvas scale, rulers and scroll. It maps a client anchor through `toSvgPoint` before resizing, then compensates scroll. Adapter fit and reset both currently request 1; it exposes no pan state. This is not a general fit-to-content operation. Existing object scale hotkeys reject Ctrl/Meta/Alt: source scaling is distinct from camera zoom. |
| [ViewSVG](../ApplicationSystem/public/PanelInstances/ViewPanels/FileViewers/ViewSVG.mjs) | Read-only SVG iframe with Layers inspection and a generic inline-fit hint. It does not register the editor's native viewport adapter. Viewer/editor parity must not be inferred from the shared file format; iframe activation alone does not deliver wheel events to the parent router. |
| [CSVGridView](../ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/CSVGridView.mjs), `paint` | Table plus two bounded range overlays, no native grid zoom adapter. Overlay bounds are read in client pixels and written as wrapper-local CSS pixels. Under ancestor scale 2, a 100-local-pixel cell measures 200 client pixels, which becomes a 200-local-pixel overlay rendered at 400 pixels. This is a code-derived coordinate defect; scaled-grid browser reproduction remains to be added. Zoom after an existing paint can look correct until a selection repaint. |
| [CodeEditor](../ApplicationSystem/public/PanelInstances/EditorPanels/CodeEditor.mjs), `zoomCodeEditorFont`, `installCodeEditorZoomHandlers` | Monaco font size changes, saved in editor sessions; chrome stays unchanged. Local scope and global hooks handle shortcuts, but the capability toolbar cannot discover this native support. Local listeners also run independently of the central gate and accept Shift wheel, so an unsupported central fisheye route can become local text zoom. |
| [ImageViewport](../ApplicationSystem/public/PanelInstances/ViewPanels/FileViewers/ImageViewport.mjs), [PNGeditor](../ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/PNGeditor.mjs) | Registered native geometric owners. Image 100% is one decoded pixel per CSS pixel, not per device pixel; fit and explicit scale differ. Viewer rotation/pan use an inverse transform for screen-relative arrows. Raster display zoom preserves canvas backing dimensions; authored bitmap rotation remains an edit. Viewer zoom currently stays centered rather than anchoring a pointer command. |
| [PDFOverlayEditor](../ApplicationSystem/public/PanelInstances/ViewPanels/FileViewers/PDF/PDFOverlayEditor.mjs) | PDF.js page scale with matching text/annotation layers, local +/- buttons from .35 to 3 in .1 steps. `rerenderPages` rerenders every page sequentially. No shared registration, so generic outer scaling can coexist with native scale. This is a custom workspace, not simply a browser PDF plugin. |
| [AudioWaveform](../ApplicationSystem/public/PanelInstances/Common/AudioWaveform.mjs), [SoundFamilyEditor](../ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/SoundFamilyEditor.mjs) | Native media controls plus decoded waveform reduced to per-pixel min/max bins. No time-window zoom adapter. Sample aggregation is rendering detail reduction, not yet a user semantic mode. Sound editor includes recording/replacement, not an assumed full multitrack timeline. |
| Game View [sceneBase](../ApplicationSystem/public/PanelInstances/ViewPanels/GameViewDependencies/sceneBase.mjs), [cameraModes](../ApplicationSystem/public/PanelInstances/ViewPanels/GameViewDependencies/cameraModes.mjs) | Perspective camera, first/second/third person, top-down, side and text modes. Follow cameras move with the player; camera mode changes are not a geometric factor. No shared zoom adapter or common semantic/LOD ladder found in the inspected engine/panel modules. Object-grab wheel handling is a competing interaction, not camera zoom. |
| [Layers](../ApplicationSystem/public/PanelInstances/Common/Layers/htmlLayersContext.mjs), [HTMLPropertiesPanel](../ApplicationSystem/public/PanelInstances/InfoPanels/HTMLPropertiesPanel.mjs), [SVGPropertiesPanel](../ApplicationSystem/public/PanelInstances/InfoPanels/SVGPropertiesPanel.mjs) | Structure inspection and selected-object forms. HTML Layers already has virtual list support; MetaWorld Layers reuses the shared shell. Expand/collapse and form grouping are useful controls, but need not be renamed zoom. Generic fallback is not evidence that content zoom is appropriate here. |

The main inconsistency is overlapping ownership, not missing universal math. Normalize owners before adding continuous effects. Native adapters must remove any stale generic wrapper transform when taking ownership; local refusal must never trigger outer CSS scaling.

## 3. Definitions and capability matrix

**Geometric:** change the visual metric of the same representation, using its native coordinate system. Source coordinates/data stay fixed. A ratio of 1 has family-specific meaning: image pixels per CSS pixel, SVG baseline display scale, graph camera scale, or text size relative to the editor default. Perspective dolly changes viewpoint/parallax and must be named separately from focal magnification.

**Semantic:** change displayed information/detail or aggregation while preserving canonical entities. Levels may be selected explicitly or follow geometric scale through discrete thresholds and hysteresis. Choosing semantic mode changes what zoom gestures control; it does not silently change source, hierarchy or selection. Ordinary font enlargement is geometric. A summary with fewer annotations is semantic even without clustering.

**Fisheye:** spatially nonuniform magnification around a focus while retaining surrounding context. A separate magnifier inset is a related inspection lens, not automatically a continuous fisheye. A fisheye needs a defined forward/inverse mapping and a policy for the context it compresses.

Legend: **Now** = existing native behavior, with routing qualification; **Later** = meaningful but not implemented through the shared contract; **N/M** = no meaningful content zoom for this interface; **No** = deliberately unsupported under this proposal. Generic CSS fallback alone is not “Now.”

| Panel family | Geometric | Semantic | Fisheye |
| --- | --- | --- | --- |
| Graph Manager | Now: Cytoscape, adapter missing | Later: existing abstraction groundwork | Later: inspection neighborhood |
| File Manager | Later: explicit row/thumbnail scale | Later: listing summary/detail | No: distorted navigation targets |
| HTML graphical editor | Later: content-only; generic today | Later: separate structural projection | No during editing; Later for inspection |
| HTML viewer | Now: generic iframe-shell bridge, incomplete ownership | Later: accessible same-origin structural view | Later: same-origin inspection only |
| SVG editor | Now: registered canvas scale | Later: layer/object detail projection | Later: inspection first; No editing until inverse hit tests |
| SVG viewer | Later: native adapter; generic shell today | Later: same layer/object projection | Later: inspection lens |
| CSV graphical editor | Later: native grid geometry; fallback defect today | Later: table/row summaries | Later: separable row/column focus |
| CodeEditor | Now: text only, legacy hooks | No: leave folding/outline explicit | No: caret/IME and line geometry |
| Image viewer / raster editor | Now: registered native scale | N/M for plain bitmap | Later: inspection; No brush edits initially |
| PDF viewer/editor | Now: native page scale, adapter missing | Later: page overview/detail | Later: read-only region focus |
| Audio controls | N/M for transport | N/M | N/M |
| Audio waveform / future timeline | Later: time axis, amplitude separately named | Later: waveform resolution tiers | No initially: temporal distortion is misleading |
| Virtual World/Game View | Later: explicit camera magnification, navigation exists | Later: separate world inspector; runtime LOD is distinct | No: gameplay/VR projection and ray casting |
| Layers panels | N/M: UI density is separate | Later only if depth summaries prove useful; explicit collapse today | No |
| Properties panels | N/M: accessible UI sizing instead | N/M: explicit groups instead | No |
| Generic InfoPanels | N/M by default; opt in per actual visualization | No by default | No by default |

“Later” is a feasibility judgment, not a commitment. User interface/accessibility scaling remains available for every row, including N/M and No.

## 4. Concrete semantic representations

Levels are family-local identifiers, never one universal integer with the same meaning everywhere.

| Family | Proposed progression, based on existing structures |
| --- | --- |
| Graph | `structure`: existing nodes/edges, edge annotations suppressed; `annotations`: existing edgeLabel/link details visible. Later, a distinct directory scope dimension can show root/top-level compounds → bounded directory depth → files and links. Existing link-distance filtering is another scope dimension, not interchangeable with directory depth. Do not claim project metadata beyond Notebook/directories. |
| HTML | Page/major-region overview → existing section/block hierarchy from the Layers provider → individual elements → selected-element controls. Arbitrary HTML may lack semantic sections: fall back to actual block/container structure, never invent document headings. Use a separate projection; ordinary DOM remains the editable source. |
| SVG | Layer silhouettes/bounds using existing authored layer groups → objects and labels → selected-object handles/detail. Never hide authored artwork in the persisted root to fake simplification. Masks, filters and blend groups constrain safe proxies. |
| CSV/TSV | Declared row/column counts and nonempty coverage → fixed row blocks/column summaries → ordinary cells → selected cell's full text. The current model is a table, not a workbook or formula engine. No invented sheet hierarchy, numeric type inference, or formula context. Summaries exclude virtual insertion cells. |
| File Manager | Current-directory counts and existing directory-image summaries → compact file rows → available row metadata/preview detail. Scope remains the current directory; crossing a threshold must not navigate folders or recursively fetch the Notebook. |
| PDF | Page thumbnails/index → pages with text → optional annotation details. Page numbers and annotation identity survive transitions. Do not assume a populated outline. |
| Audio waveform | Cached coarse min/max envelope → finer envelope → samples when sufficiently close. Labels must state time interval and amplitude units. This becomes semantic only when representation changes beyond ordinary resampling. |
| World inspector, optional later | Existing scene/layer groups → objects → selected-object properties. Keep outside gameplay camera modes; render LOD may reduce mesh cost without changing any user semantic selection. |
| Layers, optional later | Existing collapsed branches → expanded bounded depth → object metadata. Reuse the current provider and virtual list; do not build a second hierarchy. |

## 5. State, lifetime and source boundaries

| State | Owner and lifetime | Structural layout? |
| --- | --- | --- |
| Selected zoom mode | Panel tab; default geometric, validate on adapter change | Optional supported enum |
| Geometric scale / text size / fit policy | Live panel adapter, retained with its tab | Optional finite validated factor or `fit` policy |
| Scroll, graph center, image rotation, current PDF page | Document-bound view in the tab | No by default; optional separate local file-view memory |
| Semantic level | Panel tab, validated against family levels | Optional path-free named level |
| Semantic root, cluster expansions, focus IDs | Document-bound view | No; separate session/file view only |
| Fisheye focus, pointer, drag state, lens cache | Transient adapter state | No |
| Lens enabled preference / strength | Session first; later user preference | Off on restore initially |
| Authored SVG viewBox or world default camera | Source edit only through explicit content command | Not ordinary panel zoom |

Retained inactive tabs keep stable view state but suspend handlers, animation frames and lenses. Document replacement increments a generation, discards document anchors/caches, and revalidates mode; a user scale preference may carry forward but fit recalculates. Destruction unregisters and removes overlays/listeners. Undo/redo resolves selection against the new document generation rather than retaining dead DOM nodes.

Zoom must not enter HTML/SVG/CSV serialization, dirty state or document history. Existing HTML presentation provenance and SVG external chrome/source cleanup are boundaries to preserve, not licenses to insert lens geometry into source. A read-only viewer remains read-only when changing representations. Authored camera edits require a separate explicit command and history transaction.

## 6. Small contract recommendation

Keep the existing exports and per-host registration. Panel adapters retain all coordinate math, summaries and rendering. Add only what current toolbar inconsistencies and the first prototype need:

- Resolve one explicit owner from the active tab and event path; replace arbitrary descendant discovery for routing. Registration lifetime identifies the view generation. An explicit empty registration means no supported modes; never treat refusal as permission to scale its ancestor.
- Keep `geometric(command, state)`, `semantic(command, state)` and `fisheye(command, state)` optional. Require an explicit boolean result in new adapters. True means claimed, including an already-clamped supported action; false means unsupported. Do not return promises to a synchronous router: claim synchronously and schedule rendering with generation checks.
- Keep `getState(mode)` authoritative. Expose only that mode's observable state, e.g. `{zoom, fit}` or `{level: 'annotations'}`; scratch state must not become a second source of truth.
- Add optional per-mode metadata under the registration: supported `actions`, a display label/unit, and either finite numeric bounds/step or named semantic `levels`. This allows the current toolbar to disable Fit and display “Annotations” instead of an invented percentage. No renderer types or clustering functions enter the registry.
- Store the selected input mode per tab using a small accessor beside this registry. The selector and keyboard/wheel resolver read that same value. Changing the input mode retains other modes' state; Reset affects the selected mode. Fisheye has an explicit Off action.

Use existing command fields: `action`, `factor`, `zoom`, `clientX`, `clientY`; retain `panX/panY` only for owners advertising pan. Normalize current `in/out` aliases to `action: 'zoom'` plus factor. For the first semantic owner add only `level` for an absolute selection; factor direction steps one discrete level. Metadata declares `zoom`, `set`, and `reset`; no Fit or pan. Wheel accumulation lives at the gesture boundary so fine trackpad events do not advance a level each tick.

Client anchors are viewport CSS pixels, never authored coordinates; iframe bridges must translate to the owner's coordinate space. Numeric scale is family-local. Pan units must be declared screen CSS pixels and converted by the owner. Fit is not reset. Defer `fitSelection` until an actual owner implements it correctly; do not add a mandatory method for hypothetical use. Defer a shared fisheye parameter schema until its first renderer establishes the mapping.

The router decides ownership before dispatch; the handler does not search global selected-file state. Notifications should identify owner/mode and update controls once per frame, not trigger broad panel reconstruction. Preserve ModuleMap, toolbar context and normal panel lifecycle integration. No universal ZoomManager is needed.

## 7. Gestures and platform constraints

Proposed default: a single per-tab mode selector controls Ctrl+wheel, Ctrl+Plus and Ctrl+Minus on Linux/Windows; retain Command equivalents on macOS. Ctrl+0 resets the selected mode. Plus accepts the typed `+`, `=` and numeric keypad equivalents; Shift used to type a character never changes mode. Fit remains an explicit supported action. Unsupported choices are disabled with a reason. Do not silently substitute geometric behavior.

Retire the default Alt/Shift mode variants after migration; optional user mappings may override the selector but must pass the same ownership gate. This avoids the current Shift-wheel disagreement between CodeEditor/HTML and the central router. Ctrl+Alt is also unsuitable as a universal typing shortcut; keyboard layouts and desktop mappings vary. No Fn dependency: the standard notes that Fn is often handled in hardware and may not generate events. [W3C key values](https://www.w3.org/TR/uievents-key/).

These baseline keys already overlap browser zoom. Microsoft documents Ctrl+Plus/Minus for page zoom; GNOME documents separate Super+Alt magnifier controls. Do not appropriate those accessibility shortcuts. Electron provides native zoom menu roles, but this tree's `electron-main.js` explicitly calls `Menu.setApplicationMenu(null)` and has no inspected zoom accelerator mapping. A future menu must route a panel action once, rather than combining a native page-zoom role with renderer zoom. [Microsoft shortcuts](https://support.microsoft.com/en-us/edge/keyboard-shortcuts-in-microsoft-edge), [GNOME mappings](https://help.gnome.org/gnome-help/keyboard-shortcuts-set.html), [Electron MenuItem](https://www.electronjs.org/docs/latest/api/menu-item).

Provide a visible “Panel zoom shortcuts” preference to release these keys/wheel to browser accessibility zoom, plus application UI-size controls independent of document scale. Only cancel an eligible claimed command. Trackpad pinch may arrive as Ctrl-wheel; do not infer a physical Ctrl key from that signal. Keep browser pinch available when panel shortcuts are disabled. Normalize wheel delta units before accumulating; test mouse and trackpad separately. Platform docs establish conflicts, not a guarantee across all Linux desktop customizations.

## 8. Exactly one event owner

Proposed precedence and acceptance table:

| Situation | Owner / result |
| --- | --- |
| Modal overlay owns focus or pointer | Its explicit zoom owner if any; otherwise block dispatch to background panels, leave native behavior available |
| Wheel over active visible panel | Deepest eligible registered embedded view in the event path, otherwise that active tab's root owner |
| Wheel over another panel | No panel zoom; hovering does not activate or zoom the previously active panel |
| Keyboard in visible focused panel | Focus activation first reconciles the active tab, then dispatches once to its eligible owner |
| Keyboard in toolbar | Explicit action targets the remembered active tab; typing in unrelated fields does not zoom a background panel |
| Retained inactive/hidden tab | Never eligible even if connected or found by querySelector |
| Nested scroll container | Plain wheel scrolls normally; claimed Ctrl-wheel zooms once, never also scrolls/zooms an ancestor |
| Same-origin FileView iframe | One document bridge maps event/coordinates and calls the same gate; parent does not synthesize a second DOM event |
| Cross-origin iframe | No assumed interception; child/browser owns input. Outer toolbar may offer a documented shell action only if supported |
| Embedded editor/game interaction | Explicit local ownership; active drag, IME or object-grab operation can refuse panel zoom without ancestor fallback |

Use `composedPath` within a document and the existing iframe owner bridge across documents. Check visibility, tab activity and generation, not just `isConnected`. Honor `defaultPrevented` and mark a claimed event internally; migrate/remove legacy listeners rather than depending on listener installation order. A selected unsupported mode cannot fall through to a legacy geometric handler. Central capture cannot blindly claim before evaluating embedded ownership. Fisheye pointer tracking is passive state until its owner is eligible.

Required routing regression matrix: wheel/keys on active, inactive, hovered and focused hosts; modal overlay; nested local owner; CodeEditor; HTML and SVG iframes; iframe reload; retained tab switch; nested scrolling; toolbar focus; unsupported mode; adapter removal during queued render. Assert one adapter invocation, zero calls to other owners, and unchanged source/selection.

## 9. Selection through representation changes

Keep canonical selection in the existing family selection model. A visible representative is a projection, not a replacement selection. Graph node/edge IDs, HTML/SVG element identity within the document generation, CSV row/column coordinates, PDF page/annotation IDs and FileManager paths remain authoritative. Do not write generated persistent IDs merely to support zoom.

When a selected entity is summarized, highlight its nearest visible aggregate and label the number of selected hidden descendants. Preserve the original selection and reveal it again when detail returns. Selecting a summary explicitly is a separate user action with stated semantics; merely zooming cannot select its parent, navigate a folder, promote a viewer to editor, or create an undo entry. Disable content manipulation of ambiguous proxies; offer Reveal selection or return to detailed representation.

For DOM replacement, reuse the editor's identity/selection restoration mechanisms. If the selected entity was deleted by a real content edit, normal selection reconciliation applies. Do not revive removed nodes from a zoom cache. Keyboard focus can move to an accessible representative without changing authored selection; retain its logical anchor for restoration.

## 10. Fisheye requirements before implementation

All future lenses start disabled, support Escape/Off, and use CSS-pixel radius. Proposed initial bounds for evaluation, not measured defaults: radius 80–240 CSS pixels, magnification 1–3. Keyboard users can anchor to selection/caret where meaningful, move the anchor, and adjust radius without a pointer. Pointer-follow should freeze during selection/drag to avoid chasing a moving target.

| Family | Model and focus | Context and hit testing |
| --- | --- | --- |
| Graph | Explicit node/neighborhood anchor; monotonic radial screen-space mapping | Identity outside radius; smooth, positive-derivative compression in the surrounding annulus. Transform edges and node glyphs consistently. Invert lens then camera for hit tests; never feed displaced positions into layout/source. Cytoscape's ordinary hit tests will not automatically know a post-render warp. |
| SVG | Selection or explicit document point; read-only inspection first | Same invertible radial model, or a clearly labeled separate magnifier rather than claiming continuous fisheye. Lens outside source DOM. Invert lens then SVG screen CTM for picking; map handles, strokes, clips and marquee consistently. Affine CTM inversion alone is insufficient for nonlinear distortion. |
| CSV | Selected row/column intersection; piecewise monotonic row-height/column-width mapping | Enlarge focus bands and compress neighbors above a readable minimum; retain outside context. Shared prefix sums map visible boundaries and inverse lookup to canonical cells. Overlays, hit testing, virtual cells and scroll extent use the same mapping. Freeze for edit/drag; no merged or reordered source cells. |
| HTML/PDF/image inspection | Explicit region or keyboard selection anchor | Begin with non-editing magnifier semantics if native layout cannot support invertible distortion. Maintain reading order and original accessible text. Do not route editing to an undistorted underlying target. |

Require continuity, no foldovers, finite inverse, boundary clipping and deterministic tie-breaking at cell/shape borders. Hit-test round trips should agree within a proposed 0.5 CSS-pixel tolerance across scales and DPRs. If that cannot be guaranteed, the lens is inspection-only with editing disabled and a route back to the normal view. Fisheye output, clones and cached rasters are never saved as document content.

## 11. Accessibility

Panel scale and application/browser accessibility zoom are independent. Controls stay keyboard reachable at large fonts and high browser zoom; text size must not scale toolbar chrome into inaccessible overflow. Expose mode, level and reset with accessible names, announce discrete changes sparingly, and preserve visible focus. Do not announce every wheel tick.

A summarized visual view needs an accessible equivalent (expandable hierarchy or selected-item detail), not merely `display:none` on all hidden information. Avoid duplicate screen-reader exposure from cloned DOM. Users must be able to reach all content without operating a lens. Honor reduced motion with instantaneous level changes, and provide persistent lens-disable preference. Device pixel ratio only affects backing resolution: it must not change canonical coordinates, native CSS-pixel image scale, or CSV hit targets. Test screen magnifier coexistence rather than replacing system magnification with fisheye.

## 12. Performance and verification plan

Use discrete semantic transitions with hysteresis for any future automatic camera coupling. Cache summaries by document revision and scope; update invalidated rows/subtrees rather than rescanning on pointer motion. Batch view work in requestAnimationFrame and check lifecycle generations before committing asynchronous results. Emit toolbar updates at most once per frame and only for changed state. Construct detailed controls lazily and keep virtual lists bounded.

Graph abstraction currently rebuilds edges and queues layout; PDF rerenders all pages; CSV builds the declared/virtual table and measures overlays; SVG filters/clips can make proxy rasterization expensive. None should be repeated for each raw wheel event. Waveform decoding should be reused across resolution levels. A lens raster cache must include source revision, scale and device pixel ratio without retaining departed documents.

Proposed benchmarks: graphs at 1k/10k nodes with sparse and dense edges; CSV at the existing 36k-cell fixture and larger row counts; SVG with 1k/10k objects plus filters; PDF at 10/100 pages. Record input-to-visible-change p50/p95, frame time, allocations, layout calls, DOM scans, source mutations and retained memory over 100 switches. On a recorded reference machine target p95 under 16.7 ms for steady pointer mapping and under 100 ms for a discrete detail transition; these are acceptance targets, not measurements. If exceeded, reduce detail/cache or keep explicit steps. No continuous expensive mode ships without results.

Checks run for this report: `node --test ApplicationSystem/public/panels/panelZoomCapabilities.test.mjs ApplicationSystem/public/panels/savedLayoutModel.test.mjs ApplicationSystem/public/PanelInstances/ViewPanels/FileViewers/ImageViewportGeometry.test.mjs` — all three test files pass. They exercise independent mode/instance state, unsupported dispatch and unregistering, layout sanitization, and inverse image pan geometry. They do not prove iframe routing, CSV scaled overlays, graph semantic behavior or OS integration.

Existing browser fixtures in [workspace-improvements-browser.mjs](../scripts/workspace-improvements-browser.mjs), [svg-layers-browser.mjs](../scripts/svg-layers-browser.mjs), and CSV browser runners are useful starting points; they were not rerun for this documentation-only change. The workspace fixture uses mounting stubs and is not a full Electron acceptance run. Windows/Linux desktop key delivery, screen readers and full-game input remain manual integration checks.

## 13. Saved layouts

[savedLayoutModel.mjs](../ApplicationSystem/public/panels/savedLayoutModel.mjs) stores named structural layouts in browser localStorage with an allowlist. It permits a primitive `panelVars.zoom`, but does not query live adapter state or validate a zoom-specific schema. Thus current named layouts must not be described as restoring every current camera. [savedLayouts.mjs](../ApplicationSystem/public/panels/savedLayouts.mjs) serializes structure; [neutralLayoutPanel.mjs](../ApplicationSystem/public/panels/neutralLayoutPanel.mjs) keeps file-backed panels empty until an explicit open action.

Proposed policy: allow an optional versioned, bounded presentation preference containing supported mode, geometric factor **or** fit policy, and a family-known semantic level. Validate finite numeric bounds and known names at save/load; omit unsupported fields. Store text-size preference only if the CodeEditor adapter makes its unit explicit. Neutral panels hold preferences pending a future explicit document open; they must not load a file to apply zoom.

Do not save center coordinates, PDF page, selected cell, element/graph IDs, directory scopes, image rotation, pointer/lens anchors, active drag state or arbitrary adapter state. A graph center has meaning relative to a particular graph, so it is not “structural” merely because it is numeric. Separate opt-in local file-view memory may store such state with its document identity and validation, outside named layouts. Keep `layoutEmpty: true`, sanitize every tab, and never add file paths or inferred references to restore view state. Unknown modes revert to geometric if supported, otherwise no panel zoom.

## 14. Implementation order

1. Repair shared owner resolution, active/focus/iframe gating and single mode selection; make unsupported actions explicit and prevent toolbar fallback around native owners. Keep regression tests small and focused on dispatch, not screenshots alone.
2. Validate existing geometric boundaries: CSV scaled overlay regression and native grid geometry; CodeEditor adapter; SVG viewer bridge and truthful Fit; native graph/PDF adapters; content-only HTML scaling. These are separate family changes, not one universal transform rewrite.
3. Build the one semantic prototype below using only the minimal metadata/level addition. Preserve accessibility and selection, then measure.
4. Only after evidence from that prototype, evaluate directory aggregation with selection preservation and bounded caches. Defer fisheye until native coordinate ownership and inverse hit testing are demonstrated. Layout preference persistence follows stable adapter state schemas.

## 15. Exactly one recommended prototype

**Graph Manager: Structure / Annotations semantic detail.** Structure suppresses ordinary edge labels; Annotations shows the existing `edgeLabel` values. Keep node labels and warning/selected-edge details available so orientation and diagnostics are not lost. Do not change graph membership, compound parents, edge endpoints, camera, positions, or canonical selection. Existing link records/inspector remain the source for accessible selected-edge detail.

Use the existing capability registration on the actual graph view. Two named levels, explicit selector and stepped semantic gestures suffice; automatic geometric thresholds are out of scope for this first slice. Reset returns to Annotations, matching today's displayed information. A small view-style helper applies/reverts only its owned presentation override and preserves custom edge styles. Do not alter `data(edgeLabel)` or call `applyGraphAbstractionFilter`: that path currently changes selection and relayouts. Register/unregister with graph lifecycle; because the current core is singleton-oriented, limit initial acceptance to its actual mounted instance and do not claim arbitrary multi-instance support.

This is semantic zoom because the visible information changes while geometry stays fixed. It exercises mode choice, unsupported actions, per-owner state, discrete levels, selection stability, accessible detail and cleanup without filesystem risk, new clustering, document summaries, or nonlinear picking. CSV summaries would need data semantics; SVG fisheye would need new inverse mapping; HTML proxies would need broader contenteditable identity work. Existing graph annotations give the smallest defensible experiment.

Acceptance: both levels via selector and Ctrl gestures; reset; one owner per event; two retained host registrations isolated in routing tests; canonical selected edge/node and positions identical before/after 100 toggles; source data and Notebook writes unchanged; custom styles restored on cleanup; selected/broken-edge details accessible; no network fetch, edge rebuild or layout call on a level transition. Benchmark the 1k/10k graph fixtures with results reported, not assumed. If styling invalidates compound sizing or performance exceeds targets, stop and narrow the presentation override before expanding semantic scope.

## 16. Open limits

This report adds only this document. Identified implementation defects remain work items; the CSV scale mismatch is derived from coordinate math rather than a new browser reproduction. No production semantic/fisheye adapter was added, no new layout schema was installed, and no native OS shortcut certification was performed. The contract recommendations intentionally leave renderer-specific fisheye math and file-view memory outside the shared registry.
