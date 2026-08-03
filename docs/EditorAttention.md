# Editor Attention State

Nodevision keeps a small shared editor-attention state so the existing toolbar can decide which commands are relevant to the current editor, tool, and selection. The system does not render an editor attention strip or add a secondary task bar.

## State Model

`ApplicationSystem/public/EditorAttentionState.mjs` tracks compact editor context such as file path, file family, editor mode, active tool, selected object type/id, and routine busy operation metadata.

Editors may report only the fields they support. The store publishes snapshots through `subscribe()`, mirrors the current snapshot into `window.NodevisionState.editorAttention`, and dispatches `nv-editor-attention-changed` in the browser.

## Editor Integration

Editors call:

- `setEditorContext({ filePath, fileFamily, editorMode, editorModeLabel })` when a file is opened or the editor mode changes.
- `setActiveTool(toolId, label)` when a drawing, selection, or editing tool changes.
- `setSelectionContext({ selectedObjectType, selectedObjectId, selectedObjectLabel, hasEditableSelection })` when selection changes.
- `saveEditingContext(filePath, compactState)` before teardown or after cursor/scroll changes.
- `clearEditorContext(filePath)` during editor cleanup.

HTML, SVG, and code editors are reference integrations. KML, SCAD, MetaWorld, Arduino graphical editing, and future editors can adopt the same calls incrementally.

## Toolbar Conditions

Toolbar JSON can declare contextual rules without editor-specific DOM manipulation:

```json
{
  "label": "Poetry Controls",
  "visibleWhen": {
    "editorMode": "HTMLediting",
    "selectedObjectTypes": ["poem", "poem-line", "poem-stanza"]
  }
}
```

`panels/toolbarConditions.mjs` evaluates `visibleWhen`, `enabledWhen`, `disabledWhen`, file family, editor mode, active tool, selected object type, and editable selection. Hidden commands are irrelevant to the current context. Disabled commands are relevant but temporarily unavailable and should provide `disabledReason` when ambiguity is likely.

## Per-file State

Compact editing context is stored under `localStorage` key `nodevision.editorAttention.fileState.v1`, keyed by normalized Notebook-relative path. Stored values include supported cursor position, scroll position, active editor mode, active tool, and collapsed editor-specific panels. The system stores only small serializable state and never document contents or DOM snapshots.

Malformed persisted state is ignored. Restore is best-effort by editor family.

## Known Limitations

The reference integrations currently restore the code editor cursor/scroll, HTML scroll, and SVG scroll/tool state. KML, SCAD, MetaWorld, and other editors should add richer selection and panel-state reporting as follow-up work.
