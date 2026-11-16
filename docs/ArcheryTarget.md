# Archery Target

## A. Architecture

`archery-target` is an ordinary authored MetaWorld object, owned by the existing scene, object array, collider array and layer entries. The implementation is in `ApplicationSystem/public/MetaWorld/ArcheryTarget/`. The existing Insert → Game Object category now contains **Archery Target**. No additional object registry or projectile simulator was introduced.

Placement uses the camera aiming ray and existing ground/terrain APIs, with the normal default insertion distance as fallback. It checks authoritative height, source coverage and map readiness. The face initially points toward the camera; it does not track the player afterward. Upward normals must have Y ≥ 0.65 and the three stand feet must agree with the loaded surface within 0.15 m. Unsupported ground is rejected rather than extending coverage or forcing terrain generation. Signed world coordinates are retained independently of terrain chunks.

## B. Geometry

The default target has a 1.2 m diameter, face center 1.5 m above its origin, 0.12 m thick backing and a wooden tripod. Local X/Y span the face; +Z is the front. Five rings and the backing/stand are merged into one indexed, vertex-colored mesh with one MeshStandardMaterial. The default mesh has **632 triangles and 72,048 bytes of typed geometry storage**. Equal shape definitions share reference-counted geometry and material; the last owner disposes them. Editing shape parameters replaces a lease. Transforms, scores and hits do not rebuild geometry.

The default radius fractions are 0.2/0.4/0.6/0.8/1.0 with yellow/red/blue/black/white colors and scores 10/8/6/4/2. One definition drives rendering and scoring. These are game defaults, not official competition rules.

## C. Editing

Selection, transform gizmos, existing scale controls, history and serialization use the established editor. A target-specific section in the existing inspector exposes name, diameter, face height, stand visibility, scoring enabled, feedback, label, Greek value and each ring's radius percentage/score, plus duplicate/delete. Standard educational associations remain available. Duplication creates a fresh ID and retains settings/associations.

Validation rejects nonfinite transforms, nonpositive scales, invalid dimensions and configurations other than five increasing radii ending at 100%. Scales are limited to 0.01–100, diameter to 0.1–10 m, scores to 0–1000. Generic material editing does not replace the target's fixed ring material.

The world loader, save serializer and history reconstruction preserve IDs, transforms, ring settings, visibility, metadata and associations. Runtime arrows and feedback are excluded. Ordinary hits do not create history entries or change the source definition. Viewer authoring mutations are blocked by the existing permissions wrapper; inventory availability follows existing Viewer policy.

## D. Collision and scoring

The authoritative board is a closed analytic cylinder. Rays transform into target-local space; caps and rim are intersected, then compared by world-space distance. Cached world bounds reject distant/missed targets before detailed work. Stand hits use its modest triangle mesh and participate in nearest-hit selection. Player collision uses the existing mesh collision adapter. Arrow sweep and ordinary raycasting share this target intersection rather than repeating independent queries.

Only incoming front-face impacts score. Back, rim and stand remain physical, nonscoring impacts. The local scoring center is `(0, faceHeight, thickness/2)`. Radius is `hypot(localX, localY-faceHeight)`; normalization divides by diameter/2. Exact boundaries award the inner ring, with a normalized tolerance of 1e-9. Outside-face impacts produce no target score event. Translated, elevated, rotated, uniformly scaled and positive nonuniformly scaled targets are supported.

## E. Bow integration

The existing bow owns gravity, integration, prediction, swept collision and first impact. Its collider adapter invokes the target's analytic sweep. The flight system delivers a single interpreted impact, retains the incoming orientation and stores the attachment in target-local coordinates. Embedded arrows follow target transforms, including while editing pauses physics. Deleting the target immediately removes attached arrows. Existing limits of 16 flying and 64 embedded arrows remain in force.

The production test uncovered an existing controller lifecycle issue: replacing the world-definition object during an ordinary edit cleared all arrows. World transition detection now uses the world path; ordinary edits preserve the flight session. Attachment-only updates do not advance projectile physics.

The GameView panel emits `archery-target-hit` as a CustomEvent. Its detail includes targetId, targetLabel, greekLetter, arrowId, shooterId when available, ringId, score, radialDistance, normalizedRadialDistance, localPoint, world point/normal, incomingVelocity, launchForce, launchSpeed, flightDuration, traveledDistance, timestamp and simulationTime. The existing `arrow-hit-object` event also contains `targetHit`. No competition scoreboard or lesson evaluation is implemented.

Optional feedback uses existing world text for a brief points indicator. Each target has at most one active indicator; repeated hits reset it. Its timer disposes the text after one second. Deletion clears the timer and resources.

## F. Greek alphabet compatibility

The optional label and Greek-letter metadata are distinct authored Unicode strings, empty by default. Existing world-text rendering displays the label above the target. It does not cover the bullseye. Stable object identity is independent of the displayed letter. Standard object-to-document associations persist; no separate educational panel or text engine was added. The browser test preserves β and an educational link through duplicate, history and save/reopen.

## G. Performance

[Raw measurements](ArcheryTargetPerformance.json): actual Chromium WebGL with SwiftShader, 640×480, 30 warm-up and 120 measured RAF frames per case, ten swept queries per frame, two trials with reversed count order. Each query aims through a target. Labels/feedback are disabled in this geometry benchmark. Results below average the two trials; percentile columns average per-trial percentiles rather than pooling samples.

| Targets | Draws | Triangles | Mean frame ms | Query mean / p95 ms | Serialize / reconstruct ms | JSON bytes |
|---:|---:|---:|---:|---:|---:|---:|
| 1 | 1 | 632 | 16.667 | 0.0179 / 0.030 | 0.25 / 0.40 | 630 |
| 10 | 10 | 6,320 | 16.666 | 0.0288 / 0.050 | 0.20 / 0.65 | 6,286 |
| 50 | 50 | 31,600 | 17.081 | 0.0487 / 0.080 | 0.35 / 1.50 | 31,506 |
| 100 | 100 | 63,200 | 16.858 | 0.0608 / 0.090 | 0.25 / 1.85 | 63,081 |

All cases used one resident geometry (72,048 typed bytes), returning to zero after cleanup. These bytes exclude object bookkeeping, bounds, materials, labels, textures and driver allocation; total object memory was not measured. Collision lookup now builds a reusable object-to-collider map rather than searching the collider array for every object. Cached transformed AABBs avoid inverse transforms and stand intersections on broad-phase misses.

One target remains one draw call, preserving independent editing/culling; this is not global instancing. Labels and active feedback add text rendering resources. RAF timing is dominated by pacing and software-renderer variability: the slower 50-target second trial demonstrates that these figures do not establish a hardware FPS improvement. Serialization/reconstruction excludes disk/network and is separate from the successful production save/reopen test. This feature does not resolve or reclassify the earlier large-world distant-terrain performance deficit.

## H. Testing

Final checks on 2026-11-15:

- `npm run test:metaworld`: 294 tests passed, zero failures.
- GameViewDependencies tests with the existing browser import resolver: 41 passed, zero failures.
- Target-focused tests cover shared geometry/disposal, all rings, exact boundaries, misses, transformed scoring, front/back/rim/stand collision, first impact, tip/orientation, attachment movement/deletion and player collision. Placement tests exercise finite/infinite procedural, geographic, map and hybrid source interfaces, signed coordinates, coverage, readiness and rough-ground rejection.
- `node scripts/test-archery-target.mjs`: production GameView, real insertion button and inspector, Unicode editing, transforms, duplicate/delete/history, trusted actual bow input in voxel and polygonal modes, scoring, attachment movement without record loss, cleanup, source preservation, save/reopen and Viewer passed. [Hit evidence](ArcheryTargetBrowser.json).
- `node scripts/test-archery-target.mjs performance`: all eight scaling cases passed, including resource cleanup.
- `node scripts/test-archery.mjs`: existing production bow regression passed.
- `node scripts/test-raycasting-teleporter.mjs`: existing geographic/LOD, terrain modes, imported GOX/STL/glTF/GLB, construction, permissions and save/reopen regression passed.

The browser uses the production GameView modules in Chromium with SwiftShader and trusted input through CDP. It is not a native Electron or hardware-GPU test. The five-source placement matrix uses source-interface fixtures; real geographic placement and both representations are exercised in the browser. Long-distance streaming/return across every source combination has not been separately exercised for this feature.

Captured production views: [target](ArcheryVisuals/archery-target.png), [properties](ArcheryVisuals/archery-target-properties.png). `Notebook/test.html` was preserved byte-for-byte. [Validation manifest](ArcheryTargetValidation.json) records hashes and checks.

## I. User walkthrough

1. Open the Virtual World Editor, aim at valid loaded ground, and choose **Insert → Game Object → Archery Target**.
2. Select the target and use the existing move/rotate gizmos. Its orientation remains authored.
3. Use the existing scale controls or target diameter/height fields to adjust size.
4. In the target properties, edit ring radius percentages and scores, keeping five increasing boundaries ending at 100%.
5. Enter a label such as β and optional Greek-letter metadata. Add document associations through the standard association controls.
6. Save normally. Reopening restores the target and its settings.
7. Equip Archery Bow from the existing inventory. Aim, hold Use to draw and release to fire.
8. Front-face hits score by ring and leave an embedded arrow. Enable scoring feedback to see the brief points label; integrations can listen for `archery-target-hit` on the GameView panel.
9. Use the target inspector's duplicate/delete buttons. Undo/redo applies to authored changes; deleting a target removes its attached session arrows.

## J. Remaining work

Hardware GPU and native desktop measurements, total heap/driver memory profiling, and a long-distance target streaming test across every terrain source remain unverified. The analytic circle differs slightly from the 40-segment visible backing near its silhouette. Stand collision uses triangles. Large collections still submit one draw per visible target, with additional text costs when labels are present.

Already embedded arrows follow transforms; changing diameter or ring geometry does not reproject old arrows onto a newly shaped face. Arrows and feedback are intentionally session-only. Placement can refuse steep, rough, unloaded or unsupported ground. No target-specific chunk streaming system was added; authored-object residency follows the existing world architecture.

Future work may add lesson logic, Chiron dialogue, requested-letter evaluation, a scoreboard, sound or alternative feedback, and broader runtime inventory policy. None is required for the present target hit event and none is implemented here.
