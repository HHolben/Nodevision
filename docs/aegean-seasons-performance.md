# Calendar seasons and Aegean performance

## Calendar-driven appearance

In **Insert → Voxel World → Aegean Greek Wilderness**, or **Edit Generation Parameters** on existing terrain, set **Season source → World calendar**. The adjacent **Manual / fallback season** remains editable. Existing saved worlds without `environment.seasonMode` retain manual behavior.

Calendar mode consumes the existing `VRWorldContext.astronomy` runtime. It uses the world calendar's absolute instant and timezone, and the observer's latitude, through the existing meteorological `seasonAt` classifier. Northern seasons change in March, June, September and December; the southern hemisphere shifts six months. This feature neither creates another clock nor changes observer, date, time scale, timezone, weather or astronomical calculations. When astronomy is absent or disabled, the chosen fallback season applies and the terrain inspector reports that condition.

For worlds without astronomy, configure the existing world-level `metadata.astronomy` declaration as described in [astronomy-and-world-time.md](astronomy-and-world-time.md). The legacy environment panel is not a complete astronomy editor. For example, merge this declaration into the world's existing metadata without replacing other fields:

```json
{
  "astronomy": {
    "model": "earth",
    "observer": { "latitude": 37.5, "longitude": 25 },
    "clock": {
      "mode": "saved",
      "initialTime": "2026-03-01T12:00:00+02:00",
      "timezone": "Europe/Athens",
      "timeScale": 1
    },
    "bodies": [{ "id": "sun", "type": "sun", "intensity": 2 }, { "id": "moon", "type": "moon" }],
    "stars": { "enabled": true }
  }
}
```

Use `system-local` instead of `saved` to initialize from system time with the existing calendar semantics. Saved clocks reopen at their saved date; fixed/system-local clocks retain their original policies.

The terrain generator keeps an effective season separate from the authored fallback. A season transition clears derived column, vegetation and chunk-occupancy caches and marks resident chunks for streamed replacement. It does not replace the scene root, material pool, authored objects, path constraints, generator seed or protected recipes. Old chunk meshes remain visible until their replacements are ready. Collision/liquid sampling uses the updated generator immediately; graphical convergence is gradual. Calendar jumps while paused still refresh streamed terrain, while the simulation clock itself follows the existing pause/static-time rules.

Grass becomes greener outside summer, spring flower occurrence increases, and seasonal stream water returns outside summer. Terrain elevations remain fixed. Calendar-mode placement reserves seasonal streambeds throughout the year, so flooding does not remove and recreate established evergreen trees. Protected regions retain their captured appearance; regeneration now captures the actual visible calendar season beneath newly authored objects. Authored fallback and calendar mode survive normal save/reopen and undo/redo without adding a history entry for every seasonal transition.

The adapter avoids duplicate updates within a simulated second and invalidates terrain only when the effective season changes. Calendar month formatters are reused in a bounded timezone cache. This is a seasonal appearance model, not a climate, plant-growth or hydrological simulation. It does not add wind animation, dynamic weather, audio or new astronomy controls.

## Performance changes

- Aegean terrain uses greedy meshing: adjacent exposed coplanar cells of the same canonical material become one rectangle. Normals, winding, material boundaries, liquid interfaces, picking surfaces and cross-chunk occlusion remain equivalent to the original mesher. The legacy mesher remains active for other terrain presets.
- Plant material indices are computed once per generated plant instead of per sampled voxel. Feature priorities use a compact lookup table.
- Coastal height samples use bounded caches and numeric cache keys with coordinate checks. Material-column resolution uses an indexed lookup. These optimizations do not change seeded voxel output.
- The calendar refresh reuses the existing chunk queue, material pool and lifecycle. No full-world voxel volume is allocated.

A fully solid isolated chunk shrinks from 6,144 unit quads to six merged quads. The greedy mesher also reports `surfaceFaceCount` for exposed unit-cell area; its `faceCount`, runtime face statistics and triangle counts represent actual emitted rectangles.

## Measured results

The paired CPU comparison uses the same process and identical generated chunks, warmed implementations, alternating execution order and four repetitions (64 chunk samples per mesher per density). Both paths use the current generator, isolating meshing cost.

| Scene | Reference mean mesh time | Greedy mean mesh time | Reference geometry | Greedy geometry |
|---|---:|---:|---:|---:|
| Sparse, density 0.15 | 12.69 ms | 9.25 ms | 2,279,520 bytes | 740,760 bytes |
| Dense, density 1.0 | 12.39 ms | 8.23 ms | 3,670,680 bytes | 1,599,840 bytes |

Mean meshing time fell approximately **27–34%**, and estimated geometry storage fell **56–68%**. Geometry estimates assume 32-bit indices. See [aegean-mesher-comparison.json](aegean-mesher-comparison.json).

A matched Electron/SwiftShader run uses the same 100-frame editor fixture and current generator. The reference run substitutes the original mesher only through the test server; production has no global benchmarking flag.

| Measurement | Reference mesher | Greedy mesher |
|---|---:|---:|
| Average frame, including streaming and frame pacing | 38.64 ms | 29.94 ms |
| p95 frame | 48.00 ms | 40.40 ms |
| Average streaming update | 18.22 ms | 12.85 ms |
| Cumulative chunk meshing/geometry construction | 1,208.10 ms | 688.20 ms |
| Last-frame rendered triangles | 94,330 | 32,626 |
| Resident chunks / logical solid voxels | 77 / 1,670,972 | 77 / 1,670,972 |

That is approximately **23% lower average frame time**, **16% lower p95 frame time**, and **65% fewer rendered triangles**. See [reference](aegean-render-reference.json) and [optimized](aegean-render-performance.json) reports. These are software-renderer measurements, not hardware GPU guarantees. Earlier `aegean-render-before.json` and CPU before/after artifacts were collected in an earlier environment session; use the paired and matched comparisons above for performance claims.

Chunk generation and meshing still execute on the main thread. Some chunks exceed a 16 ms budget, and seasonal visual updates are incremental rather than atomic. Worker generation/meshing, bounded upload scheduling, vegetation LOD/instancing and broader hardware profiling remain appropriate next performance work. This change does not claim 60 FPS.

## Validation

The combined **20-file Node regression run passes**, including the existing terrain, tree, material, water, path, astronomy, weather and Sandbox planner suites. New tests cover:

- Clock timezone and hemisphere boundaries, manual fallback, form persistence and missing-mode compatibility.
- Evergreen identity, stable elevations, seasonal grass/stream changes and protected recipes.
- Runtime identity/material retention, exactly-once invalidation, source-definition immutability, disposal and retained path constraints.
- Greedy meshes expanded back to oriented unit faces and compared to the original mesher, including mixed materials/liquids, holes, finite boundaries, real Aegean chunks and triangle winding.

Electron checks pass for actual Aegean **Build and Play**, date jumps while paused, protected-ground capture at the effective season, saved date/timezone/observer/mode, reopened winter appearance, further season changes in Play, unchanged authoring restrictions and teardown. The existing insertion regression and Aegean editor/history/save/reopen fixture also pass.

The native-module audit passes all new and other changed modules. Its sole exception is the existing 592-code-line `initScene.mjs`, which receives one changed line passing the already-owned astronomy runtime into terrain updates. No unrelated refactor was performed; see [aegean-season-standards.json](aegean-season-standards.json). `git diff --check` passes.

## Reproduce

```sh
node --loader ./scripts/html-test-loader.mjs --test ApplicationSystem/public/MetaWorld/ProceduralVoxelWorld/*.test.mjs ApplicationSystem/public/MetaWorld/Aegean/*.test.mjs ApplicationSystem/public/MetaWorld/Paths/Paths.test.mjs ApplicationSystem/public/MetaWorld/Weather/Weather.test.mjs ApplicationSystem/public/MetaWorld/Astronomy/*.test.mjs ApplicationSystem/public/MetaWorld/SandboxWorldPlanner.test.mjs
node scripts/aegean-mesher-benchmark.mjs
node scripts/aegean-benchmark.mjs
# Run these separately so benchmark processes do not contend with one another.
env -u ELECTRON_RUN_AS_NODE NV_WORLD_BROWSER=aegean-world-browser.mjs NV_AEGEAN_REFERENCE_MESHER=1 xvfb-run -a node_modules/.bin/electron --no-sandbox --disable-dev-shm-usage scripts/procedural-world.electron.cjs
env -u ELECTRON_RUN_AS_NODE NV_WORLD_BROWSER=aegean-world-browser.mjs xvfb-run -a node_modules/.bin/electron --no-sandbox --disable-dev-shm-usage scripts/procedural-world.electron.cjs
env -u ELECTRON_RUN_AS_NODE NV_WORLD_BROWSER=aegean-seasons-browser.mjs xvfb-run -a node_modules/.bin/electron --no-sandbox --disable-dev-shm-usage scripts/procedural-world.electron.cjs
```

New modules: `Aegean/CalendarSeasons.mjs`, its tests, `ProceduralVoxelWorld/VoxelGreedyMesher.mjs` and its tests. New fixtures: `scripts/aegean-seasons-browser.mjs` and `scripts/aegean-mesher-benchmark.mjs`. Integration changes cover season configuration/form/properties, terrain cache refresh/runtime streaming, the existing calendar formatter, protected-ground capture, plant/coastal/material sampling and the Electron test runner. The full accumulated Aegean inventory remains in [aegean-files.txt](aegean-files.txt).
