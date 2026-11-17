# Phase C3.1: capabilities, skills and HTML behavior libraries

C3.1 connects configured components to capability queries, explicitly granted skills, reusable HTML behavior compositions, and existing gameplay actions. It extends the C3 interpreter and Creature Designer. It introduces no second AI scheduler, world engine, resource endpoint, or executable scripting format.

## User walkthroughs

### Make a behavior depend on the hare's nose

Open a Notebook copy of BrownHare.html, select the creature root, and choose **Behavior**. **Capabilities & skills** shows structural availability, current capacity, provider/component IDs and failure reasons. Healthy smell comes from the configured anatomical sensory contribution keys, not the Brown Hare species name.

Open **Behavior Library**, search for **Investigate Scent**, and inspect its smell requirement. Choose the `scent` trigger and add the reference. It invokes Sniff and Alert through the ordinary scheduler. To restrict the response to predator signals, insert an If with `signalCategoryIs` = `predator` before the invocation. This classifies the existing signal category; it does not identify a hidden animal's species or position.

Enable **Simulate preview**, then choose **Test scent signal**. This emits a bounded predator-category stimulus through the existing world `mob-sensory-signal` interface; **Test sound signal** emits a footstep stimulus. In the anatomy inspector, damage the nose to zero. The smell provider remains structurally present but functional capacity falls to zero. The saved program remains intact, sensory subscriptions stop receiving functional scent observations, and an explicit Sniff request reports its unavailable prerequisite. Restore the nose to test again. Eye and ear contributions behave similarly; one working eye or ear can retain reduced capacity. Hind-leg damage changes existing movement and hopping capacities; it does not replace navigation or injury calculations.

### Reuse a library behavior

Open **Behavior Library**, search by name/category, and inspect capabilities, skills and equipment requirements. Entries remain visible when incompatible; the Add button explains and prevents structurally incompatible additions. Injury produces conditional compatibility, so it does not prevent authoring. Choose a trigger, edit typed parameters, and add the reference. In the workspace, select its `runBehavior` block to connect typed argument expressions and map typed outputs to declared variables. Flee From Threat accepts a numeric duration; Offer Lesson returns a string choice.

Use normal Save, reopen, undo/redo and draft recovery. HTML stores resource paths, stable behavior IDs, exact version/signature declarations and invocation connections. **Library references** lists dependencies and removes unused references. **Reload library definitions** explicitly resolves updated HTML and resets this preview's execution. Other instances retain their captured immutable programs until explicitly reloaded/reopened.

To create a Notebook behavior, build and select an executable statement in the existing workspace, then choose **Save selection as reusable HTML**. Choose a new Notebook HTML path. The operation exports the structured blocks, local declarations and resource references into an HTML behavior document, removing event subscriptions. It does not create `.behavior.json`. If the workspace declares variables, choose which variable names become typed input parameters and outputs in the export prompts. The exporter preserves their declared types/defaults and rejects duplicate or unknown names. Editing library metadata itself remains through the ordinary HTML editor. The runtime validates the same language used by graphical blocks.

### Grant Remote Target Placement to Chiron

Create a user-owned creature named Chiron; a placeholder GLB is sufficient. In **Capabilities & skills**, add a `communication` provider. Select `supernatural` if the intended communication mechanism is nonbiological, or select a configured anatomical component for anatomy-driven communication. No provider is inferred from the name Chiron.

Grant **Remote Target Placement**. Inspect Known, Usable and Executing independently. Configure maximum distance, active-target cap, cooldown and lifetime. Optional capability and equipment prerequisites are editable. Configured equipment/trait IDs are separate from capability declarations: an equipment provider becomes functional only while its required equipment ID is present. Runtime equipment/trait changes use the guarded per-instance `setCapabilityInputs` interface; species defaults are not mutated. This phase does not add a full mob equipment renderer or inventory trading system.

**Test placement skill** requests a target ten metres along world +Z. It reports a structured result and uses existing collision/coverage queries. **Cancel skill objects** removes owned targets. Removing the grant prevents further invocation; undo restores the grant through normal creature history. Other NPCs may receive the same skill without any species-specific code.

### Build and run an interactive archery lesson

After granting communication and Remote Target Placement, open the library, select **Remote Archery Lesson**, choose `interact`, and add it. Insert the creature into an ordinary world with loaded, clear ground at the requested target location. The example requests a target ten metres along world +Z; a custom Use Skill block can supply a vector location and upright orientation, or a relative default distance.

Aim at Chiron within three metres with empty hands and press the existing **Use** binding. Select Begin. The same dialogue engine invokes the skill, receives a target ID, and waits for that target's `archery-target-hit` result. Equip the existing Archery Bow, return focus to the world canvas, and shoot while remaining within interaction range. Only the owned target's actual score completes the wait. Read the feedback and choose Complete lesson. Not now, range loss, incapacitation, editing, world pause, simulation-distance suspension, deletion and world closure cancel the session and release its objects. Unsupported/blocked placement produces a failure explanation rather than pretending a target exists.

## Capability architecture

`Creatures/Capabilities/Resolver.mjs` builds structural relationships once per controller and recomputes functional values only when the anatomy revision or per-instance provider-input revision changes. Read-only `check(id)`, `getCapacity(id)` and diagnostic snapshots return structural presence, current capacity/availability, engine support, dependent component IDs, requirements, provider types and reasons. These views do not alter existing anatomy formulas.

Configured sensory relationships map existing eye/hearing/smell/taste contribution keys into unified names. Existing raw contribution identifiers remain queryable. Locomotion and hopping depend on configured propulsion, coordination, jumping and balance; anatomical mobility and viability still apply. Functional contributions use actual part capacities, including existing component dependencies and restoration. Sensory capacity includes central perception impairment.

`definition.capabilityConfig.providers` supports registered `anatomy`, `equipment`, `trait` and `supernatural` implementations. Providers contain stable ID, capability ID, capacity, optional enabled state, and a component/equipment/trait reference as applicable. Definitions may declare additional named capabilities with bounded all-of/any-of/minimum-capacity requirements. Cycles, excessive depth, missing component IDs and invalid capacities are rejected. Multiple providers preserve a capability when one optional provider is lost. Provider capacity does not invent a new locomotion engine, sensory geometry, or environmental simulation.

Species `equipment` and `traits` are bounded declarative default ID lists. Runtime copies remain independent and revisioned. Provider activation/configuration changes rebuild the controller through existing creature history. Incapacitation disables functional availability without removing structural knowledge.

`aquatic-respiration` is a valid provider-backed capability. Fish taxonomy alone grants nothing. There is no new oxygen/drowning simulation. Flight and swimming may have configured providers, but their action implementations are explicitly unsupported. Swim remains discoverable with a clear engine-support diagnostic.

## Skills and execution

`Creatures/Skills/Skills.mjs` holds registered skill schemas/effects. Creature `definition.skills` stores grants, version, optional proficiency, prerequisite requirements, component IDs, equipment IDs, other skills and supported parameter overrides. IDs/effects/types, ranges, dependency cycles and resource limits validate before execution. A skill may have no anatomical prerequisite; Remote Target Placement is intentionally such a special technique unless a grant adds one.

Invocation checks Known, structural prerequisites, functional prerequisites, equipment/components, typed arguments, cooldown and active limits. It returns explicit statuses: success, skill-not-granted, missing-capability, capability-impaired, missing-equipment, invalid-target, out-of-range, blocked-location, permission-denied, cooldown, active-target-limit, canceled or internal-failure. Results contain typed IDs, never live scene objects in behavior context. Invalid registered-effect outputs trigger cleanup and internal failure.

The resolver and skill objects belong to the existing mob controller. The existing 30 Hz simulation ticks cooldowns, lifetimes and cooperative waits. Losing a required functional capability cancels the associated skill resources. Individual NPCs own independent cooldowns, targets and execution. Removing a grant/reloading a definition disposes the previous controller. World pause and simulation-distance suspension release temporary skill objects; they do not discard pending compatibility initialization events.

The registered placement defaults are 30 m reach, one active target, two seconds cooldown, 120 simulated seconds lifetime and ground surfaces only. Bounds are 1–100 m, 1–8 targets, 0–3600 s cooldown and 1–3600 s lifetime. Arguments are location (required vector), orientation (default upright zero vector), approved target type (default `archery-target`) and optional bounded session string. Ground targets accept yaw only; pitch/roll are rejected so footprint validation remains conservative. The skill returns a non-null target ID.

## Transient placement and scoring

`Skills/RemoteTarget.mjs` calls `createArcheryTarget`, retaining its geometry lease, analytic arrow collision and scoring implementation. Targets enter the normal scene, object list and collider list for rendering and bow queries, with `runtimeGenerated` and owner IDs. They never enter authored definitions or history. World serialization now checks transient ownership before type-specific target serialization.

The shared ground query checks authoritative source coverage/readiness, finite geographic/map bounds, support over a conservative footprint, slope/height continuity, solid clearance and water clearance. It never prepares distant chunks or fabricates elevation outside map sources. Existing axis-aligned anonymous box colliders provide support through their authoritative top bounds. Missing/unsupported ground returns blocked-location. Typed vectors, range and gameplay permissions validate before placement.

The target listener accepts only its exact runtime target ID and reads the existing score. The behavior interpreter receives the ID and score through sanitized typed context. Completion, cancellation, expiry, deletion, explicit replacement through cancellation, and closure remove event listeners, colliders, geometry leases, object-list entries and attached arrows. The placement action itself does not dirty HTML or grant authoring authority.

## HTML library format and composition

Built-ins reside only in `ApplicationSystem/public/BuiltIn/Behaviors/` and use the existing static mount. Published entries are Compatible Instincts, Flee From Threat, Investigate Sound, Investigate Scent, Offer Lesson, Administer Lesson and Remote Archery Lesson. Search for Food is deferred because no supported foraging ecology exists.

A behavior HTML document uses the ordinary inert `nodevision-metaworld` script. Its `metadata.behavior` contains `documentType: "behavior"`, stable `id`, version 1, name/description/author/category, requirements, typed parameters/outputs, statement `entry`, the C3 `program`, and resource `dependencies`. Signature declarations include name, valueType and a valid initial value. Parameters/outputs must match program variables. Library programs have no event subscriptions; the caller supplies trigger and sensory/interaction context.

Creature `behaviorProgram.libraries` maps local names to `{path,id,version,parameters,outputs}`. `runBehavior` blocks bind typed argument expression IDs and output destination variables. Imports are loaded outside rendering, coalesced, cached (64 documents), validated and namespaced into the same structured program before the existing compiler/interpreter runs. There is no nested world construction or second execution queue. Original references remain authoritative in saved creature HTML; the expanded frozen runtime program is excluded from authorship. Runtime program fields are rejected if supplied as authored definition data.

Library defaults/output locals reset on each invocation. Results and cancellation use the same C3 action lifecycle. `skillStatus`, `skillReason`, `placedTarget` and `score` are bounded typed event-context fields; `actionSucceeded` enables explicit branches. Debugging exposes the latest structured action result. Dynamic prerequisites return understandable results without deleting authored blocks. Existing inline C3 dialogue remains compatible; new lesson library entries explicitly declare communication requirements.

Imports require matching stable ID, exact version and typed signature. Cycles and depth >= four are rejected; a preparation resolves at most sixteen resources, with eight direct references per program. Expanded programs must still meet C3's 256-block/32-variable/16-procedure/64-step/32-queue limits. Library updates affect new explicit reloads/openings, never replace executing programs halfway through a task. Save As resolves relative library paths against the original creature document.

## Editor, security and persistence

The existing floating Behavior panel now includes capability/skill inspection and editing, searchable built-in/Notebook library discovery, reference inspection/reload, typed invocation sockets, result conditions, and action compatibility labels. Compatible, conditional, incompatible and unsupported states remain distinguishable. Incompatible/unsupported action options remain visible with reasons but cannot be newly selected. Damage only changes runtime availability; saved graphs remain valid.

The editor uses the existing creature bridge, authoring guards, history, drafts and Save workflows. Viewer authoring remains denied. Gameplay placement requires a granted skill, existing tool-use permission, and an allowed gameplay view; Viewer requires explicit gameplay opt-in. The effect performs no arbitrary authored world mutation. Resource paths remain restricted to Notebook/BuiltIn; HTML content is parsed as inert JSON. There is no eval, arbitrary effect registration from documents, unrestricted DOM/network/filesystem/shell block or alternate player-location feed.

Total Concealment continues filtering attributed visual, sound and scent signals. Functional capability checks gate graph observations and actions; sound/scent category is not confirmed species identity. Movement requests retain existing collision, navigation commitment, stuck recovery and injury-driven speed/jump scaling.

## Verification and remaining limits

Automated evidence and benchmark tables are recorded below and in the C31 JSON reports. Production testing uses temporary Notebook files and actual GameView/editor/inventory/Use/bow integration. Original Rabbit models, textures and license notice, canonical Brown Hare HTML, and `Notebook/test.html` are preserved.

Known limits: no swimming/flight locomotion or respiration survival simulation; no atmospheric scent transport; no full RPG progression, centaur model, equipment rendering/trading, automatic predator ecology or general skill scripting. Graphical export creates a new HTML entry with optional typed parameters/outputs; later library metadata/version edits use the HTML editor. Existing C3 inline dialogue is preserved for compatibility. Relative default placement uses world +Z; explicit location/orientation sockets permit authored destinations. Memory accounting is estimated, not exhaustive heap-retention proof. SwiftShader measurements do not establish native GPU FPS.

## Final verification and measurements

The final browser workflow passes graphical library insertion, undo/redo, Notebook behavior export, capability inspection, controlled scent stimuli, nose injury/restoration, other sensory/locomotion injury checks, save/reopen, skill removal/undo, explicit library reload, normal Use interaction, a trusted live bow shot, correct-target scoring, source preservation, independent NPC execution, deletion/closure cleanup and Viewer restrictions. Unchanged C3, C2, C1, M1.4, archery, target and teleporter browser regressions also pass. Focused tests pass 14 C3.1 cases and all 29 C3 cases; the complete suites pass 71 MetaWorld files and 11 GameView files.

Reproduce with `node scripts/test-c31-regressions.mjs`, `node scripts/test-c31.mjs performance`, and `node scripts/validate-c31.mjs`. Node browser-root import resolution uses the existing `--import ./scripts/register-browser-test-imports.mjs` test adapter. Raw reports are `CreatureDesignerC31Browser.json`, `CreatureDesignerC31Performance.json` and `CreatureDesignerC31Validation.json`. Runtime source hashes at test startup are checked against final files.

The benchmark runs Chromium SwiftShader at 640×480, two reversed-order trials, 30 warmup and 180 measured RAF per case, actual shared Rabbit GLB, and synthetic authoritative flat support without rendered terrain. Each RAF advances one fixed 1/30-second simulation step; simulation speed is therefore not a real-time player-playthrough measurement. Runtime/perception/navigation/spatial-index CPU is reported separately from interpreter CPU and frame pacing. Aggregate interpreter/capability counters include warmup; frame timing samples exclude warmup. The direct C3-compatible and no-program legacy paths run in the same harness as controls for library composition; this does not isolate every C3.1 change from an unmodified historical C3 binary. Historical C3 results remain in the C3 report.

| Scenario | Runtime/index mean ms, trials 0 / 1 | Runtime/index p95 ms, trials 0 / 1 | Frame mean ms, trials 0 / 1 |
| --- | --- | --- | --- |
| 1 library hare | 0.189 / 0.192 | 0.50 / 0.60 | 16.67 / 16.67 |
| 5 library hares | 0.604 / 0.642 | 1.00 / 1.10 | 16.67 / 16.67 |
| 20 library hares | 1.691 / 1.594 | 2.50 / 2.50 | 16.67 / 16.67 |
| 50 library hares | 2.786 / 2.642 | 5.10 / 4.70 | 16.67 / 16.67 |
| 50 direct C3-compatible hares | 2.643 / 2.558 | 4.70 / 4.50 | 16.67 / 16.76 |
| 50 legacy hares without a program | 2.363 / 2.357 | 3.90 / 3.90 | 16.67 / 16.67 |
| 1 idle lesson NPC | 0.174 / 0.165 | 0.50 / 0.50 | 16.67 / 16.67 |
| 10 idle lesson NPCs | 0.852 / 0.905 | 1.40 / 1.50 | 16.66 / 16.67 |
| 20 library hares, repeated injury | 3.029 / 2.949 | 4.60 / 4.50 | 16.67 / 16.67 |

The fifty-hare library path adds 0.142 / 0.084 ms/frame relative to the direct compatible composition. Frame p95 is 18.40 / 17.90 ms. Small trial differences and refresh-capped frame pacing do not establish an FPS improvement; no native GPU performance claim is made.

Forty successful placement/cancellation cycles (twenty per trial) average 1.540 / 1.020 ms per invocation, p95 9.90 / 2.20 ms, including cold setup costs. Blocked placement costs 0.70 / 0.20 ms; out-of-range placement is explicitly rejected. Active targets return to zero. These timings use the benchmark support geometry; finite/map coverage and collision correctness also have focused and production integration coverage.

The repeated-injury workload performs 4,200 resolver revisions per trial, with aggregate capability CPU 187.70 / 176.80 ms across twenty mobs. Stable ordinary cases resolve once per instance rather than per frame. Five explicit library reloads per trial take 25.10 / 21.80 ms total; existing active program objects remain unchanged.

The interpreter estimate is 2,816 bytes per idle library-hare execution versus 1,792 for direct compatibility; capability-state accounting estimates 7,424 bytes per hare. These exclude full JavaScript-engine overhead and are not measured retained-heap proofs. Skill object counts, interpreter CPU/dispatches, navigation plans, event/cancellation counters and full frame mean/p95 are in the raw report. Every case records zero creature/library document reads during measured frames, one shared model request, bounded queue/trace state, and zero model leases, geometries, textures or dialogue sessions after disposal. Twenty repeated Greek dialogue sessions also leave zero sessions. Fifty visible rigid hares retain fifty draws and 33,700 triangles; this phase does not change mesh batching or terrain performance.

Canonical BrownHare.html, original model/texture files and attribution, and `Notebook/test.html` remain byte-identical to the C3 baseline.
