<!-- Nodevision/docs/html-viewer-zoom.md -->
<!-- This report documents independent geometric and semantic HTML viewer zoom, reuse of read-only Layers presentation, source and lifecycle invariants, and browser validation. -->

# HTML Viewer: independent geometric and semantic zoom

Implemented 2026-10-06 on top of the existing [app-wide rollout](panel-zoom-rollout.md). The requested architecture, Graph prototype and directory-scope reports were reviewed first. This tree already contained centralized input routing and native geometric adapters, so this follow-up adds the missing HTML Viewer semantic representation without repeating that rollout or continuing Graph aggregation.

## Behavior

| Mode | Meaning | Input | Reset |
| --- | --- | --- | --- |
| Geometric | Scale the iframe/page presentation, preserving document source and application chrome | Ctrl + wheel or Plus/Minus | Ctrl+0 restores scale 1 |
| Semantic | Outline ↔ Page; Page is the more detailed/default level | Ctrl+Fn where exposed, or centralized Ctrl+Alt fallback + wheel or Plus/Minus | Semantic modifier + 0 restores Page |
| Fisheye | Reserved, unsupported | Ctrl+Shift remains reserved | No behavior |

The existing toolbar exposes both modes and named Outline/Page choices. Its mode selector controls the toolbar buttons; it does not override physical modifier intent. Resetting either mode leaves the other unchanged. Unsupported actions and boundary steps cannot become geometric commands.

Outline is the existing HTML Layers list of recognizable regions/elements, with the same naming and virtualization, presented read-only outside the iframe. It is not a new DOM renderer, inferred summary, or editing mode. Selecting an entry explicitly returns to Page and scrolls that element into view. “Show page” returns without selecting an element. Documents without recognized HTML layers show the existing empty-list message; plain unlabelled paragraphs are not inferred as regions.

## Ownership and source safety

`HtmlViewerZoom.mjs` registers one owner on the viewer container, which stays available when the iframe is hidden. It composes the existing presentation-scale adapter with panel-specific semantic state and metadata. The shared registry, modifier parser, active-panel gate, toolbar and iframe bridge are unchanged. Other content-presentation callers still default to unsupported semantic zoom.

Semantic transitions hide/show only the outer iframe element and the application-owned outline. They retain the original document, text selection and page scroll, never reload or clone the page, and do not publish a canonical selection action. Geometric state is retained while Outline is open and applies to the page when it returns. Outline UI itself is not magnified by the page scale.

The HTML Layers context gains an optional read-only mode: visibility controls are disabled and their mutation handler refuses changes; editable script details are omitted; form interactions are not intercepted; editor selection APIs are not invoked. Editor callers retain their existing default behavior. The collection helper also uses node type rather than parent-window `instanceof Element`, fixing discovery of iframe elements. Both the viewer's separate Layers context and its semantic outline use this shared implementation.

Focus moves into Outline only when the now-hidden iframe had focus, and returns to the iframe when a focused outline is hidden. Toolbar focus is retained. The outline has a named section, ordinary keyboard-accessible buttons, and the existing virtualized list. No full assistive-technology certification is claimed.

## Lifecycle and limitations

File replacement/reload removes the old capability, outline, observer and iframe event bridge and starts the new document at Page/scale 1. Destroy removes both modes; cleanup clears the global viewer Layers context only if that context is still owned by this viewer. Retained inactive/hidden tabs cannot receive routed input. Two viewer instances have independent geometric and semantic state; the existing application-global file/Layers selection mechanism is not redesigned.

Same-origin documents are required. Cross-origin iframe navigation clears the previous registration before attempting access; inaccessible pages do not gain these capabilities. This follow-up does not extend interception into nested cross-origin documents. Physical Fn availability remains subject to the existing rollout's documented limitation; no new hardware-detection claim is made. No saved-layout fields, source serialization changes, editing history operations, geometric thresholds, or fisheye rendering were added.

## Validation

`python3 scripts/test-panel-zoom-browser.py` passes with the added production-viewer suite in `scripts/html-viewer-zoom-browser.mjs`. It covers:

- Separate geometric/semantic toolbar, wheel and keyboard commands, including the same-origin bridge and single invocation.
- Independent reset, unsupported fisheye, invalid level refusal, and semantic boundary no-op.
- 100 semantic transitions on a 2,000-region document, retaining browser text selection; initial return retains page scroll.
- Zero authored-DOM mutations, unchanged source snapshot and Nodevision state, zero navigation during zoom, and the suite's zero-save/write counters.
- Read-only visibility controls, unblocked form interactions, repeated explicit reveal, focus handling, and virtualized rows.
- Inactive/hidden refusal, document replacement, old bridge cleanup, destroy, and independent simultaneous viewer instances.
- Existing native Graph, CSV, SVG, image/raster, CodeEditor and PDF fallback zoom regressions.

Four focused Node test files also pass: `panelZoomCapabilities`, `panelZoomInput`, `htmlLayersContext`, and `HtmlLayerInvalidation`. Syntax and whitespace checks pass.

Command timings on the existing headless Chromium fixture, with 2,000 HTML regions:

| Operation | Median | p95 |
| --- | ---: | ---: |
| First Outline creation (single sample) | 43.7 ms | Not sampled |
| Semantic transition (100 samples) | 1.8 ms | 3.4 ms |
| Page geometric scale (20 samples) | 0.1 ms | 0.1 ms |

These are synchronous command timings, not compositor/paint completion or whole-application responsiveness guarantees. The first outline builds the shared index and virtual rows; later level changes reuse it. Content mutations use the existing Layers invalidation mechanism. No whole-document scan was added to geometric wheel handling.

## Changed files and standards

Application changes are `HtmlViewerZoom.mjs`, `ViewHTML.mjs`, `contentPresentationZoom.mjs`, and the existing HTML Layers parts `CreateHtmlLayersContext.mjs`, `CreateRenderLayerWrapperHandler.mjs`, and `ElementFromNode.mjs`. Testing adds `html-viewer-zoom-browser.mjs` and integrates it into `panel-zoom-browser.mjs`. The rollout matrix and this report document the actual support.

All six changed/new native application modules have path/purpose headers and fewer than 200 nonblank, noncomment lines: respectively 60, 90, 19, 174, 70 and 130. Unrelated working-tree changes were preserved; this is not a conformity claim about the entire repository.
