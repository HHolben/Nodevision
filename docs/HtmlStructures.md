# HTML structure insertion

In the graphical HTML editor, choose **Insert → Structure** to open its subtoolbar.

- **Sensitive Elements** wraps selected content in a highlighted field. With no selection, it inserts editable placeholder text. The content remains visible on screen but is hidden by the document's saved print stylesheet when printing.
- **Collapsible** wraps selected content in a native HTML `details` container with an editable `summary` heading. It starts expanded for editing. Click the heading to collapse or expand it. With no selection, it inserts editable placeholder content.

Both commands retain selected formatting, use the active editor's remembered selection after toolbar focus, and create an undoable insertion. The markup works in saved HTML without Nodevision scripts.

Validation: `env -u ELECTRON_RUN_AS_NODE node_modules/.bin/electron scripts/structure.electron.cjs --no-sandbox` exercises the real HTML editor, undo/redo, serialization/reopening, native expansion, and Chromium print media.
