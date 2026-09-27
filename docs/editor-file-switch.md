# Switching files from a graphical editor

A normal File Manager file selection (including reveal-and-select) captures the visible graphical editor and its original file before changing selection. Selecting a different file opens a small modal with **Save**, **Cancel**, and **Switch Without Saving**, even if the current document is clean. Selecting the same file does not reload it. Folder browsing and additive file selection do not retarget the graphical editor.

Cancel or Escape preserves the current document, edits, and file selection. Save writes the captured source file through the existing save dispatcher and switches only after success. A failed save keeps the document and modal open with an inline error. While saving or switching, the controls are disabled and another selection cannot redirect the pending operation. Switch Without Saving loads the destination without writing the source.

The accepted switch targets the captured editor host, disposes its previous editor, and updates its tab path, title, and reference. File Manager publishes the new canonical selection after the switch. This is an explicit guarded operation; graphical editors still do not subscribe to arbitrary workspace selection events. Existing code-editor replacement and dirty-navigation guards share the same modal.

Validation: `python3 scripts/test-svg-layers-browser.py --editor-switch` exercises actual File Manager click handlers, graphical CSV/SVG modules, save dispatch, modal actions, source-path preservation, save failure/retry, pending-save locking, clean/same/case-sensitive paths, lifecycle cleanup, and tab metadata. Fixtures and save responses are in memory; no Notebook documents are written.
