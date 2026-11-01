# Scholarly references, Phase 1: architectural audit and integration plan

## Audit before implementation

The graphical HTML editor projects source into an editable body, preserving its shell and inert nodes through `HtmlSourceDocument.mjs` and source provenance. `HtmlBodySerialization.mjs` cleans only known editor presentation. `PublishHtmlEditorContext.mjs` supplies owned selection, transactions, saving, and panel activation; `CreateSetEditorHtmlForPathHandler.mjs` handles source replacement and disposal.

Toolbar JSON specifies category/parent headings and callback keys. `callbackLoader.mjs` dynamically loads `ToolbarCallbacks/<category>/<key>.mjs`. The Insert menu has an ungrouped Footnote entry, but no modern callback module. The legacy `insertCallbacks.js` implementation prompts for HTML text, targets `#editor` instead of the owned WYSIWYG root, deletes a selection, and later renumbers positional IDs with a timer using screen coordinates. Reuse its ordinary HTML hyperlinks and ordered-list concept, not its mutation algorithm.

`HtmlEditorSelection.mjs` retains selection/bookmarks through toolbar focus. `HtmlEditorTransactions.mjs` groups synchronous commands and reports changes. `HtmlDomHistory.mjs` owns native-input and programmatic mutation patches; its current public after-transaction notifications occur too late to include derived numbering in the same entry. A small synchronous before-commit subscription is the appropriate integration point. It will receive actual patches and capture reconciliation changes in the originating entry. Replaying those patches should restore numbering without another reconciliation or undo entry.

Existing toolbar and information panels use `createPanelDOM` and editor-owned contexts. Phase 1 does not need a new rich-text panel: the note definitions in the existing editable body already support paragraphs, formatting, links, and structured HTML. Diagnostics can use the status bar; explicit validation also reports unresolved content. Selection and activation belong to the current editor, not global caret overrides.

Tests include Node regression files, browser module tests under `scripts/`, and Chromium/Electron runners. Browser coverage is required for ranges, native input, history, and navigation. Earlier calligraphy changes are present in the worktree and will be preserved.

## Planned architecture

- Generic reference metadata distinguishes annotation type, definition identity, and anchor identity. Only footnotes are implemented.
- A document-local reconciler recognizes managed and conventional/legacy footnotes, repairs IDs and links, stores visible numbers in HTML, and orders definitions by first reference.
- Notes are ordinary rich HTML in an end-of-body section with an ordered list. Note IDs never depend on display numbers. Every anchor has its own ID and every definition has return links to all its anchors.
- Normal deletion of the last reference preserves the unreferenced definition with an explicit recoverable-content notice. An explicit Delete Footnote command deletes the last anchor's definition. Missing definitions receive an explanatory placeholder and a diagnostic. Ambiguous duplicate definitions are preserved and reported.
- Same-document pasted references share a definition but receive unique anchor IDs. Clipboard HTML carries referenced definitions and a document-session token; foreign imports remap identities before insertion. Plain-text clipboard remains ordinary selected text. Cut/move preserves note identity.
- Reconcile on load/source replacement and relevant history commits. Ignore ordinary text edits without reference structure changes. Save validates a detached clone, avoiding live save-time mutations and runtime dependencies.
- Standalone rendering and link navigation use native HTML and saved visible numbers, without scripts or application styles.

## Implemented document contract

A reference is a native hyperlink, normally inside `sup`:

```html
<sup><a id="fnref-<uuid>" href="#fn-<uuid>"
  role="doc-noteref" data-nv-reference="footnote"
  data-nv-note-id="note-<uuid>" aria-label="Footnote 1"
  contenteditable="false">1</a></sup>
```

Its definition is a rich-content `li` in `section[data-nv-notes="footnote"] > ol`. It has its own HTML target ID, the same stable note identity, `data-nv-note-kind="footnote"`, `role="doc-footnote"`, `value="1"`, and a descriptive label. The native ordered list supplies basic presentation. Each `li`'s saved `value` and each anchor's literal number encode the numbering in HTML, without CSS counters or JavaScript. A final `span[data-nv-note-returns]` contains a labeled `role="doc-backlink"` hyperlink for every referencing anchor. Number labels and return links are noneditable chrome; note contents remain part of the original rich-text editor.

No application CSS, script, database, or companion file is needed to read or navigate this representation. The section follows main content, and note definitions follow the order of their first reference. Multiple anchors share one number and one definition. Existing IDs remain unchanged unless absent, invalid, or conflicting.

## Lifecycle and commands

- **Insert → References → Footnote** uses the owning HTML editor's current or remembered range, collapses to the end of a selection, inserts without deleting selected text, creates the definition, and places the caret in its content.
- **Edit → Footnotes** provides Edit Footnote, Return to Reference, Delete Footnote, and Validate Footnotes. Clicking a reference or activating a return link accesses the counterpart inside the editor. Standalone browsers use ordinary fragment navigation.
- Rich-text editing uses the existing body contenteditable surface, formatting commands, selection, and journal. There is no second editor or note database.
- The history journal has a small synchronous `subscribeBeforeCommit` extension. Reference changes are identified from actual mutation patches; derived numbering, ordering, backlinks, and recovery changes join that commit. Undo/redo restores those patches directly and does not invoke reconciliation again.
- Normal character typing and unrelated styles do not scan the document. Structural changes containing references/definitions, relevant identifier/link changes, load, source replacement, explicit validation, and save-clone validation are controlled reconciliation points. Save does not mutate the live DOM.
- Cleanup removes all navigation/clipboard listeners and the history subscription. Reference reconciliation does not publish toolbar state or rebuild menus.

## Deletion, imports, and clipboard policy

Explicit deletion removes the chosen anchor and removes its definition only when no other anchor uses it. Deleting from inside a shared note asks the user to select the specific anchor instead of deleting all its uses. Normal text deletion that removes the last reference retains meaningful content in a labeled “Unreferenced footnotes (retained)” collection and reports the inconsistency. It is reversible with the originating edit. Removing a definition while references remain creates a visible missing-content placeholder and reports it. Entering replacement content clears that diagnostic.

Legacy `#footnotes-list` / `#footnote-*` structures and conventional `li[role="doc-footnote"]` definitions are adapted without flattening rich contents. Duplicate definition identities are separated while preserving explicit target associations where available; ambiguity is reported rather than resolved by discarding content. Unrelated authored content is retained when consolidating collections.

Clipboard HTML carries referenced definitions in an ordinary footnote section and an ephemeral editor-instance origin token. Same-instance copies share a definition and receive new anchor IDs; cut/paste moves preserve note identity. Foreign clipboard payloads remap note identities and HTML targets. Imported missing definitions remain visible placeholders. Private editor provenance and presentation are removed from exported clipboard HTML. Plain-text clipboard contains the original selected text. Clipboard behavior outside selections involving footnotes is left to the existing editor.

Limitations are explicit: an external application can strip the origin token or definitions. Without provenance, a bare anchor with an existing matching note identity is treated consistently as an additional local reference; its actual external origin cannot be inferred. Unknown targets are repaired with reported placeholders. Cross-editor-instance copies are treated as imports, including another tab showing the same file. Cut and paste remain two ordinary editing actions. References inside footnote definitions are not supported in Phase 1; insertion and special reference paste reject that location. Arbitrary third-party note conventions outside the recognized selectors may require manual adaptation.

## Validation and results

The real Chromium regression mounts the production HTML editor and exercises toolbar callback routing, invalid/empty selections, insertion at a selection's end, immediate text entry, multiple rich paragraphs, first/middle deletion, shared references, native clipboard copy/cut/paste events with browser insertion, foreign collisions, legacy migration, missing metadata, malformed identities, native editing after actual close/reopen, atomic undo/redo, save hooks, and cleanup. A separate standalone document frame explicitly disables scripts, checks that a probe script cannot execute, and verifies native forward and return links.

`node scripts/run-footnotes-browser.mjs` passed **54 browser checks** on the final implementation. The large fixture contains 60,000 words and 300 notes. Thirty actual text edits caused zero reconciliation scans; a measured run took 31.8 ms with the controller and 31.8 ms with it disabled. These are local timing samples, not cross-machine performance guarantees; the test also asserts text actually changed and uses a generous control-run tolerance.

`node scripts/run-footnotes-browser.mjs html-source-browser.mjs` passed the existing source-preservation, active-save, selection, transaction, and retained-editor browser suite. `node scripts/run-calligraphy-browser.mjs` passed its 26 checks, protecting the earlier worktree feature.

The expanded `HtmlDomHistory.test.mjs` verifies that derived changes enter one journal record, undo/redo does not rerun reconcilers, and unsubscribe works. The broader command is:

```sh
node --loader ./scripts/html-test-loader.mjs --test ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditorComponents/*.test.mjs
```

Seven of eight test files passed. The unchanged `HtmlAttentionReporting.test.mjs` fails because its mock panel lacks `setAttribute`, which the existing `CursorFamilies/PanelActiveTool.mjs` requires. A first run without the repository's loader also could not resolve browser-root imports; the command above resolves those imports. This task does not modify that unrelated mock or tool registry.

Screen-reader output and Firefox have not been manually tested. Browser selection, native fragment navigation with scripting blocked, and Chromium rendering are covered. Physical page-bottom placement, pagination/PDF behavior, citation styles, bibliographies, and remote services remain outside Phase 1.

## Changed files

New implementation modules under `ApplicationSystem/public/References/`:

- `ReferenceModel.mjs`: generic identity/metadata contract and native HTML constructors.
- `ReconcileFootnotes.mjs`: numbering, navigation, import repair, and recoverable inconsistencies.
- `ReferenceChanges.mjs`: patch relevance and selection preservation.
- `FootnoteCommands.mjs`: insertion, deletion, editing, and navigation.
- `FootnoteClipboard.mjs`: shared local anchors and collision-safe imported definitions.
- `HtmlFootnotes.mjs`: owned controller, history subscription, diagnostics, and disposal.
- `ActiveFootnoteCommand.mjs`: active-document toolbar routing.

New toolbar callbacks: `ToolbarCallbacks/insert/insertFootnote.mjs` and `ToolbarCallbacks/edit/{editFootnote,deleteFootnote,returnFromFootnote,validateFootnotes}.mjs`.

Updated integration: `ToolbarJSONfiles/{insertToolbar,editToolbar}.json`; legacy `ToolbarCallbacks/insertCallbacks.js`; `HTMLeditorComponents/{HtmlDomHistory.mjs,HtmlDomHistory.test.mjs,HtmlBodySerialization.mjs}`; and `HTMLeditorImplParts/{InitializeHtmlEditorTools,CreateSetEditorHtmlForPathHandler,MountHtmlEditorShell}.mjs`.

Tests and documentation: `scripts/footnotes-browser.mjs`, `scripts/run-footnotes-browser.mjs`, and `docs/footnote-architecture.md`. Existing calligraphy worktree changes were retained.

## Extension points

`data-nv-reference` and `data-nv-note-kind` distinguish future annotation types, while note identity and anchor identity remain separate from presentation. The reconciliation and journal subscription interfaces can support another annotation reconciler without another document format or history stack. Number assignment and collection placement are isolated from insertion and rich note content. Future work can introduce section numbering policies, alternate presentations, and additional import adapters while retaining existing identities and hyperlinks. No later-phase reference type is implemented here.
