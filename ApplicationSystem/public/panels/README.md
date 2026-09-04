<!-- Nodevision/ApplicationSystem/public/panels/README.md -->
<!-- This file documents README for the Nodevision ApplicationSystem. It explains usage and maintenance details for developers. -->
# Panels

The `panels` folder defines reusable panel templates and JavaScript modules for Nodevision’s UI.

## Purpose
Panels are the building blocks of Nodevision’s interface.  
Each toolbar item can open a panel of a specific type (e.g., file view, graph view, 3D world view).

## Contents
- **JSON templates** (`fileViewPanel.json`, etc.): Define panel headings, icons, and placeholder text.
- **Panel scripts** (`panelFactory.mjs`, etc.): Create, render, and inject panels dynamically into the grid layout.
- **Feature modules**: Implement the logic for specialized panels (file manager, graph view, editor, etc.).

## Panel Tabs
Workspace panel cells host a tab collection managed by `panelTabs.mjs`. Opening or replacing panel content preserves existing mounted content as tabs instead of clearing the cell.

- Tabs use compact labels built from content type plus a resource basename, with full paths in tooltips.
- Duplicate prevention uses content type plus resource path and mode metadata, so the same file activates an existing tab while a different file can open beside it.
- Activating a tab reapplies the active panel context, toolbar mode, selected file state, and legacy singleton host IDs for FileView, GraphicalEditor, and CodeEditor.
- Close actions close the active tab first and use the editor dirty guard for active dirty editor tabs.
- Tabs can be reordered within a tab bar or dragged onto another panel cell; single-tab bars stay hidden during normal use and reveal while a tab drag is active.
- Tab orientation is per panel cell and can be set to top, bottom, left, or right from View > Layout Controls > Panel Tabs.
- `serializeWorkspace()` includes tab orientation, active tab, and tab descriptors so saved layouts can restore tabbed panels.

## Notes
- Panel templates are declarative: the JSON defines structure, while scripts define behavior.
- Panels should be self-contained so they can be reused or extended easily.
