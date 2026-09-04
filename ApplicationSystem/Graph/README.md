<!-- Nodevision/ApplicationSystem/Graph/README.md -->
<!-- This file documents README for the Nodevision ApplicationSystem. It explains usage and maintenance details for developers. -->
# Graph

The `Graph` folder contains code for generating and managing the file/directory graph in Nodevision.

## Purpose
Nodevision represents files as **nodes**, links as **edges**, and directories as **regions**.  
The `Graph` folder provides the system that scans the `Notebook/` directory and outputs the JSON files used for rendering.

## Contents
- **Node generators**: Create separate node files, grouped by the first letter of the filename (case-sensitive). Symbols are placed in a separate file.
- **Edge generators**: Produce two sets of edge files (indexed by origin and by destination). Each set is divided into subfiles by the first letter.
- **Utility scripts**: Handle responsiveness, splitting files for performance, and caching.

## Ordered Reference Candidates
A Nodevision resource reference may contain an ordered set of destinations. Destination 0 is the primary reference stored in the ordinary HTML attribute such as `href`, `src`, `data-src`, or another source-bearing attribute. Destinations 1..N are fallbacks stored as deterministic attributes named `data-nodevision-fallback-1`, `data-nodevision-fallback-2`, and so on.

All candidates describe the same logical resource. The primary destination keeps ordinary browser behavior intact outside Nodevision, while Nodevision can inspect fallback candidates for graph edges, source editing, local broken-link status, and media retry behavior where the browser exposes load failures.

Notebook candidates are stored relative to the containing source document using the shared `public/utils/notebookPath.mjs` helpers. File move and rename handling scans the fallback attributes through the same retargeting path used for ordinary links; external URLs are preserved unchanged.

## Notes
- The graph data is consumed by the front-end (via Cytoscape.js or D3.js).
- Graph generation is **automatic** — users do not directly edit graph files.
