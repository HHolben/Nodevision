# Graph

The `Graph` folder contains code for generating and managing the file/directory graph in Nodevision.

## Purpose
Nodevision represents files as **nodes**, links as **edges**, and directories as **regions**.  
The `Graph` folder provides the system that scans the `Notebook/` directory and outputs the JSON files used for rendering.

## Contents
- **Node generators**: Create separate node files, grouped by the first letter of the filename (case-sensitive). Symbols are placed in a separate file.
- **Edge generators**: Produce two sets of edge files (indexed by origin and by destination). Each set is divided into subfiles by the first letter.
- **Utility scripts**: Handle responsiveness, splitting files for performance, and caching.

## Notes
- The graph data is consumed by the front-end (via Cytoscape.js or D3.js).
- Graph generation is **automatic** — users do not directly edit graph files.
