# Panels

The `panels` folder defines reusable panel templates and JavaScript modules for Nodevision’s UI.

## Purpose
Panels are the building blocks of Nodevision’s interface.  
Each toolbar item can open a panel of a specific type (e.g., file view, graph view, 3D world view).

## Contents
- **JSON templates** (`fileViewPanel.json`, etc.): Define panel headings, icons, and placeholder text.
- **Panel scripts** (`panelFactory.mjs`, etc.): Create, render, and inject panels dynamically into the grid layout.
- **Feature modules**: Implement the logic for specialized panels (file manager, graph view, editor, etc.).

## Notes
- Panel templates are declarative: the JSON defines structure, while scripts define behavior.
- Panels should be self-contained so they can be reused or extended easily.
