# Phase M1.3 — Mob anatomy, damage and impairment

Current status: the **sensory amendment** below extends the initial structural baseline to 13 components and observation-driven perception. Earlier seven-part benchmark figures are historical.

Implemented for Brown Hare using the existing mob component/runtime, navigation, terrain queries, shared GLTF asset leases, editor inspector and Archery Bow swept projectiles. No additional species, hunting AI, medical simulation, loot, skeletal animation, ragdolls or independent projectile framework were added.

## Components and coordinates

`BrownHareAnatomy.mjs` declares the immutable species schema. `Anatomy.mjs` owns independent per-instance session condition, validation, response curves, capabilities and viability. `AnatomyCollision.mjs` owns analytic hit testing. `AnatomyProperties.mjs` extends the existing mob inspector. Species anatomy uses canonical metres, +Z forward, +Y up, +X the animal's **left** (the right side is −X). It references no GLTF mesh/node names. Rendering is an adapter into that canonical frame, so anatomy is not contingent on a skeletal model or mesh segmentation.

Each part declares a stable ID/name, optional parent, classification, local position/bounds, box hit-region shape, maximum condition, nonlinear response, damage-type multipliers, functional contributions, optional lateral/locomotor metadata and animation/collider bindings. Current condition, capacity and enabled state live in the instance processor. Optional capabilities are collected by name; no generic code assumes four legs, wings, fins or particular part IDs. A single-part wing schema is covered in tests, without implementing another species.

| ID | Role | Center (m) | Box size (m) |
| --- | --- | --- | --- |
| `torso` | vitality, endurance, general movement | 0, .225, −.065 | .255, .270, .360 |
| `head` | perception, coordination | 0, .315, .205 | .205, .305, .240 |
| `tail` | minor balance | 0, .190, −.302 | .100, .100, .046 |
| `foreleg-left` | balance, turning, recovery | .073, .065, .135 | .075, .130, .170 |
| `foreleg-right` | balance, turning, recovery | −.073, .065, .135 | .075, .130, .170 |
| `hindleg-left` | propulsion, acceleration, jump, recovery | .105, .085, −.160 | .100, .170, .230 |
| `hindleg-right` | propulsion, acceleration, jump, recovery | −.105, .085, −.160 | .100, .170, .230 |

All six peripheral parts have torso as parent; parenthood does not propagate damage. The calibrated rigid Rabbit GLB is still one mesh, 674 triangles, with no clips, skeleton or independent limbs. After normalization to .65 m length it measures approximately .308 × .468 × .650 m. Reading its position accessor confirms tall ear/head vertices around Z +.20 (Y up to .466), narrow muzzle around +.30, low feet at ±.10–.20, and rear mass at negative Z. Regions are deliberately low-detail proxies, not claims of exact anatomical surface segmentation. Changing a model adapter may require recalibrating the canonical body mapping.

## Structural condition and functional response

Brown Hare maximum structural condition is 1. For normalized condition `n`, capacity is zero at or below .10, otherwise `n²`. Thus .50 condition has .25 functional capacity, rather than .50 speed. Partial injury is `0.1 < n < 1`; severe damage near .1 has very low function; `n <= .1` disables the part function completely. Structurally intact is 1. Debug repair can restore a part.

Each named capability starts at 1 and loses `weight × (1 − capacity)` from each contributing part, clamped to [0,1]. Weights are declarative in the species module. Hind legs each supply .40 propulsion/.40 acceleration/.45 jump/.20 recovery/.12 balance; forelegs supply .28 turning/.25 recovery/.18 balance each. Torso supplies vitality 1, endurance .8 and smaller movement contributions. Head supplies perception 1 and coordination .75. Tail contributes only .04 balance.

Effective speed is `propulsion × (.5 + .5 × endurance) × (.6 + .4 × coordination)`. Acceleration and jump use their respective capacities. Turning combines turning capacity, coordination and a small balance factor. Hop cycle duration is multiplied by `1 + (1 − recovery) × 1.5`, lengthening landing/recovery. Balance loss adds at most .025 rad of bounded cyclic compensation; complete tail loss therefore adds only .001 rad and slightly lowers turning, without affecting speed or vitality. Effective player detection/flee radii scale with perception. Decision spacing rises from .2 s to at most .8 s as coordination declines.

Side-specific propulsion loss contributes to a signed roll (at most .10 × weighted lateral loss), applied smoothly within the hop. Right-hind injury rolls oppositely to left-hind injury. This changes body motion, not heading choices. There is no injury-induced steering impulse or repeated left/right turn selection. Existing navigation commit, progress, rejection memory and staggered recovery remain in place.

With one hind leg at .5: propulsion/speed and acceleration are .70, jump is .6625, recovery duration ×1.225, and signed compensation magnitude .03 rad (before minor balance compensation). These modifiers affect actual translation, velocity approach, hop lift and rendered motion. Completely disabling both locomotor parts sets `mobile=false`; runtime reports `Immobile`, clears hop/speed and suspends navigation rather than issuing unreachable goals. Gravity/support still operate.

## Viability and inert states

Whole-mob state is Active, Impaired, Incapacitated or Dead. Any structural injury makes an otherwise viable hare Impaired. Torso condition zero causes Dead; head at or below .08 causes Incapacitated; mean structural loss of at least .72 also incapacitates. These vital/cumulative rules are species declarations. Destroying a leg or tail does not kill the animal. Dead/Incapacitated states stop active decisions/navigation/hopping and use a small static rigid tilt; falling still works and existing collision ownership remains. This is not a ragdoll or medical model.

## Collision and arrows

The existing broad player collider remains. A separate conservative arrow AABB includes its bounds and the canonical anatomy bounds transformed by the visual pivot. Only an arrow segment intersecting this broad box invokes the part sweep. There are no per-frame projectile/part cross-products, per-part Three.js meshes, GPU resources or collider registrations.

Narrow phase transforms the segment into the visual pivot's local frame, finds the nearest intersection among seven boxes and transforms its hit/normal back to world coordinates. It follows root translation, runtime yaw, instance/ancestor scale, vertical hop/fall, procedural pitch, squash and injury roll. Equal-distance ties use stable schema order and flag uncertainty. A broad-silhouette gap that intersects anatomy's overall bounds can use the nearest proxy to the entry point; this explicitly reports `anatomyUncertain=true` and `anatomyMethod='nearest-proxy-fallback'`, instead of unconditionally assigning torso. A normal proxy hit reports `proxy-box`. These approximate regions can report a part before the visible polygon surface; low-detail accuracy is a known limitation.

Archery `Flight.mjs` passes the resolved part and uncertainty through its existing impact path. Embedded arrows attach to the visual pivot, following the same rigid body motion as the hit regions. Prediction and collision classification are read-only; only the authoritative flight impact calls damage. Existing target scoring/attachment is separate and preserved. Flight IDs include a controller instance serial so source IDs do not repeat if controllers are recreated in the same module session.

## Damage interface and notifications

```js
mobRuntime.applyDamage({
  targetId: mobId,                   // optional assertion; mismatches rejected
  bodyPartId: 'hindleg-right',
  amount: 0.5,                       // normalized loss, strictly (0, 1]
  damageType: 'piercing',
  sourceId: 'attack-unique-id',       // required nonblank string, <=128 chars
  impactPoint: [x, y, z],            // optional finite 3-vector
  impactDirection: [dx, dy, dz]      // optional finite 3-vector
});
```

Damage is applied synchronously, validates identity/part/amount/type/source/vectors, deduplicates source IDs per target, clamps condition at zero and recomputes capabilities once. Brown Hare accepts piercing/cutting ×1 and blunt ×.8; unknown types are rejected. Amount scales by the part maximum and resistance. Arrow loss is `.38 × clamp(impactSpeed / 30, .25, 1.5)`. It is a modest initial tuning rule, not a ballistic wound model.

The source ledger retains at most 4096 IDs per mob; at capacity, new damage is rejected and diagnosed rather than forgetting IDs and allowing replays. This explicit session cap and eight recent error messages bound memory. Calling the same event or impact again cannot apply the same source twice. Successful damage emits `mob-damage`; arrow impacts additionally emit the existing `mob-hit` with stable `bodyPartId`, source, condition loss and viability state. Events report results and do not themselves authorize or apply damage. Other attack mechanisms can call this same validated processor later.

Snapshots include per-part condition/capacity/enabled, aggregated capabilities, movement modifiers/asymmetry, vitality/viability, last hit part/source, bounded errors, source count and narrow-phase counters/timing. Snapshot data is copied, not a mutable reference to authoritative condition. Generic processing does not hardcode Brown Hare IDs.

## Inspector, permissions and persistence

The existing mob inspector has an Anatomy table showing all seven condition/capacity pairs, vitality, mobility, effective speed/jump/acceleration/turning/recovery/perception and viability. Editor-only numeric test-condition controls accept 0–1; they can damage or restore a leg without constructing attacks or authoring undo records. Existing inspector editing holds freeze behavior; close Inspect / Modify to observe consequences. Runtime debug entry points check authoring permissions again. Viewer has no debug controls and cannot use debug repair, but legitimate gameplay damage still works.

Injuries are **session-scoped**. There is no existing dedicated gameplay-state persistence store to reuse. Damage/repair never writes the authored world, changes the home transform or creates history entries. Ordinary same-runtime property changes retain condition; duplication, undo reconstruction and save/reopen create new healthy runtime state. Species identity, mob identity, authored transforms/configuration and links follow existing serialization. No anatomy schema, condition, source ledger, animation pose, matrices or scratch collision data are serialized into each authored instance. Reset-on-reconstruction is an explicit limitation until gameplay persistence exists.

## Validation and measurements

The 19 passing cases in `Anatomy.test.mjs` cover seven stable IDs and anatomical sides; per-part head/torso/tail/four-leg ray classification; nearest proxy choice; transformed/scaled/hopping proxies; uncertain gap fallback; broad-phase rejection; nonlinear response, type handling, invalid amount/source/vector/identity, duplicate source and bounded ledger; left/right sign; bilateral immobility; foreleg/head/torso/tail effects; non-quadruped capability names; real swept arrows and visual attachments; independent instances; Editor/Viewer debug permissions; session reconstruction; disposal; actual slower/lower fleeing; actual perception changes; pause/editing condition retention; and injured wall detours/enclosed retry stability. Existing mob, gravity, aim placement, navigation, terrain/source coverage and Archery tests remain part of the relevant suites.

`node scripts/test-mob-anatomy.mjs` uses a temporary Notebook, actual GameView, real Google Rabbit GLB, geographic terrain, existing inspector, trusted bow key input and actual arrow flight. It checks healthy → right-leg injury → repair movement, a known right-hind-leg shot and once-only damage/event, injured fleeing, bilateral stopping without planning, incapacitation/death, a second independent hare, world save/reopen reset policy, Viewer gameplay/debug permissions and world cleanup. Raw results: `MobAnatomyBrowser.json`. The final roughly five-second-simulation runs measured 13.98 m healthy vs 9.66 m at .5 right-hind condition; peak hops .180 vs .119 m; repaired travel 14.65 m. Left-hind injury produced 9.56 m travel and opposite roll compensation. Raw results include exact simulated/wall durations, since RAF sampling can overshoot five seconds by one fixed step.

`node scripts/test-mob-anatomy.mjs performance` measures two trials in reversed count order, 60 warm +300 measured RAF frames per case (10 measured simulation seconds at fixed 30 Hz), real shared GLB, 640×480 Chromium/SwiftShader. Scenarios: one healthy, one injured, 5/20/50 mixed. Each hare has a chasing player probe and authoritative flat support. Terrain/vegetation rendering is intentionally excluded to isolate mobs; this is not an overall-world FPS comparison. One potential directed hit/mob every 30 frames exercises narrow phase; all other probe frames miss broad phase. No damage is applied inside measured frames. Raw: `MobAnatomyPerformance.json`.

| Case | Mean update ms | Mean animation/bounds ms | Mean ground/clearance ms | Mean render submission ms | Draw calls |
| --- | ---: | ---: | ---: | ---: | ---: |
| 1 healthy | .109 | .027 | .020 | .128 | 1 |
| 1 injured | .085 | .020 | .011 | .119 | 1 |
| 5 mixed | .184 | .048 | .032 | .155 | 5 |
| 20 mixed | .587 | .166 | .152 | .273 | 20 |
| 50 mixed | 1.171 | .291 | .413 | .388 | 50 |

These are two-trial mean values, not proof that injury intrinsically makes updates faster. At 50 hares worst-trial update p95 was 2.5 ms; amortized arrow-probe batch mean .028 ms. Narrow phase averaged about .0012 ms/query for 50, versus .004–.013 ms at one, where timer precision and tiny sample counts dominate. Frame means were about 16.65–16.69 ms under software-renderer pacing; **no hardware GPU/FPS claim** follows. Render time is CPU submission wall time, not a GPU timer. Anatomy contributes no draw calls; model count still determines draws/674 triangles each.

Healthy anatomy JSON snapshot size was 878 bytes per hare in that run; 50 mixed totaled 46,350 bytes. The source-free state accounting estimate was 224 bytes/instance, explicitly excluding JS object/Map overhead, shared schema and hit-test scratch; this is not a measured retained heap size. Raw fields report serialized bytes and the estimate separately. Injury is precomputed on change, not per frame. All ten benchmark cases returned renderer geometry/texture counts to zero after disposal. Browser variability, GC and coarse timer precision limit small-cost comparisons. No historical Phase E1/M1.1 measurements were relabeled as anatomy benchmarks.

`Notebook/test.html`, the original GLB/OBJ/MTL/texture and attribution are preserved. Validation provenance and exact check results are recorded in `MobAnatomyValidation.json`.

Final checks: all 66 MetaWorld test files and 10 GameView dependency test files passed, as did production anatomy, existing Archery Bow and existing Archery Target browser regressions. Historical M1/M1.1 validation hashes describe earlier revisions; `MobAnatomyValidation.json` records the current M1.3 source/evidence hashes.

## M1.3 sensory amendment — current anatomy and perception

This amendment supersedes the initial seven-part anatomy and scalar perception model above. Brown Hare now has **13** parts, using the same condition processor, normalized damage rules, source ledger, restoration controls and session persistence. The original seven remain structural parts. Six sensory parts are children of `head`:

| ID | Center (m) | Box size (m) | Function |
| --- | --- | --- | --- |
| `eye-left` | .082, .307, .215 | .035, .038, .048 | Left visual detection/field/range |
| `eye-right` | −.082, .307, .215 | .035, .038, .048 | Right visual detection/field/range |
| `ear-left` | .042, .414, .170 | .052, .107, .075 | Left external-ear collection/localization |
| `ear-right` | −.042, .414, .170 | .052, .107, .075 | Right external-ear collection/localization |
| `nose` | 0, .267, .315 | .065, .049, .024 | Smell sensitivity and scent detection |
| `tongue` | 0, .239, .276 | .036, .014, .025 | Contact taste discrimination |

The head's coarse proxy is now centered at (0, .285, .210), size (.150, .160, .230). The earlier oversized head box encompassed ears/eyes and would intercept their rays before those organs. The smaller head core and calibrated exposed organ boxes resolve nearest physical proxy entry, without artificial sensory priority. Eyes protrude laterally, ears vertically, and nose slightly forward. The tongue is defined/damageable through the generic processor, but marked `exposed:false` and excluded from ordinary external projectile classification and gap fallback. No mouth animation currently exposes it. The rigid GLB still displays eyes/ears after functional loss; this phase does not cut away or hide injured geometry. All exposed regions follow the existing visual pivot; no per-organ mesh, skeleton or collider registration is introduced.

### Capabilities and observations

`Perception.mjs` derives named sensory capabilities from anatomy and declarative species configuration. It supports absent modalities without granting phantom senses or requiring a fixed set of organs. The immutable `senses` configuration declares eye axes/fields/ranges, auditory collection/residual function/range/threshold/obstruction, smell/taste reception parameters and behavior thresholds. Nose/tongue/eye/ear damage uses the same squared capacity curve and disabled threshold as limbs. Head central perception still modulates signal processing and visual range; losing an eye or external ear does not damage the head or unrelated modalities.

Vision uses two 180° horizontal eye fields centered at ±80° (340° healthy union with a 20° rear blind sector), 120° vertical field and nominal 10 m range, scaled by authored detection radius. Each eye's range scales with square root of its capacity, and its field with `.35 + .65 × capacity`; a disabled eye contributes no field. Left-eye loss removes the animal's +X-side coverage; the intact right eye remains useful. Both blind eyes remove visual detection while hearing/smell/taste continue. Position, direction, field, range, a small movement-confidence bonus and authoritative line of sight determine a visual observation. Only a visually confirmed current player is recognized as `player`; emitted generic visible movement remains unrecognized.

`SensoryOcclusion.mjs` reuses Archery's authoritative source/mesh sweep with owned collider AABB filtering. It excludes the observer/other mob proxies and editor helpers. Owned solid geometry and terrain block sight; unready occupancy is conservatively occluding. Decorative geometry without a collision owner does not occlude, matching the existing projectile ownership policy. There are no full-scene mesh raycasts in every direction. Vision has one current-player candidate per perception step, plus explicitly emitted visible signals. This is not a general multi-actor visual search or a lighting/contrast simulation.

Hearing attenuation is `intensity × sensitivity / (1 + (distance / 4)²)`, within 16 m, with threshold .055. Supported obstruction multiplies strength by .45. External-ear collection is `(.18 + .82 × mean ear capacity) × central perception`. Thus loss of one healthy external ear leaves .59 sensitivity; bilateral external-ear loss leaves .18, representing residual deeper hearing rather than inventing complete deafness. Localization is `.15 + .55 × min ear capacity + .30 × mean ear capacity`, also modulated by central perception. Missing-ear side biases the estimated bearing; otherwise a fixed source-dependent sign provides a deterministic approximation. Error is bounded by `(1 − localization) × .7 rad`. One-ear loss therefore worsens collection and bearing uncertainty while vision remains intact. Sound observations never disclose source identity or precise source distance/position; they report an estimated direction, near/far band, confidence and angular uncertainty. Healthy ideal localization may have zero angular error, but never supplies exact range/identity.

Smell is a minimal receptive-signal interface, not odor transport: producer-supplied scent signals within 6 m are gated by nose-derived sensitivity/detection and a .12 threshold. Confidence uses intensity and those two capacities. There is no wind, scent trail diffusion, predator recognition or food investigation AI yet. Taste requires an explicit matching mob contact ID **and** a position within .3 m; tongue capacity gates discrimination. It cannot detect distant food or provoke long-range threat awareness. Future interaction producers must attest contact; this phase does not implement feeding physiology.

Perception produces up to eight observations with modality, confidence, detection time, direction/uncertainty where meaningful, visual confirmation and identity only when recognized. Recent observations last 1.5 simulation seconds. Last sound/visual records remain as bounded diagnostics. Authored pose resets clear active observations so a sighting from the previous pose cannot initiate an unrelated escape; last diagnostic records remain inspectable. Injury condition is never reset by these operations or by fleeing/recovery.

### World signals and behavior

`SensorySignals.mjs` uses a world-local spatial queue and the existing GameView panel's `mob-sensory-signal` event. It adds no global event bus or resource-serving endpoint. Example producer:

```js
panel.dispatchEvent(new CustomEvent('mob-sensory-signal', {detail: {
  type: 'sound', sourceId: 'actor-or-impact-id', category: 'vegetation-rustle',
  position: [x, y, z], intensity: .8
}}));
```

Supported types are `sound`, `visible`, `scent`, `taste`. Sound categories include `footstep`, `running`, `vegetation-rustle`, and `impact`. Input position/intensity/source/type are validated; intensity must be in (0,4]. Positions must be finite and within ±10¹² m per coordinate; invalid/extreme queries are rejected to keep spatial iteration bounded. The world owns time, so callers cannot extend signal lifetimes by choosing timestamps. Taste additionally uses `contactId`. The module-level pure queue also accepts explicit time for deterministic tests.

The GameView update samples actual grounded player displacement once per frame. Walking emits intensity .4 at most every .5 s; speed above 3.5 m/s emits running intensity 1 at most every .28 s. Teleport-like speed above 12 m/s and airborne motion emit neither. World pause freezes the signal clock and resets the displacement reference. This is a documented sound approximation, not generated audio or footfall animation. Actual arrow impacts emit an .8 impact sound through the same panel. Vegetation rustles, generic visible movements, scents and food contacts have working producer interfaces and tests; automatic bush-contact and feeding emitters are future work.

`Behavior.mjs` now consumes observations instead of raw omniscient player coordinates. A confirmed nearby player can provoke fleeing; unrecognized sounds can provoke Alert. A sufficiently strong running/impact observation (confidence ≥ .30) can provoke flight without granting identity. An unexplained rustle remains an alerting signal even when loud. Sight/sound alert threshold is .15. Existing authored `flee:false` suppresses fear behavior. Stale threat observations expire and the existing Fleeing → Recovering → Idle/Grazing/Wandering transitions remain. Uncertain heading changes commit for .9 s, and the existing stable navigation/turn-rate/stuck-recovery controller remains in charge of actual movement. Recognition policy is separate from signal acquisition; no magical `fox-nearby`/`predator-nearby` event exists.

The navigation regression fixtures now explicitly provide running sounds for a chasing player, rather than depending on detection through the new rear blind sector. The stationary fixed-cadence fixture starts with one audible running step and lets it expire. No raw-player bypass was retained in production behavior.

### Inspector, lifecycle and bounds

The Anatomy table lists all 13 components and uses the existing Editor condition controls for damage/restoration. A collapsed **Sensory capabilities and observations** disclosure displays derived vision/hearing/smell/taste values, recent observations, last perceived sound direction, last visual confirmation and confidence. **Test sound behind hare** produces a deterministic .8 footstep 3 m behind it and samples perception while inspection safely holds movement. The disclosure stays open across updates. Viewer cannot use condition restoration or this developer test method, while legitimate sensory damage/signals remain gameplay operations. Close Inspect / Modify to observe movement responses.

There are at most 128 world signals, 1.5-second lifetimes, 8 m spatial cells, a 32 m maximum query radius, 16 returned candidates per spatial query, at most eight processed per hare perception update, eight recent observations and one last record per sight/sound. The normal perception cadence uses the existing .2 s decision tick, slowed by coordination injury. Stable identity-based offsets spread healthy decision work over six 30 Hz phases instead of synchronizing entire groups. Disabled behavior, immobility/incapacitation, pause/editing and the existing 64 m activation distance suppress normal perception work. It is not an every-frame all-mob/all-actor scan. World cleanup removes the panel listener and clears the queue; mob cleanup clears observation records and retains existing asset/collider disposal. Injuries keep the existing session-scoped policy: ordinary damage does not write a world document or undo entry, persists through normal behavior transitions, and resets only on explicit restoration or runtime reconstruction/reopen.

### Sensory validation and performance

The 16 passing cases in `Sensory.test.mjs` cover 13 IDs/head attachment, independent eye/ear conditions, capability calculations, healthy field/range/vertical limits, unilateral/bilateral blindness, real owned-geometry occlusion, hearing attenuation/collection/localization, side-dependent injury, footsteps/running/rustle modalities, scent and contact-only taste, deterministic observations, signal caps/expiry/replay, observation-driven alert/flight with heading commitment, exposed eye/ear/nose proxies, internal tongue policy, grounded movement producer, world disposal, omitted modalities, skipped work for disabled/distant/paused mobs, identity-based update staggering, and plain min/max collider-bound compatibility. Existing 19 anatomy, 13 navigation and 13 mob tests remain in the suite.

`node scripts/test-mob-anatomy.mjs senses` exercises actual GameView/GLB/terrain, 13-part inspector/test-sound control, healthy visual detection, the rear blind sector, an unseen controlled footstep before/after losing one ear, side-specific eye loss with remaining senses, rustle Alert/strong running Flee without rapid steering flips, a trusted bow shot resolving `ear-right` exactly once, continued injury after flight/recovery, save/reopen policy, Viewer permissions and cleanup. It always uses a temporary Notebook. Evidence: `MobSensoryBrowser.json`.

`node scripts/test-mob-anatomy.mjs senses-performance` uses two reversed-order trials with 60 warm +300 measured RAF per case, fixed 30 Hz replay, actual shared GLB and 1 healthy/1 injured/5/20/50 mixed hares. It adds 5 Hz spatially queued running sources, bounds input at 128 events/16 spatial candidates and eight processed signals per hare sample, measures perception and LOS counters alongside existing update/render/part-hit costs, and checks geometry/texture cleanup. Sources have distinct actor IDs so a hare correctly ignoring its own sound does not accidentally turn the one-hare case into a no-signal benchmark. Raw evidence: `MobSensoryPerformance.json`. Rendering/frame results remain Chromium/SwiftShader CPU submission/software pacing, not hardware GPU timings or an overall terrain/vegetation FPS claim. Scent/acoustic propagation, arbitrary scene visibility and multi-actor ecology remain intentionally unimplemented.


Final two-trial sensory benchmark (milliseconds):

| Case | Mean mob update | Worst-trial update p95 | Perception/sample mean | Mean RAF frame | Draw calls |
| --- | ---: | ---: | ---: | ---: | ---: |
| 1-healthy | 0.226 | 0.70 | 0.192 | 16.83 | 1 |
| 1-injured | 0.197 | 0.60 | 0.180 | 16.83 | 1 |
| 5-mixed | 0.538 | 1.40 | 0.182 | 17.16 | 5 |
| 20-mixed | 1.543 | 3.90 | 0.167 | 18.98 | 20 |
| 50-mixed | 3.117 | 7.70 | 0.130 | 22.01 | 50 |

The mixed-condition cases pre-injure hind legs; sensory organs remain healthy to exercise active perception work. Sensory-injury effects are checked separately in unit/production scenarios. One-hare cases each processed 60 sound signals including warmup. At 50 hares, the first trial processed 23,739 signals and made 25,206 sight/sound LOS queries across warmup plus measurement; processing remained at most eight signals per sample. Every case returned renderer geometry/texture counts to zero. The final 50-hare anatomy JSON total was 71,400 bytes (13-part injury state only, excluding observations/JS heap overhead).

The initial unphased, 16-signal implementation averaged 3.600 ms update at 50 hares with worst-trial p95 16.3 ms. Retained evidence: `MobSensoryUnstaggeredPerformance.json`. Stable identity phases plus an eight-signal hare budget reduced the tail to 8.1 ms (`MobSensoryStaggeredPerformance.json`), while mean update stayed 3.519 ms. Profiling also found the reused arrow sweep rebuilding its collider index from the entire scene for each LOS ray despite existing candidate filtering. Passing only candidate colliders into that index lowered final mean update to 3.117 ms and worst-trial p95 to 7.7 ms; mean perception/sample at 50 fell from .195 ms in the intermediate run to .130 ms in the final run, with identical processed-signal/LOS counts. The new phase-distribution unit test checks that a 12-mob cohort does not sample all at once.

These runs demonstrate bounded work and reduced synchronized CPU spikes, not universal FPS improvement. The eight-signal budget intentionally drops older candidates under saturation. Geometry CPU/GPU and SwiftShader scheduling still matter: final frame mean at 50 was 22.01 ms, versus 18.61 ms in the intermediate run, despite lower measured CPU update time. The isolated software renderer cannot establish hardware FPS or costs in a heavily populated terrain/import scene. LOS still scans authoritative collider bounds before narrow queries, and large real scenes may cost more than this flat-support fixture. No acoustic transport, full-world performance guarantee or completion of prior Phase E1 GPU bottlenecks is claimed.

Final sensory evidence is `MobSensoryValidation.json`; the complete MetaWorld suite passed 67 test files, GameView dependencies passed 10 test files, and dedicated sensory coverage passed 16 cases. Actual GameView sensory and structural-anatomy scenarios plus the existing Bow/Target browser regressions passed. Original model/license files and `Notebook/test.html` retain their prior hashes.
