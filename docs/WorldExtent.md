# Procedural and source-defined world extents

Purely procedural worlds now support `worldExtent.mode: "finite" | "infinite"`. Geographic, authored-map, and hybrid worlds remain finite. Missing extent metadata continues to mean finite, without rewriting legacy documents to add a property.

The generation dialog offers **World Extent → Finite / Infinite** only for procedural sources. Infinite hides horizontal dimension controls and retains vertical settings. Map sources show read-only source-defined extent information. Loading, authoring, regeneration, and serialization reject infinite map definitions with a clear error. Directly mutating an installed runtime's extent also fails serialization: extent changes must rebuild its generator through the existing authoring/history path.

## Coordinates and streaming

Infinite terrain uses signed world-space voxel and chunk coordinates. The saved finite numeric `size` remains the recipe's original placement/coastal/starting-biome anchor and vertical span; it is not enlarged to simulate infinity. An explicit runtime extent flag removes horizontal clipping from sampling, feature placement, spawn, paths, chunk selection, coarse tile sampling, and vegetation selection. Vertical bounds remain finite.

Generation continues to use the existing seeded terrain, waterways, landforms, caves, biomes, and vegetation. Aegean terrain retains its original anchored island/peninsula and generates the surrounding seeded ocean/coastal field; it does not tile or repeat that island. Finite generators retain their horizontal boundaries. Enabling infinity retains the seed, origin, authored objects, paths, and construction references; terrain near former boundaries can gain features that finite clipping previously excluded.

The existing active budgets remain in force: detailed chunks and mesh bytes, at most 128 coarse tiles, at most 64 vegetation regions, and bounded source/feature caches. The column-level registry is pruned even when distant terrain is disabled. Destination jumps cancel obsolete work and request a local neighborhood, not the intervening route. Seasonal invalidation now targets the resident set rather than the former finite rectangle.

Tests exercise generated samples out to ±100 km and rendered/runtime streaming, collision, eviction, and return visits out to ±10 km. No floating-origin system was added, and rendering precision beyond the tested range is not certified. Infinity describes generation without a preset horizontal boundary, not unlimited floating-point precision.

## Source coverage and editing

Geographic crops, irregular coverage, and NoData still use the authoritative raster sampler. No geographic fallback, repetition, or extrapolation was added. Path and voxel authoring now check geographic valid-data coverage as well as dimensions. Authored maps and hybrids preserve their configured finite composition, including an explicit procedural fallback inside that finite composition; they cannot extend infinitely.

Signed-coordinate voxel editing uses the existing temporary session layer. Those opinions survive generated-cache eviction but remain temporary under the established save contract. Persistent paths and linked constructions retain their existing serialization and companion resources. The browser regression saves a path and a linked excavation beyond the old boundary, then verifies them in the Viewer after reopening. No generated chunks or newly visited regions are serialized, and no new sparse-edit storage format is introduced.

Finite → Infinite is integrated with existing undo/redo. Direct Infinite → Finite conversion is disabled in both the control and authoring validation, because clipping potentially distant authored content needs an explicit policy. Undo of a previous extent change remains available through existing world history.

## Validation

- All 50 MetaWorld test files passed, including signed deterministic generation, ±10 km runtime relocation, both representations, bounded caches with distant terrain disabled, Aegean extension, extent validation, and geographic authoring coverage.
- `node scripts/test-world-extent.mjs` passed through real HTTP loading/saving and the native GameView render loop: extent control, undo/redo, signed geometry and collision, voxel editing, path sampling, persistent linked excavation, Editor save and Viewer reopen.
- `NV_TERRAIN_NATIVE=1 node scripts/test-vegetation-phase-c.mjs Notebook/test.html` passed: production Editor/Viewer, native controls, terrain/vegetation geometry, representations, save/reopen, and exact parser-input equality to saved geographic script contents.
- The map integration passed: source-defined UI, map/hybrid composition, rejection of incompatible infinite saved definitions, imports, undo/redo, and save/reopen.
- The teleporter integration passed after the coordinate changes, including geographic coarse/detailed landing, cancellation, imported assets, constructions, cleanup, and save/reopen.
- All 53 dirty native modules passed the path-header, second-line description, and fewer-than-200-code-lines audit; `git diff --check` passed.
- `Notebook/test.html` was never modified; geographic integration uses a temporary copy. Its SHA-256 remains `75533dd604cbacc1de34bd42e1e3c5a5faeef5f4779b51c520a2e0c0edd81292`.

The earlier performance measurements and optimization-stage limitations are recorded historically in `TerrainPhaseD.md`; its former deferral of infinite generation is superseded by this implementation. Performance measurements there are not new measurements of infinite travel. These checks used Node and headless Chromium, not native Electron or the user's GPU.
