# Focus Session — Bridging

Open **Sessions → Focus Session — Bridging**. The bundled `Bridging.NodevisionSession.js` wrapper runs the Session-safe `bridging.open` command, waits for `session.bridging.finished`, and quits after the summary is acknowledged. HTML Draft and its append-only editing rules are unchanged.

Bridging preselects the active graphical HTML document when available. Choose another Notebook HTML file, or use **New HTML document**, which invokes Nodevision's existing New Document dialog and creation API. Set an additional-word target, a countdown (preset or custom minutes/seconds), or both. At least one condition is required. An enabled word target must be a positive integer; blank or zero targets keep configuration open. Uncheck **Word target** for a timer-only session. Disabled goal fields are excluded from form validation. The configuration shows the current count and projected required count.

The live HTML graphical editor is moved into the Session when it already owns the chosen file. Otherwise the same production `renderEditor` mounts an editor for that document. This preserves source serialization, metadata handling, native editing, and the editor-owned DOM undo journal. No second editing engine or Session undo stack is used.

## Editing and restrictions

Text navigation, selection, replacement, deletion, paragraph insertion, scrolling, and plain-text clipboard operations remain available, including editing headings, lists, and table text. Ctrl+S saves through the owned HTML editor context. Ctrl+Z/Ctrl+Y and Ctrl+Shift+Z use its existing history. Existing history survives entering and leaving the Session.

The Session UI owner hides the workspace; other page surfaces become inert while writing. A temporary Session action-availability listener gates shared command dispatch and loaded toolbar callbacks. The dispatcher routes `editor.save` directly to the Session's editor. Window-level capture filters prevent toolbar navigation events, editor object tools, rich paste, drop, context menus, formatting commands, and unrelated shortcuts, while allowing native text defaults. Programmatic browser formatting commands are fenced for the duration of writing. Proven editor controls are hidden using the editor's private provenance selector; authored document elements are not removed. Regular toolbar refresh work is suppressed while this policy is active. These are application interaction restrictions, not a security sandbox against arbitrary developer-console scripts.

Escape does not pause or terminate Bridging. Use **End Session**. In the save-failure state the writing remains visible and locked for a consistent retry; **Retry save** retries the existing document. An ordinary Ctrl+S failure leaves writing enabled and can be retried with Ctrl+S.

## Counting and completion

The baseline is captured once when **Begin writing** is pressed. Counting uses the existing whitespace-token semantics on rendered body text, excluding hidden content, scripts, styles and proven editor controls. Visible heading, paragraph, list, and table text counts. Net growth is `current − initial`; required total is `initial + requested growth`; remaining words is `max(0, required − current)`. Net growth can be negative and saving never resets the baseline.

Input, history notifications and localized DOM mutations invalidate a cached count. Updates are batched at 160 ms. Independent top-level block counts are cached and only changed blocks are recounted; mixed inline layouts fall back to rendered body text to preserve word boundaries. No HTML serialization, reparse, or node replacement is used for progress updates. CSS visibility changes inside the body invalidate the cache; changes to external stylesheets after startup are not separately observed.

Elapsed time uses `performance.now()`. A 250 ms callback checks elapsed time, not tick counts. Background timer throttling can delay the completion callback, but elapsed-time calculation remains correct. The first enabled condition ends writing. Completion is single-flight and idempotent. Composition defers completion until the IME commits. Pending native history is flushed, open transactions are checked, and the existing `context.save()` serializer and `/api/save` infrastructure perform the write. If a Ctrl+S write is already pending, completion waits and writes the final revision afterward.

The summary includes duration, initial/final counts, net change, requested growth, and end reason. Failed saves do not produce a success summary or discard the editor. Retry retains the original completion statistics. Acknowledging the successful summary restores the workspace, command availability and input behavior. Borrowed editors return to their original containers without replacing their DOM or undo history.

Unexpected lifecycle cleanup returns borrowed editors to their owners. A newly mounted dirty editor is retained in a recovery surface with **Save and close**, rather than disposed. Dirty documents install a browser `beforeunload` prompt. Abrupt process crashes or forced closure cannot guarantee recovery of unsaved writing; no graphical-HTML crash-recovery store or periodic autosave implementation was found to integrate with. Existing save hooks remain available.

## Files

- `public/Sessions/BridgingSession.mjs`: orchestration, loading, completion and cleanup.
- `BridgingEditor.mjs`: reuse/mount the graphical editor, save and recovery ownership.
- `BridgingView.mjs`: configuration, compact status and summary.
- `BridgingInteractions.mjs`: text-only interaction and clipboard restrictions.
- `BridgingProgress.mjs`: pure net-growth metrics and completion state machine.
- `BridgingWordCount.mjs`: cached rendered-word counting.
- `SessionActionAvailability.mjs`: temporary, event-based application command availability.
- `Sessions/BuiltIn/Bridging.NodevisionSession.js`, command definitions/registry/SystemCommands: registration.
- `SessionUiOwnership.mjs`: optional Escape suppression, used only by Bridging.
- `NodevisionCommandDispatcher.mjs`, `callbackLoader.mjs`, `panels/createToolbar.mjs`: Session-aware command and toolbar gates, inactive otherwise.
- `TemplateSystem/NewDocumentController.mjs`: returns the existing creation result to callers.
- `HtmlSourceProvenance.mjs`: exposes the private editor-control removal selector for Session presentation.

Paths beginning with `public/` are under `ApplicationSystem/`; the Session modules listed without a prefix are under `ApplicationSystem/public/Sessions/`.

## Validation

```sh
node --test ApplicationSystem/public/Sessions/BridgingProgress.test.mjs ApplicationSystem/Sessions/SessionRegistry.test.mjs ApplicationSystem/public/Commands/NodevisionCommandRegistry.test.mjs ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditorComponents/HtmlDomHistory.test.mjs ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditorComponents/HtmlEditorTransactions.test.mjs
python3 scripts/test-html-table-resize-browser.py bridging
python3 scripts/test-html-table-resize-browser.py html-table-navigation
```

The pure tests cover baseline/net growth, deletion, rejection of zero targets, timer expiration, simultaneous triggers, composition deferral, failed saves, and retry statistics. The Chromium suite uses the production editor, history, serializer and save handler with a simulated Notebook transport. It checks native arrow keys, replacement, mouse caret placement, undo/redo, Ctrl+S, text-only clipboard behavior, command restrictions, composition deferral, failure recovery, source preservation/reopening, document selection/creation, cleanup and a 100,000-word document. The ordinary table suite exercises non-Session navigation and table tools to detect regressions. Browser tests simulate composition events; OS-specific IME behavior still merits manual verification.

Implementation validation passed: 43 Bridging Chromium checks, five Node test files, 36 ordinary native table-navigation cases plus existing drag/style/history checks, and the nine-module header/line-limit audit. In the 100,000-word fixture, initial counting took approximately 70 ms and a localized paragraph recount approximately 2 ms on this machine. These timings are observations, not performance guarantees for every document layout.
