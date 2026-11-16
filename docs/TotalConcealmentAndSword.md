# Phase M1.4 — Total Concealment and Sword

## Player walkthrough

Open the inventory, choose **Passive Modifiers**, and click **Total Concealment**. The card changes from inactive to active, and the existing status HUD shows the active modifier. Click again to disable it. It starts disabled in each world session; saving a world never saves this modifier.

Insert a Brown Hare, enable concealment, and approach it. Any flight already underway finishes through its normal recovery state. Choose **Sword** in **Tools**, then close the inventory. Press the configurable **Use** action (default **R**) for one slash. Release and press again after recovery for another. Aim and crouch as needed: this is a physical short sword at camera height, so a small hare's legs require a low approach. The swing crosses a horizontal arc, rather than selecting whichever part is under a distant crosshair. A rear approach and the active hand determine which hind leg or ear the blade reaches first.

The existing anatomy inspector shows condition and effective movement/sensory capabilities. A hit on a healthy part reduces its condition from 1 to .65. A hind-leg injury reduces propulsion and hopping; an ear injury reduces hearing sensitivity and localization. Toggle concealment off to test the remaining senses. Debug condition controls remain Editor-only.

## Architecture and ownership

`GameViewDependencies/PlayerModifiers.mjs` provides a small player-owned registry and session store: stable identity, displayed label, active set, toggle, subscription, revision, diagnostics and disposal. Only `total-concealment` is registered. The inventory owns the store, exposes its existing passive category, and binds it to movement state. This does not introduce equipment progression or additional modifiers.

`actorPerceptible` is the shared attribution policy. It recognizes the current player-character ID and the reserved `session-player` fallback. Both the world sensory queue and the generic perception sampler use it. Species behavior consumes observations as before; no species-specific concealment conditional exists. A signal's `sourceId` identifies the emitting object/effect; optional `actorId` identifies its responsible actor. Arrow impacts retain their arrow ID and carry their shooter ID. Sword impact signals carry attack ID and player actor ID. New contact, rustle, scent or interaction emitters must preserve this attribution to participate; the filter cannot infer authorship from position alone.

Concealment filters direct vision, sound, visible events, scent and contact taste, including cached attributed observations. Other sources at the same location remain perceptible. Activation removes queued player events and current player observations/last sightings from all live mobs. It does not reset the behavior state machine, physics, gravity, collisions, damage eligibility, world geometry or rendering. Flight and recovery timers finish naturally. Disabling concealment allows the next normal perception sample to reacquire the player.

Diagnostics are available through `ctx.inventory.modifiers.snapshot()`, `ctx.sword.snapshot()`, and existing mob snapshots. `suppressedSignals` counts rejected attribution checks, including direct sight and cached observations; it is **not a count of distinct emitted sound events**. `awarenessInvalidations` counts removed queue events/observations. Perception snapshots retain bounded active observations and capability/CPU counters. Public observations omit private attribution metadata where hearing does not identify a source.

## Sword implementation

`SwordAbility` registers the inventory item, selected-item Use action, update callback and lifecycle cleanup before the Bow ability. The shared input router supplies configurable Use edges, ignores keyboard repeat, retains short taps and increments a cancellation revision on focus/visibility/pointer-lock changes. Pause transitions synchronously suspend the weapon through the existing pause adapter; cancellation does not depend on another render frame. The sword consumes that queue only while selected; the bow retains ownership otherwise. Menu/text entry, pause, world mismatch, permissions, unequip, pending teleport and disposal cancel attacks. No attack runs while paused. Sword and bow cannot activate together.

The procedural xiphos has a leaf-shaped double-edged blade, pointed tip, bronze guard/pommel and grip: five meshes/geometries, three materials, 5,024 geometry bytes. It is transient scene geometry, excluded from picking and authored objects/colliders. Model transforms and collision endpoints share `swordPose`; the blade remains depth-tested. A brief steel-color flash provides hit feedback.

| Parameter | Value |
| --- | --- |
| Total attack duration | 0.65 s |
| Wind-up | 0–0.12 s |
| Active strike | 0.12–0.34 s |
| Recovery | 0.34–0.65 s |
| Maximum camera-to-impact reach | 1.55 m |
| Blade length | 1.05 m |
| Damage | 0.35 normalized condition, `slashing` |
| Collision substep | at most 1/120 s |
| Catch-up limit | 0.1 s / 12 steps per update |
| Target ledger | at most 16 targets per active attack |

During active strike only, the current blade and four swept blade samples query the existing authoritative arrow collision adapter. Camera-to-hilt and camera-to-impact checks block strikes through walls/corners. The query uses source terrain occupancy and resident polygonal triangles, including unknown-source blockers; it never generates a distant chunk. Solid imported/construction meshes use their existing collision/picking geometry. Non-colliding decorations and helpers are excluded.

Melee requests exact anatomy proxy intersections. The existing coarse nearest-proxy silhouette fallback remains available to arrows/picking, but cannot invent a sword contact in a gap between anatomy boxes. Overlapping exact box entries retain the existing uncertainty diagnostic. This is the established anatomical approximation, not triangle-level flesh collision. Spatial sampling and bounded time catch-up have finite resolution; very fast teleports or animation discontinuities can exceed it.

One stable attack ID and a target set prevent repeated frame-based damage. The existing anatomy validator, source ledger and capability recalculation apply slashing damage. The amount is within the existing normalized (0,1] contract; remaining condition clamps damage at zero. The sword emits `nv-sword` hit feedback, while mob damage uses the existing `mob-damage` event. It never creates another damage model or terrain-edit operation. Solid interaction hooks receive `onMeleeHit`; Archery Targets reuse their existing target-hit/scoring handler where the contacted face qualifies. Solid terrain stops the strike without excavation.

Accepted injury supplies only an incoming impact direction to a short physical flee response. It gives no attacker coordinates or ongoing target identity. Concealed attacks still injure and impair; subsequent sensory observations cannot track the concealed attacker. Existing viability/immobility gates remain authoritative.

## Permissions, persistence and compatibility

Editor tool use follows the existing ability policy. A read-only Viewer denies sword use by default. A supported Viewer host must explicitly pass `viewPermissions: {authoring:false, gameplay:true}` **and** the world's existing `allowToolUse` rule must be true. This narrow sword opt-in does not relax any authoring, save, inspector-debug or general tool permission. Concealment itself grants none of those permissions. Damage and modifier state are session-only; authored mob data, undo state and terrain are untouched.

The collision adapter is shared with Archery rather than copied into a melee simulator. Automated checks cover finite/infinite signed source coordinates, voxel and polygonal surfaces, Smooth natural ground, map/hybrid terrain, construction cuts, unavailable source blocking and thin solid objects. The actual GameView fixture uses finite geographic terrain. Existing MetaWorld suites cover geographic boundaries, terrain composition, navigation, vegetation LOD, caching and authoring. No terrain/vegetation generation or representation logic changed.

## Verification and performance

Run focused tests with:

```sh
node --import ./scripts/register-browser-test-imports.mjs ApplicationSystem/public/PanelInstances/ViewPanels/GameViewDependencies/Sword/Sword.test.mjs
node scripts/test-m14.mjs
node scripts/test-m14.mjs performance
node scripts/test-m14.mjs native
```

The fixture uses a temporary Notebook and the existing Express static serving and GameView. It never writes `Notebook/test.html`. Production keyboard and mouse events pass through the actual input router. Raw results: [browser](TotalConcealmentSwordBrowser.json), [performance](TotalConcealmentSwordPerformance.json). The [native desktop result](TotalConcealmentSwordNative.json) passed the same scenario in a visible Electron window.

The 18 focused cases cover modifier state/attribution across all supported modalities; independent sources; queue invalidation; both hind legs, both ears and torso; source ID/damage type/deduplication; range, rear targets, walls; moving targets at 30/60/120 Hz; recovery; idle queries; capped catch-up; controller repeat/focus/pause/typing/unequip/disposal; Viewer policy; solid hooks/targets, real Archery Target scoring without authored changes; and terrain compatibility. Existing shared-input tests also test remapped Use, sub-frame taps, repeat, typing and visibility/lock loss.

Production checks exercise inventory-card activation, normal perception/flight then concealed recovery, walking/running, attributed indirect sounds, held-R leg and ear hits with actual GLB anatomy, movement/hearing impairment, post-impact lack of sensory tracking, restored perception on disabling, bow drawing, tool switching, pause, save/reopen, read-only Viewer and cleanup. Controlled damage checks freeze only target pose and disable player gravity in the fixture to make small-region aiming repeatable; normal navigation/recovery is checked separately.

### Paired benchmark

Two trials reverse mob-count and concealment order. Each case has 60 warm-up plus 300 measured real RAF frames, 30 Hz simulation steps, and 10 measured simulation seconds. Sixteen cases cover 1/5/20/50 mobs, concealment off/on, attributed running events, repeated attacks at the first mob and wandering/fleeing neighbors. Actual shared Rabbit GLB; 640×480 SwiftShader; flat authoritative support. Terrain/vegetation rendering is excluded to isolate these features. Injuries accumulate and can disable the attacked mob's locomotion; concealment changes sensing and flight workload, so this measures the resulting gameplay paths rather than equalized AI work.

| Mobs | Mob CPU off / on (ms/frame, range over trials) | Sword CPU off / on (ms/frame) |
| --- | --- | --- |
| 1 | 0.129–0.260 / 0.111–0.201 | 0.064–0.127 / 0.062–0.100 |
| 5 | 0.499–0.689 / 0.257–0.380 | 0.079–0.103 / 0.083–0.109 |
| 20 | 1.573–1.892 / 0.755–0.824 | 0.074–0.092 / 0.129–0.152 |
| 50 | 3.304–3.402 / 1.497–1.573 | 0.179–0.208 / 0.182–0.196 |

At 50 mobs, perception totals including warm-up were 314–319 ms off versus 48–55 ms on. Repeated melee collision queries totaled 53–62 ms per case; sword update includes pose and collision CPU. The report separately records anatomy intersection CPU, signal counts, LOS queries, draw calls, triangles, render-submission CPU, mean/p95/max frame time and memory estimates. Idle unit tests perform zero collision queries.

Mean frame time at 50 mobs was 17.06–17.39 ms off and 16.67–17.17 ms on; p95 was 21.3–22.7 ms off and 16.9–17.1 ms on. Smaller cases were near the RAF pacing floor. Do not interpret these numbers as a hardware rendering speedup: software rasterization, scheduling, culling, flight motion and JIT warm-up affect results. No GPU timer was measured. CPU timings are wall-clock, and resource-byte estimates are not measured JS heap ownership.

Sword costs up to five extra draws while visible; observed final total draws were 6/10/25/54–55 for 1/5/20/50 mobs, with culling accounting for one varying draw. Every case returned renderer geometry/texture allocations and active target-ledger size to zero after cleanup. The raw report records GPU allocation counts, 5,024 sword geometry bytes and estimated anatomy-state bytes. These checks do not prove absence of every possible JavaScript heap leak.

## Limits and remaining work

No skeletal player animation, directional combos, armor, combat progression, additional species, predator ecosystem or additional modifiers were introduced. Smell/taste/rustle filtering supports attributed events, but this phase does not invent scent diffusion, vegetation audio or a global object-contact emitter. New emitters must supply actor attribution. Unattributed independent signals intentionally remain perceptible.

Native desktop verification uses an isolated Electron window hosting the actual GameView fixture, not the complete authenticated Nodevision desktop shell. Software-renderer results do not establish hardware GPU cost or performance in a large rendered geographic/vegetated world. Dedicated hardware profiling and broader visual playtesting remain useful follow-up work.

### Final validation

- All **67 MetaWorld test files** and **11 GameView test files** passed; the final focused sword/modifier file separately passed **18 cases**.
- Chromium and visible Electron GameView integration both passed, including the world-rule-controlled Viewer opt-in, denied Viewer saves, hind-leg movement multipliers (speed **0.769**, jump **0.740125**) and ear hearing sensitivity **0.763225**.
- Existing production **Archery Bow**, **Archery Target**, and **Raycasting Teleporter** regressions passed, including voxel/polygonal travel, imported solid models, construction collision, scoring, persistence and cleanup.
- Native testing exposed a real pause race: cancellation previously waited for the next render update. The pause adapter now invokes cancellation synchronously. The final native run passed this check. Fixed-duration swing waits were also replaced by state-based completion checks. A Teleporter pending-request assertion failed during concurrent heavy test load and passed when rerun alone; no Teleporter collision/travel logic was changed to obtain that result.
- Electron used the existing X11 desktop and SwiftShader. Its isolated GameView fixture passed; a Chromium shared-image warning occurred during shutdown, after the pass. This is not a full authenticated desktop-shell test or a hardware GPU benchmark.
- `Notebook/test.html` SHA-256 remained `75533dd604cbacc1de34bd42e1e3c5a5faeef5f4779b51c520a2e0c0edd81292`. Original Rabbit GLB/OBJ/MTL/texture and attribution hashes were verified unchanged. No root-level `BuiltIn/`, production resource endpoint or filesystem asset registry was introduced.

[Validation evidence and source hashes](TotalConcealmentSwordValidation.json) identify the final implementation and raw reports. Historical anatomy/sensory reports remain distinct from the M1.4 measurements.
