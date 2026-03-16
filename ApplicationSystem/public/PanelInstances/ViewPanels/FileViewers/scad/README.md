<!-- Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/FileViewers/scad/README.md -->
<!-- This file documents README for the Nodevision ApplicationSystem. It explains usage and maintenance details for developers. -->
# Nodevision SCAD Editor (prototype)

This folder contains a minimal parametric OpenSCAD graphical editor used by `ApplicationSystem/public/PanelInstances/ViewPanels/FileViewers/ViewSCAD.mjs`.

## What works

- **Scene tree (geometry tree):** primitives, transforms, and boolean nodes.
- **Parameters:** global parameter table; node fields can reference parameter names/expressions.
- **SCAD generation:** readable, indented OpenSCAD via `generateSCAD(sceneTree, parameters)`.
- **SCAD import (restricted):** best-effort parse of SCAD containing only primitives/transforms/booleans and simple assignments.
- **3D preview:**
  - fast approximate preview from the scene tree (Three.js primitives + transforms)
  - optional **OpenSCAD CLI** render to STL via `POST /api/scad/render` and display via Three.js `STLLoader`.
- **Project save format:** `*.scadproj.json` next to the `.scad` file in the Notebook.

## Requirements

- Server machine must have **OpenSCAD CLI** available on PATH as `openscad` for STL export.
- Nodevision must be running with authentication (the render endpoint requires a logged-in session).

## Files

- `sceneTree.mjs`: scene-tree model + tree helpers + safe expression evaluation (preview only).
- `scadGenerator.mjs`: SCAD generator + minimal parameter parsing from SCAD.
- `viewer.mjs`: Three.js viewport + STL loading + approximate tree preview.
- `editorUI.mjs`: DOM UI (parameters, tree, node properties, code panel).
- `plugins.mjs`: plugin registry (primitives/modules/UI components).

## Quick start

1. Create a new empty `*.scad` file in your Notebook and open it.
2. The editor will seed an example parametric model if the file is empty.
3. Click **Render (OpenSCAD)** to generate a real STL preview (requires OpenSCAD installed).
4. Click **Save Project** to write `*.scadproj.json` next to your `.scad` file.

## Important limitations (vs Fusion/SolidWorks)

OpenSCAD is a *programming* language and is not a B-Rep CAD kernel. This prototype is a **feature-tree editor that generates SCAD**.

- Importing **arbitrary SCAD** back into a fully-editable feature tree is not generally possible (modules/loops/functions/custom code).
- When a `.scad` cannot be imported, the panel will offer **parametric starter** (visual) or **raw code** mode.
