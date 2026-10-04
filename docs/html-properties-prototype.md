# HTML Properties/CSS prototype

Implemented and verified 2026-09-29 on the existing working tree. **The bounded architecture works:** an existing HTML selection owner can edit an explicitly chosen inline declaration or matching local stylesheet declaration, preserve unrelated source, and save the correct file. This is a two-property prototype, not a general inspector or cascade debugger.

## Using the prototype

Open an HTML graphical editor, select an element by its caret or HTML Layers, then use **View → HTML Properties**. The toolbar opens a standard overlay; `HTMLPropertiesPanel` also supports workspace tabs. Choose `color` or `margin-left`, explicitly choose **Inline style** or a writable listed rule, enter a CSS value, and use Preview, Apply, Cancel and Save destination. The shared hex-color control is available for color; the text field retains expressions and units.

The surface shows document/element identity, the effective value, inline authored value, and matching source candidates with selector, occurrence order, declaration value/priority and conditional ancestry. It does not claim that the first matching rule is the cascade winner. Controls retain their document owner when focused. Switching documents cancels an outstanding preview before rebinding. Closing an overlay also cancels its preview.

**Undo constraint:** after a changed inline Properties operation, native undo/redo is paused for that HTML document until it is saved and reopened. Keyboard, `beforeinput` history actions and the existing HTML toolbar fallback are fenced. Properties Undo/Redo can reverse that one operation only while the owning revision remains unchanged; subsequent typing makes it refuse a stale snapshot. This intentionally trades native undo availability for protection against the demonstrated text-loss bug. CSS-only edits use the stylesheet's programmatic history and do not pause native HTML undo. The original mixed-history diagnostic still reports `chronologicalUndoCoherent: false`; it has not been hidden or repaired by a second history stack.

## Reused ownership and implementation boundaries

| Existing system inspected | Prototype use |
| --- | --- |
| HTML context, `HtmlEditorSelection`, HTML Layers selection bridge | The same element/caret owner; a registry announces existing contexts, without owning a second selection |
| `HtmlEditorTransactions`, `WysiwygProgrammaticHistory` | Inline body transactions and the same model adapter for a shared CSS text buffer; begin/preview/commit/cancel and revision checks |
| `HtmlSourceDocument`, `HtmlSourceProvenance`, detached serializer | Discover actual authored head/body stylesheet nodes and reverse runtime-only media substitutions on save |
| `HexColorControl`, appearance controls | Reuse the hex control without forcing declaration/source semantics into the broader appearance model |
| Directory CSS patch utilities and CSS viewer | Prior art only; their specialized scanners do not become a general CSS parser |
| Notebook URL utilities, CodeEditor session metadata, LiveFileContent | Resolve exact-case local paths, detect conflicting buffers, publish committed CSS content with its own dirty state |
| Standard InfoPanel/tab/overlay infrastructure | Owner-bound controller with activation/disposal; a small factory adapter supports the existing overlay initializer contract |

Code lives in [Common/HtmlProperties](../ApplicationSystem/public/PanelInstances/Common/HtmlProperties/), with [HTMLPropertiesPanel](../ApplicationSystem/public/PanelInstances/InfoPanels/HTMLPropertiesPanel.mjs) and the [toolbar entry](../ApplicationSystem/public/ToolbarJSONfiles/htmlPropertiesButton.mjs). HTMLeditorImpl receives only context activation/disposal, source-discovery and undo-fence hooks. No dependency or saved document format was added.

The CSS index is a bounded lexer/range index. Rules have source-relative identities; the operation pins both the source text and revision. It changes only the selected declaration's value range. Selectors, other declarations, order, comments, whitespace, duplicate fallbacks, `var()`, `calc()`, units, shorthands and priority spelling outside that range stay byte-identical. Inline edits also patch the original attribute text instead of asking CSSOM to reprint it. Browser CSS parsing validates the proposed value. Repeated selectors are separate destinations, including occurrences in different files.

For safe preview in the existing shared application document, supported page styles are projected through private native `@scope` roots. Original source nodes are retained and disabled only through tracked presentation attributes; scope markers and projection styles do not enter the saved page. Editors sharing a CSS buffer intentionally update together. Unrelated `.card` documents use separate roots. Native scope confines rule matching, but is not a replacement for an isolated page viewport. [CSS scoping specification](https://drafts.csswg.org/css-cascade-6/#scoped-styles)

## Refusals and limits

- External, managed, missing, redirected and query/fragment stylesheet references are read-only. Only same-origin Notebook `.css` sources are writable candidates. The server remains authoritative for write permission; a rejected save leaves the buffer dirty.
- `<style>` blocks are displayed but not edited. Media/supports/layer ancestry is displayed; declarations inside those groups and media-qualified links are read-only.
- Exactly one existing declaration of the chosen property must occur in a writable rule. Missing longhands, duplicate target declarations, nested/escaped selectors, malformed boundaries and comments/escapes within the edited value are refused. There is no new rule/class/stylesheet creation and no implicit inline or `!important` fallback.
- Safe projection is deliberately narrower than CSS: imports, unrecognized at-rules, resource URLs, document-root selectors (`html`, `body`, `:root`, `:scope`), disabled/alternate stylesheets or an unavailable native scope implementation make stylesheet editing read-only for that document. Ordinary inline editing remains available. This avoids presenting a lossy projection as an accurate page preview.
- Computed values describe the editing surface. General application/page CSS isolation, independent media-query viewports, pseudo-elements and definitive cascade-winner attribution remain outside this prototype.
- Inline Apply dirties HTML; rule Apply dirties the CSS buffer without modifying HTML. Save destination and Ctrl/Cmd+S **inside Properties** use that explicit destination. Ordinary save shortcuts elsewhere still follow the active editor's existing behavior.
- Dirty CodeEditor sessions, other live buffers, and even clean retained CodeEditor sessions for that CSS path block writes. Closing the conflicting source editor permits a fresh check. Disk text is compared before beginning, applying and saving. This client-side preflight is **not atomic compare-and-swap**: a writer racing the final server request remains an unresolved server revision-contract problem.
- Dirty CSS buffers remain in memory when their last HTML owner closes and can be recovered by reopening a referencing page. Clean unused buffers are released. There is no new application-exit persistence or multi-file save transaction. Save CSS explicitly before closing the application.
- Shared graphical HTML editors preview unsaved CSS together; neighboring iframe FileView does not yet consume this CSS buffer as a live stylesheet. It can require a reload after CSS save. This prototype does not claim general live CSS preview across every viewer.
- Discovery caches local sources/indexes and tracks the owning document revision. Head/style edits performed outside that revision contract are not automatically synchronized; reload after such source changes. No continuous stylesheet polling or pointer-move scanning was added.

## Verification

Eight focused Node test files pass: CSS index/inline patching, HTML transactions, save safety, HTML Layers helpers, FileView live-refresh gating, panel-content lifecycle, tab lifecycle and tab-context regression. The new CSS suite covers exact patch boundaries, priorities, expressions, duplicates, grouping ancestry, mismatched delimiters and stale identities. Syntax checks pass for 17 new/touched modules and harness scripts; `git diff --check` passes.

Both Electron modes pass:

```sh
env -u ELECTRON_RUN_AS_NODE xvfb-run -a node_modules/electron/dist/electron \
  --no-sandbox scripts/html-foundation.electron.cjs --properties

env -u ELECTRON_RUN_AS_NODE xvfb-run -a node_modules/electron/dist/electron \
  --no-sandbox scripts/html-foundation.electron.cjs
```

[Properties evidence](html-properties-electron-results.json) covers separate editor ownership, controls retaining focus, preview cancellation on document switch, exact inline/CSS cancellation, one-operation Apply, no-op, explicit save destinations, CSS save shortcut request count, dirty-CodeEditor refusal, disk changes before begin/apply, shared stylesheet behavior, inherited color, normal/important/inline/later-rule precedence, repeated selectors, read-only cases, and native undo containment. The CodeEditor conflict case uses its inspected retained-session contract with a synthetic host; it does not mount Monaco itself. HTTP reads/writes use synthetic in-memory fixtures, not Notebook files or the production save backend.

The harness now exercises the **actual Properties toolbar widget, overlay wrapper, panel factory and resizer**, including three close/Escape cycles with pending previews. Eight independent Properties mounts/disposals keep listener/observer counts stable. After all owners close, there are zero live providers, observing MutationObservers, pending timers or intervals; eleven global application/harness listeners remain. A separate source test cancels a preview after its final owner releases it and verifies collection. The [foundation rerun](html-foundation-electron-results.json) retains source/provenance, save ownership, neighboring FileView and mixed-history diagnostics.

### Measured costs

Latest local Electron 42.2.0 / Chromium 148.0.7778.97 run, Linux Xvfb, acceleration disabled, 1200×950 window. Two retained HTML editors have a section and two paragraphs each; basic sheets have one or two rules, and the ambiguity fixture has four rules. These are **small-fixture operation timings**, not frame-latency budgets or a large-document benchmark. The production toolbar remains a counted stub; workspace layout plumbing is partly stubbed. Native focus/cascade/undo, editor modules, Layers, FileView and panel tabs run in Electron.

| Operation | Measured ms |
| --- | ---: |
| Open Properties, mount through initial discovery | 34.1 |
| Selection change and refresh | 6.8 |
| Effective value read | 0.2 |
| Cached discovery plus computed read, 12 samples | median 0.05; range 0–0.7 |
| Inline preview / Apply / Cancel | 5.7 / 3.1 / 12.6 |
| Rule preview / Apply / Cancel | 0.7 / 19.3 / 0.3 |

Apply includes asynchronous disk preflight for CSS; the fixture transport is mocked. Inline cancellation includes snapshot restoration/rehydration. These paths should not be described as equivalent work. Cached selection samples perform no additional source loads. Properties has no pointer-move handler and requests no Layers or toolbar rebuilds. It does read computed style on refresh and performs the foundation's body snapshot/serialization work at inline transaction boundaries; those costs still scale with document size.

## Standards and next boundary

All new application modules are below 200 nonblank/noncomment lines and carry path/purpose headers. The surface inherits shared styles and native controls; it introduces no fixed product colors, fonts or panel dimensions. A small shared removal observer and resizer cleanup callback repair resources leaked by the real factory path. Existing oversized HTMLeditorImpl and panelFactory remain legacy exceptions; this task does not claim whole-tree standards compliance. Pre-existing CSV/SVG, source-foundation and LayoutStyles changes were retained.

The result validates owner-bound selection → explicit source identity → bounded source patch → transaction → owned save for the supported subset. Further Tier 1 work should first decide isolated page rendering, source-buffer reconciliation/server revisions and chronological history. No additional property catalog, layout controls, breakpoints, variables catalog, components or Layers restructuring is part of this change.
