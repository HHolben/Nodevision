<!-- Nodevision/ApplicationSystem/docs/nodevision-sessions.md -->
<!-- This file documents Nodevision Sessions, their storage model, constrained JavaScript-like runtime, command boundary, editor, and migration relationship to older interactive template ideas. -->

# Nodevision Sessions

Sessions are Nodevision-native automation artifacts with the exact file extension:

```text
.NodevisionSession
```

They are application configuration and programming files for Nodevision itself. They are not ordinary Notebook content and should not be stored under `Notebook/`.

## Storage

Bundled Sessions live in:

```text
ApplicationSystem/Sessions/BuiltIn/
```

User-owned Sessions live in:

```text
UserData/Sessions/
```

Built-in Sessions are read-only examples shipped with Nodevision. If a user wants to modify one, Nodevision duplicates it into `UserData/Sessions/` first.

The built-in HTML drafting Session is stored as `HTMLdraftFocus.NodevisionSession.js`. Nodevision accepts this script-suffixed Session filename for JavaScript-shaped Session source while still preserving `.NodevisionSession` as the normal user-created extension.

## Runtime Model

Session files use readable JavaScript-like syntax, but they are not executed by `eval`, Node.js, or unrestricted browser JavaScript. The runtime parses and interprets a constrained subset:

```javascript
let message = "Hello";
run("overlay.show", message);
wait("session.continue");

let response = wait("overlay.submitted");
if (response.value === "continue") {
  run("panel.open", "FileManager", "InfoPanel");
}
```

Currently supported statements are:

- `let`, `const`, and `var` declarations.
- `=`, `+=`, and `-=` assignment.
- Arithmetic, comparison, equality, boolean, string, number, boolean, and null expressions.
- Safe property reads from Session-owned values, such as `response.value` and `response.input.length`.
- `if (...) { ... } else { ... }`.
- `while (...) { ... }` with a loop limit.
- `run("command.id", ...)` as a standalone statement or assigned value.
- `wait("event.name")` as a standalone statement or assigned value.
- `pause()`.
- `quit()`.

Functions, imports, arbitrary object/prototype access, `require`, `process`, `fs`, shell execution, network APIs, and dynamic evaluation are intentionally not exposed.

## Shared Commands

Shared Nodevision command metadata lives in:

```text
ApplicationSystem/public/Commands/
```

The central dispatcher is:

```text
ApplicationSystem/public/Commands/NodevisionCommandDispatcher.mjs
```

The registry exposes command metadata with fields such as:

```javascript
{
  id: "viewer.open",
  label: "Open Viewer",
  description: "Open a Notebook file with the registered FileView viewer dispatch.",
  sessionSafe: true,
  arguments: [{ name: "path", type: "notebookPath", required: true }],
  returns: "status",
  events: ["viewer.opened"]
}
```

Only commands explicitly marked `sessionSafe: true` can run from Sessions. The Session adapter rejects unknown commands, non-Session-safe commands, and invalid arguments before invoking handlers. Underlying Nodevision features still keep their own validation.

Current Session-safe command families include:

- Overlay: `overlay.open`, `overlay.show`, `overlay.close`, `overlay.clear`, `overlay.setContent`, `overlay.getInput`.
- Panels: `panel.open`, `panel.close`, `panel.focus`.
- Viewer: `viewer.open`, `viewer.currentFile`, `viewer.close`.
- Editor: `editor.open`, `editor.save`, `editor.currentFile`, `editor.getContent`, `editor.setContent`.
- Files: `file.read`, `file.save`, `file.create`, using existing Notebook APIs.
- Speech: `speech.speak`, `speech.stop`, `speech.pause`, `speech.resume`, `speech.setRate`, using browser-native speech synthesis.
- System: `console.open`, `session.emit`, `session.quit`, `htmlDraftFocus.open`, `sectionals.update`.

Console-only snippets remain available in the Nodevision Console glossary, but they are not Session-safe merely because the console can run them. Shared commands also appear in the console glossary as snippets that call the shared dispatcher.

## Command Results

`run()` returns the command handler result. Query-style commands can be assigned directly:

```javascript
let viewed = run("viewer.currentFile");
run("overlay.show", "Current viewer path: " + viewed.path);
```

Commands may be synchronous or asynchronous. The interpreter awaits them internally; Session authors do not use `async`, `await`, or Promises.

## Events And Waits

Sessions wait through `SessionEventBridge`, which registers one-shot listeners and removes them when the event arrives. `wait()` returns the sanitized event payload:

```javascript
run("overlay.open", "Continue?");
let response = wait("overlay.submitted");
if (response.value === "continue") {
  run("overlay.show", "Continuing.");
}
```

Known application events include overlay, panel, viewer, editor, speech, and Session lifecycle events. Custom Session-local events are allowed under the `session.*` namespace. Unknown application events are rejected so Sessions do not accumulate silent waits on misspelled or unavailable events.

Listeners created by `wait()` are cleaned up when the event arrives, when a Session quits, when a Session restarts, or when runtime cleanup runs after an error. Quit cancels outstanding waits with `SESSION_WAIT_CANCELLED` and restores the normal workspace. The `session.quit` command uses the same controller cleanup path as Escape-menu Quit when it is invoked by the active runtime.

## Errors

Session-facing command failures are shown without exposing raw stack traces as the only message. The error overlay includes the safe message plus available Session id, source line, command id, and command error code such as `UNKNOWN_COMMAND`, `COMMAND_NOT_SESSION_SAFE`, `INVALID_ARGUMENT`, `COMMAND_EXECUTION_FAILED`, or `UNKNOWN_EVENT`.

## Speech/TTS Readiness

No pre-existing Nodevision-specific TTS engine was found. The shared speech commands wrap the browser-native Web Speech API when available. They expose real `speech.started`, `speech.paused`, `speech.resumed`, `speech.finished`, and `speech.cancelled` events. `speech.boundary` is emitted only when the browser provides a native boundary callback with character indices; Nodevision does not fake word timing.

## UI Ownership

When a Session starts, `SessionUiOwnership` adds a reversible Session mode to the index page. The normal `#app-shell` is hidden and pointer-disabled, a Session root layer is shown, and Escape opens a pause menu.

The pause menu currently supports:

- Resume.
- Restart Session.
- Quit.

Quit aborts the runtime, removes outstanding event waits, clears temporary state, stops Session-owned speech where the browser API permits it, removes Session overlays, and restores the normal interface.

## HTML Draft Focus Session

`HTMLdraftFocus.NodevisionSession.js` launches the Session-safe command `htmlDraftFocus.open`. The command prompts for a drafting goal, then opens a locked HTML drafting surface inside Session mode.

During this Session:

- Backspace, Delete, clipboard actions, undo/redo, select-all shortcuts, arrow keys, Home, End, PageUp, and PageDown are blocked.
- Typing while a previous passage is selected or while the caret is away from the end moves input back to the end of the draft.
- Highlight-first bold and strikethrough are allowed through the focus controls.
- Words added are tracked inside the focus Session instead of the normal status bar.
- When the goal is completed or the user finishes, the draft is appended to the active HTML editor through the existing `getEditorHTML` and `setEditorHTML` bridge when that bridge is available.
- The most recent draft result is also kept in `window.NodevisionHTMLDraftFocusLastDraft` for recovery during the browser session.


## Session Editor

The first Session editor lives at:

```text
ApplicationSystem/public/PanelInstances/EditorPanels/SessionEditor.mjs
```

It provides:

- A procedural flow preview generated from source.
- Source editing for user Sessions.
- Read-only viewing for built-in Sessions.
- Built-in duplication into `UserData/Sessions/`.
- A command palette populated from the shared command registry, showing only Session-safe commands and their argument names.

Full graphical/source round-tripping is not complete yet. The current editor is the foundation for that workflow and keeps `.NodevisionSession` source as the durable representation.

## Templates

No active `.NodevisionTemplate` file-type workflow was found during this implementation. The existing template system under `UserData/UserTemplates/` remains intact for ordinary non-interactive templates.

Sessions replace the older idea of interactive HTML-guided procedures. Existing ordinary template creation and insertion behavior is retained.

## Future Notebook Export

Sessions are designed so a future command can compile compatible Sessions into ordinary Notebook folders, for example:

```text
UserData/Sessions/MyGame.NodevisionSession
```

to:

```text
Notebook/MyGame/
├── index.html
├── script.js
├── style.css
└── assets/
```

That future export must produce independently deployable web content. The Session file itself remains outside the Notebook.

## Tests

Relevant tests added in this task:

```text
ApplicationSystem/Sessions/SessionRegistry.test.mjs
ApplicationSystem/public/Sessions/SessionRuntime.test.mjs
ApplicationSystem/public/Sessions/SessionCommandAdapter.test.mjs
ApplicationSystem/public/Sessions/SessionEventBridge.test.mjs
ApplicationSystem/public/Sessions/SessionUiOwnership.browser-test.mjs
ApplicationSystem/public/Commands/NodevisionCommandRegistry.test.mjs
```

