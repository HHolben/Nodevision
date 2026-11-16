# Archery Bow and Predictive Trajectory

Implemented in the existing Virtual World Editor inventory. No Greek-letter lessons, scoring, targets, or Chiron behavior were added. Existing E2/E3 terrain changes are preserved. `Notebook/test.html` is unchanged.

## A. Architecture

`GameViewDependencies/Abilities/MovementAbilities/ArcheryBowAbility.mjs` registers **Archery Bow** with the existing inventory and selected-item action dispatcher. It uses the existing G/adjust command, Use binding and controller binding. It does not add a toolbar or input manager. The inventory owns disposal, and `VRWorldContext.archeryBow` exposes the tool and optional `snapshot()` diagnostics.

The existing input router now retains a bounded queue of press/release edges with monotonic timestamps. This preserves taps occurring between rendered frames. Repeated keydowns are ignored. Escape, typing focus, pointer cancellation, pointer-lock loss, visibility loss and blur clear queued actions and advance a cancellation revision. A release without a successfully started draw cannot fire. Switching tools cancels drawing and clears the old keyboard Use hold. Keyboard Use is configurable: the bow does not treat R as an additional binding after remapping. Mouse Use bindings and controller Use use the same architecture.

World pause cancels drawing and freezes projectile time. Existing Viewer policy excludes authoring tools, including the bow and teleporter. In Editor worlds, ordinary tool-use rules still apply; this feature does not grant new permissions. Independently fired arrows continue after unequipping.

## B. Bow mechanics

Personal defaults:

| Parameter | Default | Accepted range |
|---|---:|---:|
| Minimum effective launch force | 10 N | At least 0.1 N |
| Maximum effective launch force | 120 N | Minimum force through 500 N |
| Full-draw duration | 1.2 s | 0.05–10 s |
| Predictive trace | Off | On/off |

Values must be finite and maximum force must be at least minimum force. Invalid dialog values are rejected. G opens the established equipment-style modal; its controls isolate world input. Done validates and saves personal preferences under localStorage key `nodevision.archery.v1`, outside the world document. Cancel leaves settings unchanged. Opening settings cancels an active draw; changes apply to subsequent shots. Preferences survive reopening a world in the same browser profile/origin.

Force progresses linearly from minimum to maximum over the configured draw duration and remains capped. Launch energy is `efficiency × effective force × effective draw distance`; speed is `sqrt(2 × energy / mass)`. Defaults are 0.03 kg arrow mass, 0.5 m effective power stroke and 75% efficiency. For example, 120 N gives 45 J and approximately 54.77 m/s. The configured force is the **effective average force over the power stroke**, not peak limb force or velocity. Minimum-force taps represent a calibrated minimum-energy shot.

A procedural, instanced 16-segment curved bow animates limb flex, a three-point string and one nocked triangular arrow. String displacement reaches 0.28 m visually. This presentation animation is separate from the documented effective energy stroke. The bow remains offset from the crosshair; changing tool or canceling resets it without firing. There is no ammunition count or consumption.

## C. Arrow physics and collision

`Archery/Physics.mjs` provides the shared pure projectile model. Midpoint integration runs at **1/120 s**. Gravity and quadratic drag are evaluated at the midpoint. Air defaults: density 1.225 kg/m³, drag coefficient 0.3, effective area 0.00005 m²; drag acceleration is `−0.5 × density × coefficient × area / mass × |relative velocity| × relative velocity`. Ordinary users do not need extra atmosphere controls. No existing world wind setting was found; stationary air is assumed.

World gravity is read through the existing gravity ability, including flat, none and point-mass modes. Legacy gravity values are acceleration per 60 Hz reference-frame squared, so the SI conversion is ×3600. Thus the existing default flatG 0.012 corresponds to 43.2 m/s²; this implementation does not silently replace it with Earth gravity. Point-mass acceleration is evaluated at each projectile position using the world's source object or point, with the same existing acceleration cap. Editor flight/gravity-off movement does not disable world gravity for arrows.

Rendered frames accumulate fixed physics steps. At most 0.4 s / 48 steps are caught up in one frame; longer stalls discard excess elapsed time and report it in diagnostics, slowing simulated time rather than taking a large unsafe jump. Ordinary 30/60/144 FPS integration agrees exactly at equal simulated times. Pause resets the accumulator and never catches up paused time.

Every step sweeps the previous tip to the proposed tip and selects the nearest collision. Impact position, elapsed time and distance are clipped to the swept hit. Collision uses existing ownership and raycasting conventions:

- Voxel terrain and unloaded procedural terrain use existing 0.25 m occupancy DDA and canonical material solidity, including composed edits and construction cuts.
- Resident polygonal terrain uses its extracted triangles and canonical group solidity. Only segment-intersected chunks and the seam margin are queried. Invalidated meshes are excluded, with current source occupancy as fallback.
- Geographic and authored-map/hybrid queries use available authoritative source data. Missing map data ends prediction as uncertain and removes an entering projectile as an unverified miss; drawing a trace never starts large synchronous terrain generation.
- Solid imported models and construction surfaces use actual collision-owned mesh triangles. Unregistered decorative objects, player avatars, editor helpers, bow/arrow visuals, vegetation proxies and distant visual tiles are excluded.

The camera forward ray is authoritative. The release tip lies on that ray at least 0.5 m ahead and outside the firing player's body, including downward shots. A camera-to-release sweep catches nearby blockers before launching past them; an immediate obstruction embeds the tip there. The visual bow offset does not offset aim.

## D. Arrow representation and lifecycle

Each arrow is a narrow 0.65 m triangular tetrahedral shape with its tip at geometry origin and longitudinal axis along local −Z. A single instanced mesh renders all arrows. Its pose aligns that axis to instantaneous velocity, including downward rotation during flight. Tip coordinates equal the collision point at impact; embedded arrows receive no further gravity or drag integration.

Moving mesh attachment stores the tip and direction in the hit object's local coordinates. Embedded arrows follow its translation/rotation and are removed if the target leaves the scene. Terrain edits do not turn arrows into authored objects or history entries.

Limits are **16 flying + 64 embedded arrows**, one shared geometry/material, and one instanced draw regardless of resident arrow count. Old flying arrows are removed when their budget is exceeded. Embedded eviction prefers older arrows farther than 80 m, then the oldest arrow. Flight expires at 12 simulated seconds or 350 m traveled. World closure clears arrows, detaches helpers and disposes owned buffers/materials. Recent nearby arrows remain preferentially, within the fixed budget.

## E. Predictive trajectory

The optional dotted `THREE.Points` arc uses the same `advanceSwept()` function, gravity/drag parameters, tip launch state and collision adapter as flight. It stops at the first valid impact. Teal indicates a confirmed surface; sand indicates an unfinished or otherwise unverified endpoint. It is hidden after release, cancellation, settings entry and unequip. Prediction never enters document serialization, collider lists or picking lists.

Work is bounded to **120 simulation steps/collision sweeps per rendered update, 480 total steps (4 s), 200 m predicted travel and 96 displayed dots**. Geometry buffers are reused. Dots are round, 3.5 pixels across, omit the immediate muzzle region and enforce world/screen separation so near-camera samples do not overlap into a beam. Recalculation responds to launch force/pose, gravity and collider changes; terrain residency/invalidation/source revisions and imported child transforms/geometry versions contribute to the key. Fully drawn stationary aim reuses the settled prediction and cached muzzle sweep. An in-progress long trace is rebuilt at most every 100 ms as inputs change; short completed traces can refresh on the next frame. This trades immediate far-end completion for bounded work.

[Accuracy measurements](ArcheryAccuracy.json): 243 combinations across 10/65/120 N, elevations −0.2/0.4/1 rad, gravity 0/9.81/43.2 m/s², drag 0/0.0003/0.005 m⁻¹ and 30/60/144 FPS produced **zero measured predicted-versus-actual position error at one simulated second**. This checks the same numerical inputs, not a stale on-screen preview. The fixed-step model's worst two-second position difference from an eight-times-finer midpoint reference was **0.000192 m**, below the 0.002 m test tolerance. With gravity alone it also matches the analytic solution. Collision tests verify first impact and exact tip placement.

Actual production WebGL views: [voxel](ArcheryVisuals/archery-voxel.png), [polygonal](ArcheryVisuals/archery-polygonal.png). These show the first-person bow and trace in the real GameView.

## F. Future gameplay integration

The existing panel DOM event mechanism emits `nv-archery` CustomEvents. `event.detail.type` is one of:

- `bow-draw-started`, `bow-fully-drawn`
- `arrow-fired`
- `arrow-hit-object`, `arrow-hit-terrain`
- `arrow-missed`, `arrow-removed`

Arrow events expose session arrow ID, shooter ID, launch force/speed, flight duration and traveled distance. Hit events also provide stable root object ID (falling back to its runtime UUID), root and hit-object references, world impact point and normal. Fired events include position and velocity. Miss/removal events include a reason. These hooks contain no Greek-letter or scoring logic and introduce no separate global event bus.

## G. Performance

[Raw benchmark data](ArcheryPerformance.json) retains **16 cases**: two passes in reverse scenario order, fixed scene with 81 collision-owned boxes, 30 warmup + 120 measured real RAF frames per case, Chromium SwiftShader, 640×480. Values below average the two trial summaries; percentiles are averages of each trial's percentile, not pooled percentiles. Browser timer resolution can round small samples to zero.

| Workload | Frame mean / p95 (ms) | Tool CPU mean / p95 (ms) | Queries/frame mean / p99 | Draw calls |
|---|---:|---:|---:|---:|
| no-arrows | 16.67 / 17.05 | 0.004 / 0.000 | 0.0 / 0 | 81 |
| one-flying | 16.67 / 17.10 | 0.299 / 0.450 | 2.0 / 2 | 82 |
| sixteen-flying | 16.67 / 17.15 | 1.707 / 2.350 | 32.0 / 32 | 82 |
| 64-embedded | 16.67 / 17.05 | 0.116 / 0.200 | 0.0 / 0 | 82 |
| preview-disabled | 16.67 / 17.10 | 0.006 / 0.100 | 0.0 / 0 | 81 |
| minimum-force-preview | 16.67 / 17.00 | 0.033 / 0.100 | 0.0 / 0 | 82 |
| maximum-force-long-preview | 16.67 / 17.05 | 0.032 / 0.100 | 0.0 / 0 | 82 |
| moving-aim-dense-colliders | 16.67 / 16.95 | 3.284 / 6.150 | 71.9 / 120 | 82 |

Stationary previews performed **zero collision queries during the measured settled interval**. Their initial bounded preparation is separate from that steady-state result. Moving aim required approximately 3.28 ms mean CPU and 6.15 ms p95 in this dense fixture. All displayed arrows add one draw call; the preview adds one. The equipped bow adds two draws ready or three while drawing. No-arrow/unequipped tools submit no helper geometry.

Owned typed geometry and instance buffers total **8,292 bytes of allocated array capacity**. This is not a measurement of driver/GPU allocation, materials, engine bookkeeping or transient JavaScript allocation. Every case returned to one fixture geometry and 81 fixture draw calls after disposal. This verifies bounded rendering resources rather than assuming that unlimited ammunition is free.

[Production GameView measurements](ArcheryBowBrowserMetrics.json) separately retain both terrain modes, event records and 120-frame trace-on/off samples with several embedded arrows. The geographic software-rendered scene measured 37.76 ms/frame with trace disabled and 47.49 ms/frame with trace enabled, in sequential 120-frame samples with different embedded-arrow counts; it is much slower than the fixed fixture; these samples cannot establish a small hardware FPS delta. The benchmark does not claim to solve the earlier E1 distant-terrain deficit. No hardware GPU or native Electron performance claim is made.

Optional console diagnostics: `VRWorldContext.archeryBow.snapshot()` returns flying/embedded counts, physics time/steps, discarded stall time, prediction time/steps/dots/recomputations, cumulative collision queries, buffer capacity, and last force/speed. Nothing was added permanently to the FPS overlay.

## H. Testing

Commands:

```sh
npm run test:archery
npm run test:metaworld
node --import ./scripts/register-browser-test-imports.mjs --test $(find ApplicationSystem/public/PanelInstances/ViewPanels/GameViewDependencies -name '*.test.mjs')
node scripts/test-archery.mjs
node scripts/test-archery.mjs performance
node scripts/test-raycasting-teleporter.mjs
```

Results: 60 MetaWorld test files and all 10 GameView test files pass. Archery contributes 15 focused cases (14 physics/rendering/collision/lifecycle cases and one input-router lifecycle case), including 243 numerical configurations. Tests cover force validation/progression/energy, gravity/drag, analytic/finer-reference accuracy, frame-rate agreement, thin swept intersections, first impact, moving attachment, tip orientation, budgets, missing source data, source cuts, both representations, finite/infinite procedural and authored-map/hybrid terrain, prediction reuse and resource disposal.

The production integration uses the real GameView, inventory cells, trusted Chromium Use/G input and actual WebGL. It verifies hold/release, repeated-key suppression, minimum-force taps/unlimited shots, full draw and string movement, settings persistence, trace/aim changes, collision/embedding in voxel and polygonal geographic worlds, switching to teleporter, blur cancellation, unchanged document/object arrays, save/reopen, Viewer exclusion and closure cleanup. Actual GOX, STL, glTF, GLB and linked construction loaders are checked for decorative exclusion and registered solid collision. The existing complete production Raycasting Teleporter regression also passes after the shared input changes.

Native Electron was not exercised; production Chromium/SwiftShader is the available rendering environment. [Validation record](ArcheryValidation.json) retains artifact hashes and commands. The protected Notebook checksum remains `75533dd604cbacc1de34bd42e1e3c5a5faeef5f4779b51c520a2e0c0edd81292`.

## I. User walkthrough

1. Open a world in Virtual World Editing and open the existing inventory (normally I).
2. Select **Tools → Archery Bow** to equip it in the active hand.
3. Press **G** for settings. Enter minimum/maximum effective force in N and full-draw duration in seconds. Enable the predictive trace if wanted; it starts off.
4. Select **Done**. Return focus to the world canvas; use the normal click-to-lock behavior if needed.
5. Hold **Use** (default **R**) to nock and draw. Aim with the camera; the bow/string and optional dotted trace respond to the current draw.
6. Release Use to fire once. The arrow falls under world gravity and drag, rotates with flight, and remains embedded at a valid hit.
7. Draw again for another arrow. Ammunition is unlimited; old resident arrows are bounded.
8. Change tools, press Escape, lose pointer lock/focus, or open settings to cancel without firing. The teleporter retains its own activation when equipped.

## J. Remaining limitations

- Software RAF timings are capped near 60 FPS in the fixed fixture and cannot establish hardware GPU headroom. The production geographic scene remains software-renderer limited; E1 rendering work remains separate.
- The live trace can lag changing inputs by its incremental refresh interval. It predicts at most four seconds/200 m; actual flight may continue to 12 seconds/350 m. Unverified endpoints are not promised impact positions.
- Unloaded polygonal terrain falls back to authoritative voxel occupancy, so its first contact can differ from subsequently installed Surface Nets triangles by a voxel-scale amount. Current edits take priority over invalidated triangle meshes.
- Unavailable geographic/map collision data causes a safe unverified miss/removal; arrows do not force-load a far-away detailed world. NoData/outside coverage is not synthesized.
- Imported collisions follow existing mesh raycasting, material face-sidedness and collider registration. Decorative or nonregistered imports do not become solid automatically. There is no generalized physics shape cast or new broad-phase spatial index for arbitrary imported scenes.
- Sweeping covers the tip, not the full arrow shaft or aerodynamic tumbling. Wind, lift, penetration, ricochet and target damage are not modeled. Moving-target collision is tested against the target's current pose; relative-motion continuous collision of independently fast-moving targets is not implemented.
- Embedded arrows follow object transforms, but a terrain edit removing their support does not automatically drop/re-simulate them. They remain session decorations until eviction/closure.
- Severe stalls exceeding 0.4 s intentionally slow simulated time. The world player's older movement implementation is itself frame based; arrow physics uses its 60 Hz gravity convention with independent fixed simulation steps.
- Personal localStorage preferences are scoped to the browser origin/profile; no new account preference service or world serialization schema was introduced. Viewer restrictions remain the established existing tool policy.
