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

Session files use readable JavaScript-like syntax, but they are not executed by `eval`, Node.js, or unrestricted browser JavaScript. The first runtime parses and interprets a constrained subset:

```javascript
let message = "Hello";
run("overlay.show", message);
wait("session.continue");

let count = 0;
while (count < 2) {
  count += 1;
}

if (count === 2) {
  run("overlay.show", "Done");
}
```

Currently supported statements are:

- `let`, `const`, and `var` declarations.
- `=`, `+=`, and `-=` assignment.
- Arithmetic, comparison, equality, boolean, string, number, boolean, and null expressions.
- `if (...) { ... } else { ... }`.
- `while (...) { ... }` with a loop limit.
- `run("command.id", ...)`.
- `wait("event.name")`.
- `pause()`.
- `quit()`.

Functions, imports, arbitrary object access, `require`, `process`, `fs`, shell execution, network APIs, and dynamic evaluation are intentionally not exposed.

## Commands

Sessions automate Nodevision through a small command adapter in:

```text
ApplicationSystem/public/Sessions/SessionCommandAdapter.mjs
```

The Session editor also reads the existing Nodevision Console command glossary, but console snippet commands are marked as not Session-safe and are not executable by Sessions.

Initial Session-safe commands are:

- `overlay.show(message)`: shows a Session message through the existing Nodevision overlay/panel system.
- `panel.open(panelId, panelClass)`: asks the existing panel system to open a panel.
- `viewer.open(filePath)`: selects a Notebook file and asks the existing file viewer to render it.
- `console.open()`: opens the existing Nodevision Console.
- `session.emit(eventName, detail)`: emits a local Session event.
- `session.quit()`: stops the active Session.

New capabilities should be exposed as shared Nodevision commands before Sessions call them. Sessions should not duplicate editors, viewers, file operations, speech, graph actions, or overlay rendering.

## UI Ownership

When a Session starts, `SessionUiOwnership` adds a reversible Session mode to the index page. The normal `#app-shell` is hidden and pointer-disabled, a Session root layer is shown, and Escape opens a pause menu.

The pause menu currently supports:

- Resume.
- Restart Session.
- Quit.

Quit aborts the runtime, removes outstanding event waits, clears temporary state, removes Session overlays, and restores the normal interface.

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
- A command palette populated from shared command metadata.

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
ApplicationSystem/public/Sessions/SessionUiOwnership.browser-test.mjs
```

