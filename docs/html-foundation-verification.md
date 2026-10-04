# HTML foundation verification checkpoint

Verified 2026-09-29 against HEAD `729280e` plus the existing working tree. No Properties/CSS-rule UI, dependency manifest, Notebook content, or broader Tier 1 feature was added. Pre-existing CSV/SVG latency work and LayoutStyles.css changes remain separate. [Raw Electron evidence](html-foundation-electron-results.json) and [working-tree standards audit](html-foundation-standards-audit.md) accompany this report.

## Status and readiness

**Yes, the tested foundation supports a bounded Properties/CSS-source-targeting prototype using the owning editor context, without another broad HTML-editor refactor.** Ordinary source round trips, programmatic transactions, save ownership, resource restoration, and a visible neighboring preview pass. General authoring must resolve the native/programmatic undo mismatch before presenting these operations as one reliable history. The prototype must retain that explicit constraint, validate CSS revisions, and keep multi-file writes outside this body-only transaction contract.

Complete and tested: source shell/script preservation, detached serialization, explicit presentation/resource provenance, body transactions, selection ownership, retained tabs/panel moves, save dispatch, neighboring preview, and lifecycle checks below. Partially covered: special widget normalization, long-session provenance memory, full production toolbar cost, multiple concurrent FileView instances, and native IME. Blocked: unified chronological native/programmatic undo. No reset-based history workaround was introduced.

## Confirmed fixed

- Authored `.nv-editor-only`, `.nv-poem-controls`, Listen wrappers, helper-like attributes and selection classes could be deleted or altered by cleanup. Serialization now reverses recorded runtime writes; matching a name alone does not authorize deletion. New author-inserted marker-like content also survives. Listen and cartoon cleanup remove only owned runtime wrappers/handles. Table clipboard cleanup uses the same provenance.
- An inactive retained editor lost its live provider. Each HTML host now retains its own provider until disposal and publishes only input/transaction changes. Linux case-distinct paths remain distinct in provider lookup and live-refresh gating.
- Visible FileView refresh required the viewer to own workspace focus. The refresh gate now also accepts the retained visible viewer and rejects hidden/disconnected tabs.
- Native Ctrl+S reached both root and document handlers. The original listener produced **two** requests in Electron; the corrected handler produced **one**, containing A's source and A's path. Root dispatch uses its own context; the global handler respects `defaultPrevented`.
- Nested failures could leave partial work; a serialization failure during commit could escape rollback. Failure now rolls back, including a nested exception caught by its caller.
- Closing a moved editor left a panel context reference; closing an inactive editor could clear another editor's table selection. Ownership checks and regression coverage now cover both cases.

## Source-preservation guarantees

The browser suite compares complete parsed document trees before and after no-op serialization, a text/attribute edit, and the actual save request. Covered: doctype/public/system IDs; html/head/body attributes; IDs/classes; comments; text-node whitespace; style contents and CSS comments; stylesheet links and attributes; templates and their inert descendants; script text, original positions, `src`, `type`, `defer`, `async`, nonce and custom attributes; surrounding nodes and parsed head/body order; relative resource paths with query/fragment/case.

This is **parsed HTML semantic fidelity**, not byte-identical source. Browser parsing can normalize tag/attribute case, quoting, entity spelling, doctype presentation, newlines and malformed markup. Omitted/implied HTML structure is reconstructed. PHP/XML declarations are rejected before changing the editor. Source scripts/base/meta are retained behind private anchors. Event handlers, javascript links and iframe script permissions are suppressed in detached staging before mount and restored on save; authored scripts do not run in the tested editing fixtures. The viewer retains its separate normal page behavior.

Saving cleans a detached clone: browser MutationObserver records remain zero, live `innerHTML` is unchanged, caret/range endpoints stay put, and repeated output is identical. Serialization does not rehydrate the live editor. Current image-text and equation serializers still interpret their explicit widget contracts; poetry, cartoons, circuits and layout widgets have legacy hydration/normalization. These specialized widgets are not certified as arbitrary-source no-op projections by the ordinary fixtures.

### Provenance and portable resources

`HtmlSourceProvenance` records explicit runtime substitutions. `HtmlPresentation` routes selection classes, table/cartoon/equation state, circuit canvas dimensions and editor contenteditable writes through the owning root. Known generated resize/rotation/tool chrome is privately marked for removal; Listen wrappers are privately marked for unwrapping. Private origin/chrome attributes never reach saved output. Authored styles, layout geometry/rotation, link metadata, IDs and unknown `data-*` attributes are retained; there is no blanket stripping of Nodevision-looking names.

A resolved attribute is restored only when its current value still equals that recorded runtime value. An explicit later source edit wins. Private identities are versioned so an undo snapshot finds its own substitution record. Tests cover image/audio/video/poster/iframe substitutions, Notebook display URLs, object URLs, repeated save, source edit after save, undo/redo, relative suffixes, and two editors with distinct case-sensitive resources. Images are the active editor's automatic URL-resolution path; the other media tests exercise the shared substitution contract. Untouched authored media URLs are never generically rewritten. Object URLs remain available to retained history and are revoked on source replacement/disposal; abandoned asynchronous image hydration releases its unused object URL.

## Editor ownership and transactions

Each context owns its source document, provenance, serializer/save closure, dirty state, revision, selection/bookmarks, transaction state and history adapter. Actual GraphicalEditor hosts, panelTabs, HTML Layers and FileView are used in Electron. A/B save independently; inactive A remains readable to its viewer; bookmarks reject foreign roots; toolbar focus retains selection; tab switches and panel moves restore ownership; Layers uses the same selection owner. Selection alone creates no dirty revision. Disposal clears providers, subscriptions and matching panel/global references.

Compatibility adapters still exist: `__nvActiveHtmlEditorContext`, `HTMLWysiwygTools`, `HTMLLayersContext`, `getEditorHTML`, `setEditorHTML`, `saveWYSIWYGFile`, `__nvTableEditorRoot`, file-path hooks and NodevisionState. Activation rebinds them from the retained owning context; teardown clears only references still owned by that context. Specialized legacy object tools have additional globals and need their own integration cases when extended. NodevisionSelection retains its Notebook file/directory role.

The synchronous body contract supports begin, repeated preview, commit, cancel, expected-revision validation and nested `run` joining. One compound operation creates one history entry/revision; twenty gesture previews emit no authored-change notifications before one commit. Cancel restores source and bookmark without dirty/history changes. No authored change, including a recorded presentation-only change, stays silent. Failed nested edits restore the pre-transaction state and create no entry. Native input invalidates a stale pending transaction rather than letting cancellation overwrite newer input. Saving an unsettled preview is rejected. Async mutation callbacks are unsupported. Head/external CSS, concurrent code buffers and multi-file atomicity are outside this contract.

## Known undo blocker

Chromium owns native text edits. Nodevision owns programmatic body snapshots and their bookmarks. The existing fallback asks native undo first and only uses its own snapshot stack when native undo makes no change. Snapshot equality does not establish chronological ordering. The final native Electron sequence was:

| Step | Editor A text | Red style | Caret offset |
| --- | --- | --- | ---: |
| initial | `A` | no | 1 |
| type one | `Aone` | no | 4 |
| style red | `Aone` | yes | 4 |
| type two | `Aonetwo` | yes | 7 |
| undo 1 | `Aone` | yes | 4 |
| undo 2 | `Aon` | yes | 3 |
| undo 3 | `A` | yes | 1 |
| undo 4 | `Aone` | no | 4 |
| redo 1 | `A` | yes | 1 |
| redo 6 | `A` | yes | 1 |

Native character grouping varied between runs, but every run showed the ordering defect: typing disappears while red remains; a later fallback undo reintroduces older text; redo fails to reconstruct the original mixed sequence. **This can discard unsaved text during undo/redo, not merely surprise users about ordering.** Programmatic-only undo/redo/cancel passes, including bookmark restoration. The diagnostic records `chronologicalUndoCoherent: false`; its overall PASS means the experiment ran, not that mixed history passed. Any future style, class, layout, insertion or CSS gesture interleaved with typing is affected. Containment for the next prototype is a tested programmatic-only operation path and an explicit mixed-history limitation; this task does not make general mixed editing safe. No OS IME session was simulated.

## Live preview and lifecycle

Native typing updates A's visible neighboring preview once per debounced typing burst. A real preview click followed by editor focus and more native typing still updates it; editor focus and caret are retained. Editing B leaves A's preview unchanged. Hiding the preview prevents refresh; showing it displays the latest A buffer. A subsequent idle observation produces no additional frame. One style commit, undo or redo each produces one live notification and one iframe replacement; cancel/selection/caret produce none in the measured case. Three low-level DOM refresh mutations correspond to one iframe replacement, not three refreshes.

Twenty retained-tab activations kept window/document listener registrations and observing MutationObservers constant. Ten open → move panel → close → reopen cycles, including a FileView, each settled at 11 global listener registrations, zero observing MutationObservers, zero pending timeouts, zero intervals and zero live providers. The pre-mount baseline had four listeners; seven installed-once shared module/harness listeners remain, with no monotonic increase. Disposed editor compatibility globals were asserted clear. These are registration/activity counts, not a heap or all-element-listener audit. Provenance versions intentionally live until reload/disposal to serve snapshots; long-session retention still needs a bounded-history pruning design.

## Performance evidence

Electron 42.2.0 / Chromium 148.0.7778.97 on Linux/Xvfb, 1200×950 window, hardware acceleration disabled. Two retained HTML editors, Layers and a neighboring FileView were mounted. Test diagnostics were enabled (global listener/observer/timer counts and trusted beforeinput-to-rAF probes). There was no diagnostics-off comparison. Toolbar rendering, panelFactory, workspace loading and overlay integration use harness adapters; **toolbar numbers are invocation counts, not measured production rebuild durations**.

The baseline loads the two serializer modules from `729280e`, sharing current ancillary helpers. Each shape has one warm-up and 12 measured runs per serializer, alternating execution order. Current measurements call the active editor's `getHTML`; baseline measures detached clone plus assembly. Disk/network save time is excluded. p95 uses nearest rank and equals the maximum with only 12 samples. Results establish this local save baseline, not a general interaction-speed improvement.

| Shape | Approx. source bytes | Prior median / p95 ms | Current median / p95 ms |
| --- | ---: | ---: | ---: |
| 100 paragraphs, p + em each | 3,641 | 1.30 / 1.90 | 1.20 / 2.30 |
| 1,000 paragraphs, p + em each | 36,041 | 8.50 / 12.70 | 9.35 / 16.70 |
| 5,000 paragraphs, p + em each | 180,041 | 36.30 / 61.00 | 32.25 / 35.40 |
| 1,000 paragraphs, 4 elements and 4 attribute-bearing nodes each | 115,041 | 13.65 / 34.20 | 14.55 / 19.40 |

Initial provenance tracking on every plain node regressed save cost; limiting identities to attribute-bearing nodes and explicit runtime writes removed that overhead in the plain fixture. Attribute-heavy fragments still pay bookkeeping costs; inspect the table rather than treating all shapes as equivalent. Large serialization remains synchronous and can exceed a frame. No full-document serialization was added to caret or pointer-move handlers; body snapshots/clean comparisons occur at transaction boundaries and saves.

| Action (one small-document sample) | Synchronous ms | Second rAF ms | Toolbar calls | Layers mutation batches | Iframe replacements |
| --- | ---: | ---: | ---: | ---: | ---: |
| caret | 0.70 | 11.40 | 0 | 0 | 0 |
| element selection | 0.20 | 16.50 | 0 | 0 | 0 |
| style transaction | 0.90 | 16.10 | 2 | 1 | 1 |
| transaction rollback | 3.20 | 16.20 | 5 | 2 | 0 |
| programmatic undo | 2.70 | 16.10 | 7 | 2 | 1 |
| programmatic redo | 3.20 | 16.80 | 7 | 2 | 1 |

First rAF, 28 trusted native text-input events: median 2.70 ms, p95 12.00 ms, max 13.30 ms. Second rAF, 28 trusted native text-input events: median 18.35 ms, p95 30.80 ms, max 35.20 ms. These are event-to-rAF proxies, not OS input-to-compositor paint. Caret/selection timings are browser API actions; native typing and preview clicks use Electron input events. Interaction samples are a current baseline, not statistically powered before/after results. Full production toolbar/subscriber fanout, large-document native typing, real IME and multiple visible FileViews remain separate experiments.

## Validation and next constraints

Passed: complete browser source/resource/collision/transaction suite inside Electron; native preview focus/visibility/ownership/request-count assertions; 20 switches and 10 lifecycle cycles; ten Node regression files covering transactions, save safety, Layers, graphical live mutation filtering, FileView gating, panel lifecycle/moves, image-map geometry/serialization and Listen text chunks; dirty JavaScript syntax and whitespace checks. An initial plain-Node panel test invocation lacked browser-root import resolution; both passed with the existing loader. Native mixed undo is a recorded failing capability, not a passing assertion.

Representative commands:

```sh
env -u ELECTRON_RUN_AS_NODE xvfb-run -a node_modules/electron/dist/electron --no-sandbox scripts/html-foundation.electron.cjs
python3 scripts/test-svg-layers-browser.py --html-source
node --test ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditorComponents/HtmlEditorTransactions.test.mjs ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditorComponents/HtmlSaveSafety.test.mjs ApplicationSystem/public/PanelInstances/Common/Layers/htmlLayersContext.test.mjs ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditorLiveMutation.test.mjs ApplicationSystem/public/PanelInstances/ViewPanels/FileViewLiveRefresh.test.mjs
node --experimental-loader ./ApplicationSystem/public/panels/panelRootImportTestLoader.mjs --test ApplicationSystem/public/panels/panelTabsLifecycle.test.mjs ApplicationSystem/public/panels/panelTabsMove.test.mjs ApplicationSystem/public/PanelInstances/Common/ImageMap/ImageMapGeometry.test.mjs ApplicationSystem/public/PanelInstances/Common/ImageMap/ImageMapSerialization.test.mjs ApplicationSystem/public/Listen/ListenTextChunks.test.mjs
```

Next work can target CSS source discovery/revision checks and one owner-pinned, programmatic Properties operation. It must preserve comments/order/priority and detect dirty source-buffer conflicts. It must not assume body transactions cover head/external CSS, infer byte-level fidelity, apply full-document snapshots per gesture frame, or claim unified native history. Existing page/application CSS isolation, specialized widget projection, multi-FileView singleton state and long-lived provenance retention constrain scope. The [standards audit](html-foundation-standards-audit.md) documents remaining oversized legacy files; new foundation responsibilities stay in focused modules.
