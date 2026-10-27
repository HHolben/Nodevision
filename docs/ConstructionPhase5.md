# Phase 5 implementation report

Phase 5 separates sparse referenced geometry from independently identified terrain operators. The former single-footprint definition, geometry clipping, bounded-box serialization, and single Excavation primitive were removed. Version 2 is the only construction definition schema; unrelated world, path and imported-asset schemas are unchanged.

- **Architecture/schema:** `Definition.mjs` validates `terrainVolumes`, stable volume IDs, box types, subtraction, activation and bounded integer coordinates. `TerrainVolumes/cut_<id>` children remain distinct from referenced GOX geometry. See [the schema](../ApplicationSystem/public/MetaWorld/Constructions/construction-v2.schema.json) and [composition documentation](ConstructionComposition.md).
- **Composition:** same-owner active cuts form a union; gaps and inactive cuts do not excavate. Different-owner cut conflicts remain deterministic. Per-column candidate caches filter volumes; changed bounds and boundary neighbors invalidate indexed resident chunks without a full resident-chunk scan.
- **Editing:** focused history combines geometry opinions with volume transactions. Native inspector controls support add, select, duplicate, delete, activation, numeric move/resize, face dragging and Alt-drag translation. Preview, commit and cancellation are distinct. Geometry serialization visits occupied sparse cells instead of excavation bounds.
- **Extrusion:** a construction document adapter reuses `GoxExtrusion`, `VoxelExtrusion`, projection and transient overlay code. E, EX/EY/EZ, signed distances, mouse input, Escape, disconnected selections, material preservation and endpoint selection use the existing algorithm. Commits are one focused transaction.
- **Conflicts:** red cell overlays and status diagnostics show terrain intersections. Publication validates current and other loaded source instances, rejects unresolved geometry/terrain intersections and inter-instance cuts, and never enlarges excavation automatically.
- **Persistence:** capture creates one version 2 cut. Edit Source and Make Unique preserve the appropriate asset/instance identities and references. Conditional SHA-256 writes, reload verification, failure reporting and partial-publication retry remain. World Save and ordinary temporary opinions stay separate.

Validation completed:

| Coverage | Result |
|---|---:|
| Construction editing browser, including new volume/extrusion controls | 94 checks passed |
| Construction composition/world persistence browser | 52 checks passed |
| Capture publication/material/GOX browser | 186 checks passed |
| Ordinary temporary voxel browser | 68 checks passed |
| Native GOX editor/extrusion browser | 236 checks passed |
| Targeted Node files: construction, capture, editing, session, extrusion, paths, terrain, representation, conditional writes | 26 files passed |
| Modified construction module syntax and diff whitespace | Passed |

The three terrain files using browser-root imports require `node --loader ./scripts/html-test-loader.mjs --test ...`; plain Node fails module resolution before those tests execute. They passed with the existing loader. Browser tests run through the repository's localhost Chromium fixtures; these exercise real modules with isolated persistence, not a user's Notebook assets.

Remaining limits are intentional: axis-aligned subtractive boxes, 256 volumes, 65,536 occupied construction cells, 128 materials, 16,384 cells per focused transaction and 64 MiB GOX. Cell-level excavation highlights cap sampling at 16,384 cells and report clipping while the whole box remains composed. Multi-file publication is not atomic, and references in unopened worlds cannot be validated globally. Preview and editing require an aligned procedural grid; geometry may extend beyond its extents. Arbitrarily transformed or hidden/read-only GOX layers cannot enter focused editing.

Recommended Phase 6 priorities are atomic linked-asset publication, global source-reference indexing and cross-world conflict checks, profiling larger sparse operations, stronger selection/manipulation accessibility, and material-asset workflows. OpenUSD serialization and the other explicitly excluded simulation/CSG features remain outside this implementation.

Follow-up review corrected detached-inspector Enter/Escape routing, stale numeric proposals after invalid input, and pending previews surviving undo/redo. Numeric inputs now preview while typing, cancellation restores displayed values, and pointer cancellation or focus loss cancels manipulation. Unchanged/contained excavation boxes no longer consume the cell-highlight budget before newly proposed volumes. The expanded editing browser fixture passes 94 checks; all three focused construction Node test files pass, including seven Phase 5 regression cases.
