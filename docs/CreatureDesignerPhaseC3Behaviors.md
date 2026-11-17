# Phase C3: visual creature behavior

C3 adds a Behavior panel to the existing HTML Creature Designer. Authored blocks live in `metadata.creature.definition.behaviorProgram` in the ordinary `nodevision-metaworld` JSON script. There is no executable generated JavaScript, new file format, server endpoint, or second simulation loop.

## Editing and walkthroughs

Open a Notebook copy of BrownHare.html, select its creature root, and choose **Behavior**. The floating panel uses the existing docking/resize shell and viewport pan/zoom controls. Add colored blocks from the palette by clicking or dragging. Move cards with the pointer or arrow keys; their ordinary position inputs also support keyboard editing. Select a card to edit its parameters. Drag its typed output onto a compatible socket, or select the connection from the socket dropdown. Invalid types are rejected. Sequence controls append, reorder, or remove statements. Delete refuses blocks still referenced by active connections; duplicate creates a disabled construction block. Enable completed blocks to validate them. Ordinary history undo/redo, draft recovery, Save, Save As, and reopen preserve connections and layout.

To build a hare flee rule, choose the non-self-species flee example. Its visible event connects to an if block, whose boolean predicate tests whether the observed species differs from this document's species ID. A confirmed mismatch stores the observed entity in instance variable `currentThreat` and requests Flee. An unidentified entity follows an explicit alert branch; a known same-species entity does nothing. Replace or reconnect these blocks using the socket inputs. Turn on the existing Preview simulation and add the controlled same-species, different-species, or unknown actor. These actors pass through actual perception and never enter saved HTML. Blind the eyes or enable Total Concealment to check that player detection disappears. Hind-leg injury reduces the same navigation controller's propulsion.

For a lesson, create a user-owned creature named Chiron (a placeholder appearance suffices), open Behavior, and choose the Greek lesson example. The interaction event sequences Say, Begin/Not now choices, a choice condition, a referenced lesson action, and End conversation. The lesson resource is `/BuiltIn/Lessons/GreekAlphabet.html`, served by the existing public static mount. Test player interaction in the panel, choose Begin, Continue, type `alpha`, and submit. `omega` produces corrective feedback and Retry. Not now ends the conversation. In an ordinary world, aim at the NPC within three metres and press the existing **Use** binding with empty hands; selected tools retain input priority. Moving away, closing/deleting the mob, pausing the world, or incapacitating the NPC cancels the session. Only one conversation per world is active.

For debugging, enable Preview, then use Pause, Step, Resume, Reset or Cancel. The panel highlights the active block and shows active event, state, target, variables, recent bounded transitions, action status, error and cancellation. Step advances the same runtime by one 30 Hz step. Debug controls require authoring permission. Debug actors, traces and execution state are temporary.

## Language and persistence

Version 1 contains `blocks`, subscribed event IDs in `events`, typed `variables`, named `procedures`, and referenced `lessons`. Blocks have stable IDs, a `type`, typed connection IDs and optional layout coordinates. Execution never depends on layout. Construction blocks marked `disabled` may be incomplete but cannot execute or be connected to enabled blocks. All enabled blocks must validate, including disconnected blocks.

| Category | Supported primitives |
| --- | --- |
| Events | initialized, visible, sound, interactionRange, interact, damage, partDisabled, timer, response, answer |
| Flow | sequence, if/else, bounded repeat, wait, procedure call, state, timer |
| Expressions | typed literal, observation, variable, predicate, boolean all/any/not, typed comparison |
| Actions | legacyInstinct, wander, rest, graze, flee, moveToward, moveAway, stop, look, alert, say, choices, lesson, question, evaluate, endConversation |
| Variables | set; boolean, finite number, bounded string, entity ID or null, finite three-vector; event, instance or session scope |

Entity constants/defaults must be null; runtime references are IDs, never scene objects. Missing entities are forgotten safely. Variables are independent per instance. Event-local values start fresh per event; session values reset on deliberate interaction. Source stores declarations/defaults only. Runtime timers, observations, player references, sessions, animation, trace and active block are excluded from saves. Save As resolves lesson references against the original document, as for existing model resources.

Conditions include species match/mismatch/known/unknown, category match, distance, functional vision/hearing, injury, state, dialogue choice, and answer correctness. Unknown identity is a third result: neither negation nor a mismatch converts it to confirmed knowledge. A state block changes decision state; physical movement is requested by actions.

## Runtime and sensory boundaries

`Schema.mjs` validates and shares frozen compiled definitions. `Interpreter.mjs` owns independent queues, stacks, variables, timers, trace and cooperative async actions. `Adapter.mjs` integrates it into the existing mob scheduler, brain, navigation, anatomy, permissions and dialogue. `Entities.mjs` builds one spatial snapshot per world frame, rather than scanning the world per mob. Local queries return at most sixteen nearby entries; spatial cells cap at 128 entries. Rendering culling and world pause freeze execution and cancel active conversations without losing pending initialization.

Perception remains authoritative: functional eyes, field, confidence, distance and occlusion gate visual events; existing ears and hearing uncertainty gate sound. Total Concealment filters attributed observations before behavior execution. The local entity index supplies candidates, not unconditional player observations. Simplified visual identity is confirmed at confidence >= .65 and within the smaller of six metres and 60% of eye range. Category is the species' taxonomy leaf. Sound source classification is distinct from confirmed entity species/category. This is metadata recognition after detection, not pixel recognition.

Observed target directions are cached for at most two simulated seconds, with sixteen entries. Target actions use these directions, not perfect world positions. Removed or concealed targets cancel requests. Existing navigation handles collision, steering commitment, stuck recovery, home bounds where applicable, simulation distance and anatomical locomotion impairment. There is one movement owner: compatibility instincts or an explicit graph action. Look also takes movement ownership.

Canonical Brown Hare initializes the reusable `legacyInstinct` action. This retains its established thresholds and background state machine instead of silently fleeing from every benign entity. An unconditional initialization compatibility action also owns trauma before the first scheduled tick. Legacy documents without a graph continue using existing defaults. The editable non-self flee program is explicit. The behavior master enable switch applies to both; old wander/flee configuration switches govern compatibility instincts, while authored graph commands are deliberate requests. Full decomposition of compatibility instincts into elementary blocks remains future migration work.

Events sort by priority, then stable insertion order: damage/partDisabled 100; visible 80; sound 70; interact/response/answer 60; interactionRange 30; timer 20; initialized 10. Higher-priority work interrupts current work. Equal-priority work queues; repeated sensory events coalesce per subscription/entity. Sensory events expire after two simulated seconds. Cancellation is reentrancy safe, terminates async actions, and detaches session UI. Actions expose running/completed/failed/canceled states. Waits and repeated bodies yield to the scheduler.

Limits: 256 blocks, 32 variables, 32 event subscriptions, 16 procedures, 16 nesting levels, procedure call height eight, 32 queued tasks, 64 trace entries, 64 execution steps per tick, 128 expression evaluations per statement, repeat count at most 1000, waits at most 3600 seconds, minimum timer interval .1 seconds. Cyclic block references and recursive procedures are rejected, including deep shared tails. No user-authored eval, arbitrary DOM/network/filesystem/shell operations or unrestricted world edits exist.

## Dialogue and resources

`Dialogue.mjs` uses existing floating panels, textContent and normal keyboard focus. Sessions belong to the initiating player and mob; controls are range/permission/state checked. `Lessons.mjs` reads inert HTML resources through existing Notebook/static resource permissions. A lesson uses `<script id="nodevision-lesson" type="application/json">` with version 1, title, intro and bounded questions containing prompt, expected answer and feedback. Loading never executes resource HTML. A bounded promise cache avoids repeated parsing. Answers normalize Unicode NFC, whitespace and Greek locale case. The original sample teaches Alpha; it is intentionally small. It supports feedback, retry and completion rather than a full student-progress platform.

## Architecture choices and limits

Existing GraphManager manages filesystem/Notebook relations and MQTT messages, rather than typed executable connections. Reusing it would couple behavior editing to unrelated document operations. The Behavior panel instead reuses the floating-panel shell, viewport controls, history, creature bridge and persistence. A node presentation may later consume the same IR. The current acyclic structured representation does not promise lossless conversion from arbitrary cyclic graphs.

There is no skeletal deformation, voice/lip sync, computer vision, full centaur model, arithmetic language, curriculum progression, multiplayer progress storage, or general script execution. Recognition uses existing metadata and simplified thresholds. Spatial cell caps intentionally bound crowds and may omit candidates in very dense cells. Per-instance memory figures below are accounting estimates, not exhaustive heap-retention proof. Native desktop/GPU validation remains outstanding.

## Verification and benchmark evidence

Focused tests exercise schema/type/security bounds, cooperative flow, scopes, deterministic ordering, multiple event subscribers, interruption/cancellation, unknown identity, sensory injury/concealment, locomotion impairment and initialization. Production browser scenarios exercise visual connections and dragging, keyboard fields/history, save/reopen/drafts, actual preview stimuli, independent instances/reload, ordinary Use interaction, correct/incorrect/refused lessons, range/incapacitation/deletion cleanup, malformed references and Viewer restrictions. Regression commands and protected-file hashes are recorded in `CreatureDesignerC3Validation.json`.

`CreatureDesignerC3Performance.json` contains two reversed-order trials: 30 warmup and 180 measured RAF per case, fixed 30 Hz simulation, real shared Rabbit GLB, Chromium SwiftShader at 640×480, and no rendered terrain. These are bounded mob workloads, not large-world GPU performance claims.

| Scenario | Mean runtime + spatial index CPU/frame, trials | Mean frame time |
| --- | --- | --- |
| 1 compatible hare | .393 / .212 ms | ~16.66 ms |
| 5 compatible hares | .913 / .664 ms | ~16.67 ms |
| 20 compatible hares | 1.814 / 1.661 ms | 16.66 / 16.79 ms |
| 50 compatible hares | 2.719 / 2.533 ms | ~16.67 ms |
| 50 legacy baseline | 2.411 / 2.223 ms | ~16.67 ms |
| 1 idle lesson NPC | .198 / .192 ms | ~16.67 ms |
| 10 idle lesson NPCs | .916 / .927 ms | ~16.67 ms |
| 20 event-stress mobs | 6.716 / 7.022 ms | ~16.95 ms |

The 50-hare compatible program costs about .31 ms/frame more than the legacy baseline in each trial. Its runtime/index p95 is 4.4 / 4.2 ms versus legacy 3.8 / 3.5 ms. Event-stress p95 is 12.8 / 12.9 ms, frame p95 and individual counters are in the raw report. Each stress trial submits 168,964 events across all mobs, dispatches 875 blocks and records 160 cancellations; the maximum queue length across instances at the end of measurement is fourteen and traces cap at 64. Program interpreter CPU totals are reported separately from navigation/perception/index CPU.

Twenty real UI lesson sessions (ten per trial, alternating correct/incorrect answers) complete with zero remaining sessions; mean automated wall latency is 69.98 / 66.57 ms. This includes scripted UI pacing, not user response time. Estimated per-instance behavior memory is 1792 bytes for compatibility, 1280 for idle lessons, and 24832 for stress. All cases perform zero document reads during measured frames, one shared model request, and release model leases, geometries, textures and sessions on disposal. Fifty visible hares submit fifty draws and 33,700 triangles; behavior programming does not batch their rigid meshes. Frame rates near refresh are capped and SwiftShader/order variability prevents claims of hardware GPU improvement.

Final checks passed: 29 focused behavior cases; 70 MetaWorld test files; 11 GameView test files; C3 production workflow and unchanged C1, C2, M1.4, archery, target and teleporter browser scenarios. The final regression run caught and fixed immediate trauma before initialization; the benchmark predates that fix, but all measured ticks had already initialized. `scripts/validate-c3.mjs` verifies raw reports, logs and protected hashes. Canonical BrownHare.html differs from C2 only by its compatibility behaviorProgram. `Notebook/test.html`, original Rabbit model/texture files and license notice remain byte-identical.

## C3.1 extension

[C3.1 capabilities, skills and HTML behavior libraries](CreatureDesignerPhaseC3_1CapabilitiesSkillsBehaviors.md) extends this same interpreter with revision-cached component capabilities, explicit skill grants, typed library references, scent events, prerequisite/result conditions and owned transient archery targets. Historical C3 measurements above remain unchanged.
