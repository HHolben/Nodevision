# Phase C2 — graphical anatomy construction

C2 extends the C1 HTML creature assembly, existing GameView, Layers panel, inspector, history and mob runtime. Anatomical parts remain configuration inside the single `nodevision-metaworld` block. They are not world objects, meshes or extra mob instances. The canonical Brown Hare HTML remains the source of all thirteen original parts and compatibility exports. Its original model and license assets are unchanged.

## Hierarchy and selection

A standalone creature's existing Layers panel lists the authoritative root followed by anatomical parts in parent-before-child order, indented by ancestry. The root's **Anatomy construction** inspector section also provides shortcuts. Selecting either route opens **Anatomy** in the existing dockable/resizable inspector. Viewport inspection of a visible region routes through the same layer selection API; there is no independent selection store for body parts. Layers rename and dependency-aware delete use the anatomy authoring operations. Reparenting is performed in the inspector, rather than through world-object ordering arrows.

Parts have stable IDs independent of their displayed names. Add creates a UUID, valid defaults and one box region. Duplicate copies a subtree with new part and region IDs, remapping internal parent, region-owner and `requires` references. External references remain directed at their original targets. Species sensory associations are external configuration: use **Add sensory role** to explicitly associate a copied/new organ; duplication does not silently redirect an existing sensor. Delete asks before removing descendants and their viability, dependency and sensory references. Removing the last part, cycles, missing parents/dependencies, duplicate IDs and invalid transforms are rejected before history or source mutation.

The limit remains **128 parts**, hierarchy depth **32**, **8 regions per part**, **64 contribution keys per part**. Functional dependencies must also be acyclic. There is no assumption of two eyes, two ears or four legs.

## Coordinates and schema

Existing C1 anatomy remains valid without migration. Its `position` and `bounds` describe root-local boxes, and `parent` is a logical relationship. Merely opening a legacy document does not modify it. The first anatomical authoring operation converts it to `coordinates: "parent-local"`, preserving the position of every original region. Parent-local anatomy stores component position, XYZ Euler rotation in radians, and scale from 0.01 to 100 per axis relative to its anatomical parent. This bound keeps matrix inversion finite across the supported hierarchy depth. Roots are relative to the normalized visual pivot in metres.

```json
{
  "coordinates": "parent-local",
  "parts": [{
    "id": "support-left", "name": "Left support", "parent": "core",
    "position": [0.25,-0.4,0], "rotation": [0,0,0], "scale": [1,1,1],
    "maxCondition": 1, "initialCondition": 1,
    "response": {"exponent": 2, "disabledBelow": 0.1},
    "contributions": {"propulsion": 0.5, "jump": 0.5},
    "requires": [], "lateral": 1, "locomotor": true,
    "vulnerabilities": {"piercing": 1, "slashing": 1, "blunt": 1},
    "animationBinding": "rigid-body", "colliderBinding": "visual-pivot",
    "regions": [{
      "id": "support-left-main", "owner": "support-left", "shape": "capsule",
      "position": [0,0,0], "rotation": [0,0,0],
      "dimensions": [0.12,0.3,0.12], "enabled": true
    }]
  }]
}
```

This is an excerpt, not a complete creature definition; the ordinary creature document still supplies species metadata, resources, behavior, viability and sensory configuration. The existing versioned runtime component adapter accepts this backward-compatible extension; there is no second anatomy file or JavaScript species snapshot.

Box dimensions are full XYZ sizes. Sphere dimensions are three equal diameters. Capsules run along local Y; X/Z are equal diameters and Y is total height including the two hemispheres. Capsule height must be at least its diameter. Numeric sphere diameter edits update all axes together; capsule diameter edits couple X/Z and increase total height if needed. A region's owning component is its containing part; explicit `owner`, when supplied, must agree. Zero regions and disabled regions are valid. Such a part remains structural/functional but is not externally hittable.

Parent matrices are composed from authored local values, rather than incrementally accumulating transforms. Moving or rotating a parent propagates to descendant regions. Reparenting preserves root-space geometry by recalculating the local transform. Reparenting that would require shear is rejected with an explanation; uniform parent scales avoid this limitation. Collision and helpers support the resulting affine transforms, including nonuniform creature-root scale. No ellipsoid authoring shape is offered.

## Viewport and inspector

Select a part, then choose **Show hit regions → Selected component / All / None**. Wireframe helpers preserve visibility of the model; selected outlines use a distinct color. Disabled collision regions remain inspectable. Each component has move, rotate and scale actions that carry its descendants; each region also has separate move, rotate and scale actions using the existing editor gizmos. Pointer positions are relative to the actual rendering canvas, including when GameView occupies a small panel. A completed drag creates one history entry. Invalid capsule/sphere dimensions are rejected and the helper returns to its authored transform. The inspector also edits local component transforms, region offsets, orientation and dimensions numerically.

Root selection edits the entire mob. Part selection edits anatomy; region gizmos never move the root. For components with no region, use their local-transform fields and **Add hit region**. Names, parents, maximum/initial condition, injury exponent and threshold, lateral bias, locomotor status, vulnerabilities, viability membership and functional dependencies are editable through the same generic inspector. The rigid Rabbit uses proxy geometry only; no mesh or bone is falsely presented as an independently articulated limb.

## Functions and senses

Controls expose implemented propulsion, acceleration, jump, turning, balance, endurance, coordination, recovery, vitality and central perception effects. Contribution weights retain the existing runtime meaning: healthy contributors impose no loss; injury subtracts `weight × (1 − capacity)` from the relevant capability, clamped to [0,1]. Capacity follows the configured normalized-condition exponent and disabled threshold. A part's `requires` multiplies its capacity by the minimum capacity of its required parts. Multiple contributors can have different weights. Missing optional locomotion capabilities retain the existing ground-controller defaults; deleting all locomotor parts does not silently select a new locomotion engine. Explicitly assign the capabilities/viability appropriate to the creature being constructed.

**Add sensory role** associates any part with directional vision, hearing/localization, smell or taste. Vision supports arbitrary organ IDs and editable yaw, field and range. Hearing has an arbitrary capability list, rather than exactly two ears. Sensory contribution controls affect actual perception after damage. Range/threshold controls labeled **Species** affect the shared sensory processor, not just the selected ear/nose. Smell and taste retain the existing one-detector-per-species configuration; multiple parts may contribute to that detector. Adding a smell/taste role explicitly changes the species detector assignment. The right and left existing organs retain independent condition.

Injury response, propulsion, jump, turning, sensory detection and behavior use the existing bounded anatomy/perception/navigation processors. No decorative-only function sliders or unimplemented bite/claw/kick attacks are offered. Existing perception uses its species eye height and explicit yaw/field parameters; collider relocation does not infer a new sensory origin or skeletal gaze direction.

## Damage resolution

The normal mob broad phase rejects distant sweeps before anatomical queries. Compiled region matrices then transform the segment into each enabled primitive's local coordinates. Analytic box, sphere and capsule entry tests select the nearest intersection along the segment. Equal entries use stable region-ID ordering, independent of tree order, and report overlap uncertainty. Every region resolves to its owning anatomical ID. Surface normals use inverse-transpose transforms.

Both the actual arrow and Sword exact-collision adapter consume these regions and the existing damage processor. Parent-local authored anatomy requires an actual region hit, including through silhouette gaps. The legacy root-local hare retains its explicitly flagged nearest-proxy arrow fallback for backward compatibility; Sword remains exact. Editing does not retain a second hardcoded set of Rabbit coordinates. Functional state recalculates after damage, affecting actual movement, perception and behavior. These hit regions are combat proxies; the locomotion controller retains its separately configured physical collision radius/height for terrain and navigation.

## Anatomy Test and simulation

Enable **Anatomy Test** in the selected part's inspector. Its temporary-condition input uses the real runtime condition processor. The diagnostics show actual movement and sensory capacities. **Test sound behind creature** reuses the existing sensory signal path; **Reset test injuries** clears temporary conditions and the test damage ledger, returning to authored initial condition. A clean document remains clean after these operations.

Use **Creature preview → Simulate behavior on temporary support** for existing movement/perception simulation. Anatomy Test releases the anatomy inspector's movement hold so the same simulation can run while diagnostics remain open. Disable simulation to reset pose. Test injuries, support, sensory observations, navigation, velocities and helper/gizmo state never enter HTML or ordinary undo history. Definition edits rebuild the transient anatomy processor and reset its test injuries; they preserve the loaded model when appearance/physical dimensions are unchanged.

## Persistence, permissions and lifecycle

Each deliberate anatomical operation validates the complete candidate, records normal world history, and updates `metadata.creature.definition.anatomy`. Save updates the existing world block and retains unrelated HTML. Undo/redo includes anatomy and the root. The C1 unsaved draft and Save As controllers remain authoritative. Built-in experimentation cannot overwrite the canonical static file with normal Save; use **Save As Creature** to create a Notebook file with independent species/document identity.

Ordinary worlds continue to save instance IDs, placement and creature-HTML references, rather than anatomy copies. Immutable assemblies and GLB resources are shared; condition and observations remain independent per instance. Explicit definition reload reconstructs only the selected instance and resets its injuries. Other active instances keep their captured definition/state until explicitly reloaded or reopened.

Viewer has no anatomy-authoring controller, helpers, inspector actions or permitted mutation bridge. Its existing nonauthoring preview simulation remains available. Closing/switching GameView disposes helper geometry/materials, clears gizmos and detaches helper nodes. Replacing a definition reconciles the helpers; removing a part/region detaches its helpers. Geometry is shared between compatible helpers, unchanged meshes survive property edits, and obsolete capsule geometry is released. Gizmo disposal releases owned handle materials/mesh geometries without disposing shared sprite geometry, arrow textures or model resources. There are no per-frame helper allocations or HTML parsing.

## Walkthrough: add a functional support

1. Open the Brown Hare HTML and use **Save As Creature** to create a Notebook copy.
2. Select Torso in Layers or **Anatomy construction**. Choose **Add Anatomical Component**.
3. Select the new component, rename it and retain its generated stable ID. Set its parent-local position and rotation.
4. Choose a box, sphere or capsule region; set full dimensions. Use **translate region in viewport** to align its outline. Add another region if needed.
5. Set a supported propulsion/jump contribution, injury exponent and any required anatomical part IDs. Mark it as a locomotor if appropriate.
6. Enable Anatomy Test, reduce its condition and observe the actual movement diagnostics. Enable the existing preview simulation to observe movement, then reset test injuries.
7. Save, close and reopen. Insert the Notebook creature from the normal Mob menu into an ordinary world. Its authored regions and capability assignments are used by independent instances.

## Verification and measurements

Focused automated tests exercise hierarchy operations, limits, remapping, legacy conversion, affine transforms, rotated primitive intersections, multiple/disabled/absent regions, deterministic overlap, dependency capacities, initial conditions/reset, sensory impairment, HTML round trips, shared immutable assemblies and independent runtime state. The existing anatomy/navigation/Sword/archery tests remain unchanged.

The production C2 scenario uses the actual GameView, property inspector, Layers selection API, pointer-event gizmo handlers, normal undo/redo, draft/save/reopen and Save As. It builds a four-part custom creature, assigns a sensor, inserts two references into a destination world, verifies authored collision/damage, explicit reload isolation, reference-only persistence, Viewer denial and cleanup. It uses temporary Notebook files and does not write `Notebook/test.html`. The separate C1 and gameplay scenarios run their unchanged browser scripts through the same isolated server fixture, with C2-specific reports and preserved historical screenshots.

Raw evidence: [C2 browser checks](CreatureDesignerC2Browser.json), [CPU/helper benchmark](CreatureDesignerC2Performance.json). Final results and the benchmark table are recorded below.

The benchmark uses two reversed-order trials at 13, 32, 64 and 128 parts. Each case warms up 10 deliberate inspector edits and measures 40 edits through actual validation/history/helper/inspector updates. It separately measures 5 warm-up + 20 batches of 200 narrow-phase queries, distant broad-phase misses and condition/capability recalculations. It checks geometry reuse and zero remaining helper parents/model leases/asset entries after asynchronous cleanup. Sixty RAF waits describe software-renderer pacing separately from synchronous CPU work. Capsule/sphere correctness is tested separately; the scaling benchmark uses the Hare's box regions plus additional box components.

Chromium uses SwiftShader here. These CPU measurements establish editor responsiveness and bounded query costs, not native GPU FPS. Cached shaders/modules, JIT, timer quantization and GC create variability, especially in sub-microsecond broad-phase batches. Not all helper regions are in the camera frustum, so visible draw calls are not a total-part-count measurement. A native desktop C2 workflow has not been run.

## Extension boundaries

Future skeletal/clip animation should supply named bone/mesh bindings through the existing adapter, with hit-region matrices derived from the same articulation pose. Preserve semantic part IDs independently of bone names and do not create new species classes, renderers or anatomy files. The current supported binding is explicitly rigid visual-pivot following; moving an anatomical proxy does not deform the single Rabbit GLB. Additional locomotion engines, arbitrary combat actions, ellipsoids, skeletal association editing and per-organ sensory origins remain future work.

Run:

```sh
node --import ./scripts/register-browser-test-imports.mjs ApplicationSystem/public/MetaWorld/Creatures/AnatomyConstruction.test.mjs
node --import ./scripts/register-browser-test-imports.mjs --test --test-concurrency=2 $(find ApplicationSystem/public/MetaWorld -name '*.test.mjs')
node --import ./scripts/register-browser-test-imports.mjs --test --test-concurrency=2 $(find ApplicationSystem/public/PanelInstances/ViewPanels/GameViewDependencies -name '*.test.mjs')
node scripts/test-c2.mjs
node scripts/test-c2.mjs performance
node scripts/test-c2.mjs c1
node scripts/test-c2.mjs m14
node scripts/test-c2.mjs archery
node scripts/test-c2.mjs target
node scripts/test-c2.mjs teleporter
```


## Final validation results

- 18 focused C2 cases pass; all 69 MetaWorld test files and 11 GameView test files pass.
- Production C2 authoring, pointer gizmos, component-child propagation, numeric shape editing, sensory assignments, real injury testing, custom referenced instances, save/reopen, drafts, undo/redo, Viewer and cleanup pass.
- Existing C1, M1.4 Sword/Total Concealment, Archery Bow, Archery Target and Raycasting Teleporter browser regressions pass. Compatibility outputs are stored under `CreatureDesignerC2Compatibility-*`; the Teleporter result is captured in the final validation log summary.
- `Notebook/test.html`, the canonical C1 Brown Hare HTML, original GLB/OBJ/MTL/texture and license notice match their pre-C2 hashes.

Final isolated CPU measurements, two reversed-order trials (milliseconds):

| Parts | Inspector edit mean | Inspector edit p95 | Narrow query mean | Capability recalculation mean |
| --- | --- | --- | --- | --- |
| 13 | 7.115–8.180 | 8.700–13.400 | 0.002–0.002 | 0.007–0.007 |
| 32 | 8.023–9.477 | 8.400–12.800 | 0.003–0.003 | 0.010–0.010 |
| 64 | 11.977–12.695 | 14.500–17.200 | 0.005–0.005 | 0.015–0.015 |
| 128 | 18.435–19.365 | 21.900–25.400 | 0.009–0.009 | 0.028–0.028 |

Unchanged helper meshes and their geometry were reused in every case. After each close, helper parents, active GLB leases and live asset entries returned to zero. The 128-part case can exceed a 16.7 ms frame budget during a deliberate authoring change; it is responsive but does not guarantee uninterrupted 60 FPS while editing. Whole-document validation/history and inspector reconstruction remain included in that cost. Distant broad-phase misses are near the timer quantization floor; use the raw batch results rather than claiming exact nanosecond timing. These measurements do not establish native GPU performance.

[Final verification and source/preservation hashes](CreatureDesignerC2Validation.json). Run `node scripts/validate-c2.mjs` after the listed verification commands to refresh that evidence.
