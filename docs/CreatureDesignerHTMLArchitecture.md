# Creature Designer: HTML architecture (Phases C1–C3)

Phase C2 adds graphical anatomy construction to this architecture. See [the C2 schema, workflows, testing and limitations](CreatureDesignerPhaseC2.md). C1 verification figures below remain historical C1 evidence.

Phase C3 adds HTML-authored visual behavior blocks, a bounded shared interpreter integrated with the existing mob scheduler, sensory recognition and reusable dialogue/lessons. See [C3 behavior schema, walkthroughs, benchmarks and limitations](CreatureDesignerPhaseC3Behaviors.md). Authored programs belong to the species definition; execution state belongs to each mob and never enters HTML.

## Inspection: source-of-truth boundaries before changes

Ordinary GameView HTML embeds declarative world state in `<script id="nodevision-metaworld" type="application/json" data-nodevision-meta-world>`. `MetaWorldLoader` validates structured objects; `worldLoading` reconstructs them in the existing GameView scene. `worldSave` replaces this block while retaining unrelated HTML. `WorldDocumentDrafts` and live-file content retain unsaved edits. The layer bridge records world-definition snapshots for undo/redo and reconstructs managed objects. Viewer restrictions guard authoring APIs.

Before C1, `Mobs/Registry.mjs` and `BrownHareAnatomy.mjs` owned the species configuration, while world documents contained authored `type: mob` instances. Runtime owns transient body pose, navigation, perception and injury. `Assets` leases GLB geometry/materials; each instance owns independent anatomy and perception. The authored root transform is distinct from simulated body motion. Existing file creation, `/api/file-save`, Notebook listing, and static `/BuiltIn/` resources provide persistence and resource access.

C1 retains these boundaries except that validated **HTML world metadata owns species composition/configuration**. Reusable runtime code implements components. World-instance references own placement and permitted overrides. Simulation remains transient. No executable document script is evaluated to resolve a creature.

## Creature document and root

The canonical hare is [BrownHare.html](../ApplicationSystem/public/BuiltIn/Mobs/Mammals/BrownHare/BrownHare.html). It uses the ordinary HTML world block, not a new extension or a second renderer. `metadata.creature.documentType = "creature"` and `schemaVersion = 1` identify the role; neither the filename nor page title determines species identity.

The creature metadata contains a stable `documentId`, `speciesId`, display/scientific name, author, description, taxonomy, root ID, resource dependencies, attribution/license, a supported component map and the species `definition`. The world has exactly one ordinary `type: "mob"` object with `creatureRoot: true`. This semantic root owns the assembly; anatomy parts have explicit IDs/parents. Legacy C1 boxes use root-local metre coordinates; C2 authored anatomy uses parent-local transforms and multiple regions. They are independent of GLB bones/meshes. The current schema deliberately permits one rigid GLB appearance and one compatible component set, rather than arbitrary executable components or recursively included worlds.

Structural excerpt (the complete validated definition is in the linked canonical HTML; this is not a creation template):

```html
<script id="nodevision-metaworld" type="application/json" data-nodevision-meta-world>
{
  "name": "Brown Hare",
  "type": "meta-world",
  "metadata": {
    "objectGroundOnly": true,
    "creature": {
      "documentType": "creature",
      "schemaVersion": 1,
      "documentId": "nodevision:brown-hare",
      "speciesId": "brown-hare",
      "displayName": "Brown Hare",
      "rootId": "creature-root"
    }
  },
  "objects": [{
    "id": "creature-root", "type": "mob", "creatureRoot": true,
    "speciesId": "brown-hare", "position": [0,0,0],
    "rotation": [0,0,0], "scale": [1,1,1]
  }]
}
</script>
```

The factory behind **File → New → Creature** supplies the omitted author, taxonomy, license, dependencies and full supported configuration. It starts with the existing compatible rigid Rabbit/anatomy template and assigns new user species/document identities. No JavaScript programming is needed to create or configure it.

## Standalone Editor and Viewer

Both open the same HTML through the existing GameView loader. The creature role disables the default ground/landscape, supplies camera/environment metadata, and instantiates exactly one authoritative root. Existing engine lighting, camera navigation, selection, transform gizmos and inventory remain available under their normal permissions. The current representation is the existing procedural rigid-model animation adapter; imported GLB animations are not implicitly substituted for it.

The preview initially anchors the creature at its authored transform and plays idle motion. **Creature preview → Simulate behavior on temporary support** enables the actual mob simulation on a transient support collider. This works in Viewer too, without granting authoring permission. The normal player can be sensed; use existing movement, inventory and Total Concealment where appropriate. Disabling preview simulation resets to the authored pose. The support is not a world object, is removed on disable/close, and is never serialized or inserted elsewhere. No procedural terrain is generated for a creature document.

Select the root in the existing inspector to edit metadata, species/document identity, classification, GLB reference, attribution/license, model yaw, normalization length and additional resource dependencies. Import GLB uses the existing `/api/file/upload-binary` adapter; an existing Notebook filename is preserved by choosing a new UUID-prefixed upload name. Use normal root transforms for orientation/scale/position. The existing anatomy/condition/capability inspector is reused. The supported component map is explicitly shown as read-only; C2 exposes anatomical construction through Layers, the inspector and existing viewport gizmos. Broader component-type composition and skeletal animation-binding editing remain deferred.

For the root's behavior controls, edits update the HTML species defaults. Root duplication/deletion controls are suppressed, and the authoritative root cannot be removed through the layer bridge. The schema rejects extra authored objects instead of silently treating nearby objects as creature components.

## Definition, assembly and instances

`Creatures/Document.mjs` validates the declarative HTML data. `Mobs/Registry.mjs` resolves/cache-coalesces documents into immutable assemblies. `Mobs/Runtime.mjs` and its existing navigation, anatomy, perception, animation and collision implementations create independent instances. Presentation remains the existing Three.js model/proxy system.

Insertion resolves the HTML without mounting another GameView. It copies only root placement defaults and a reference, not preview lights, camera, helpers, inventory or a second world. The placement point replaces the standalone root's position; document root orientation composes with aimed placement orientation, and root scale becomes the new instance's authored scale. Existing instances retain their own authored placement when a definition reloads. Species appearance length/yaw, anatomy, sensory configuration and behavior defaults remain definition data.

An instance stores stable `id`, `speciesId`, `creatureDocument`, placement and explicit behavior overrides. For example:

```json
{
  "type": "mob",
  "id": "unique-instance-id",
  "speciesId": "brown-hare",
  "creatureDocument": "/BuiltIn/Mobs/Mammals/BrownHare/BrownHare.html",
  "position": [20,1,20],
  "rotation": [0,0,0],
  "scale": [1,1,1],
  "behavior": {}
}
```

Referenced instances serialize only explicit behavior overrides, so materialized defaults do not accidentally mask future definition edits. Legacy built-in instances retain their existing serialization semantics. Root behavior comes from the document defaults rather than a redundant preview override.

Each runtime owns its injury ledger, sensory observations, behavior timers, navigation, velocity and animation clock. These remain session-only. The immutable assembly is shared; geometry, materials and textures are leased by canonical GLB URL, including across different creature documents referencing the same model. Different URLs are not deduplicated by file-content hash.

## Brown Hare migration and compatibility

All species assembly/configuration now comes from `BrownHare.html`, including the thirteen anatomy parts, sensory configuration, collision dimensions, model orientation/scale, behavior defaults and procedural animation profile. `Registry.brownHare` and `BrownHareAnatomy.mjs` remain compatibility exports derived from that HTML; they contain no second species-data copy.

Existing authored `speciesId: "brown-hare"` instances without a document reference continue resolving through the built-in compatibility mapping. They are not rewritten merely by opening a world. New menu insertion creates an explicit HTML reference. Original Google Rabbit GLB/OBJ/MTL/texture and attribution remain untouched in `ApplicationSystem/public/BuiltIn/Mobs/Mammals/BrownHare/Models/`. No root-level BuiltIn directory, production resource endpoint or filesystem registry was introduced.

The registry reads the canonical HTML through the normal public static mount. Node verification reads that same built-in HTML file directly; it does not use a generated JavaScript species snapshot. Public packaging already includes HTML resources.

## Custom creation and discovery

1. Choose **File → New → Creature**, choose a Notebook `.html` path, then open it in Virtual World Editor.
2. Select the one root; enter metadata and classification in Creature Designer.
3. Import a GLB or enter an existing GLB resource reference. Set model yaw/length and root transforms. Update attribution/license when changing models.
4. Save normally. Open in Viewer to observe the same assembly without authoring access.
5. Open an ordinary world, then choose **Insert → Game Object → Mob → User → classification → creature**.
6. Built-in insertion is **Mob → Nodevision → Animal → Brown Hare**.

The existing Game Object toolbar's Mob slot now presents a metadata-driven hierarchy. Discovery invokes the existing Notebook content-search API only on first menu use or explicit **Refresh creature definitions**. It parses/validates bounded HTML metadata and checks dependencies; it never instantiates candidate worlds or loads their GLBs to build the menu. Results are cached, with a visible warning at the existing search API's 300-result ceiling.

Classification is independent of directory layout. Refresh picks up renamed/deleted files, changed display names/taxonomy, invalid definitions and missing assets. Duplicate user species or document identities are quarantined from the menu; built-in identities cannot be shadowed by user files. Explicit world references remain path-based rather than guessing which duplicate is intended.

## Resource references, portability and reload

Models/dependencies resolve relative to the creature HTML, not to its destination world. Creature references in a world resolve relative to that world. Canonical `/Notebook/...` and `/BuiltIn/...` references are supported; machine-specific filesystem paths, external executable/network schemes and escapes outside these roots are rejected. Existing relative instance references are preserved when serialized. No complete HTML definition or model is embedded per instance.

A portable user package can be a Notebook folder containing its creature HTML, GLB and attribution/texture dependencies with relative references. Copy that folder using existing Notebook/file operations. The importer uses the existing root-level Notebook upload convention; organize resources with the File Manager and update references in the inspector when packaging them. No archive format or automatic cross-file rename-repair service was added. Model-contained external textures/buffers use existing GLTFLoader resolution; declare supporting resources through the inspector. C1 does not rewrite GLB contents or infer an export package from arbitrary model internals.

**Save As Creature** preserves unrelated HTML through the existing world-block injection function, creates a new Notebook HTML file, and keeps dependencies pointing to their original resources. Relative dependencies are resolved explicitly to their canonical Notebook/BuiltIn locations for this relocation; assets are not copied or flattened. A built-in Save As forks species/document identity so the built-in remains authoritative and unmodified. For custom Save As relocation, identity is retained: remove the old file or change identities when deliberately maintaining distinct copies, otherwise discovery reports duplicates.

Each world open resolves each distinct external document once, with concurrent requests coalesced. Insertion explicitly resolves the latest document. Existing active instances keep their captured immutable assembly. Direct anatomical definition edits replace transient anatomy/perception configuration and reconcile helpers while preserving the model lease. Appearance/physical dimensions changes rebuild the standalone preview. Definition edits reset transient injury/behavior state; they do not mutate other active world instances. **Reload definition (resets injury)** explicitly reconstructs the selected referenced instance from current source and leaves other active instances untouched. Reopening a world reconstructs all instances according to the established injury reset policy. Removed/renamed anatomy IDs do not get merged into injured live state. A changed species identity requires explicit relinking.

Resolution honors an existing live HTML content provider where available; otherwise it reads saved HTML. Unsaved Creature Designer world drafts stay local until saved. A missing/malformed external definition creates a visible, non-solid placeholder retaining its stable ID/reference. It never silently substitutes Brown Hare. Restore/relink the HTML and reload to recover the real runtime. The existing inspector exposes relink/reload controls.

## History, save and permissions

Normal Save uses the existing world serializer and updates only the canonical world block, preserving unrelated authored HTML. The loader and draft reader prefer the canonical block over unrelated JSON scripts. Duplicate canonical blocks are rejected. Creature history snapshots extend the existing layer history with creature metadata as well as root state; ordinary world snapshot behavior is unchanged.

Definition/property edits and root transforms support undo/redo. Simulation, injuries, preview support, inventory modifiers and model-loading state create no authoring history entries. Unsaved creature edits use `WorldDocumentDrafts`, are restored after view closure, prompt on switching to a different file, and participate in a before-unload warning. Session drafts are not durable backups across application restart. Save clears the draft baseline. Built-in resources require Save As to a Notebook file; normal Save cannot accidentally create a Notebook shadow of a BuiltIn path.

Existing Viewer guards deny metadata/root debugging and authored saves. Viewer preview simulation is transient. Existing explicit gameplay/tool rules still govern Sword and other inventory tools; a creature document grants no extra authoring or gameplay privilege.

## Validation and security

The supported schema validates document/world role, version, identities, one root, finite/bounded transforms, supported component types, valid GLB/resource references, declared model/attribution dependencies, unique internal IDs, root-local anatomy, parent existence/cycles, viability/sensory capability references and behavior thresholds. HTML assembly inclusion is unsupported and rejected, preventing recursive/cyclic creature-world loading. Document text is limited to 2 MiB, hierarchy depth to 32, anatomy to 128 parts and dependency lists to 32. Prototype-shaped configuration keys are rejected.

Neither metadata extraction nor instance creation executes embedded scripts. Reusable runtime modules implement an explicit supported component allowlist. Ordinary HTML editing remains available, but its script content is not an executable creature-definition language.

## Runtime extension guide

To add a reusable component type, implement a generic runtime system and its validation contract, add an explicit versioned type to the component allowlist/mapping, and integrate its lifecycle into the same mob runtime and serializer boundaries. Add declarative configuration to creature HTML and tests covering validation, independent state, history/persistence and cleanup. Do not add a new hardcoded species class, custom renderer, embedded runtime source, or a competing creature file extension.

C1 supports the existing rigid GLB/functional-box anatomy/sensory/ground-navigation/wander-flee/procedural-rigid combination. C2 extends that adapter with parent-local box/sphere/capsule regions and graphical functional anatomy editing, without changing the HTML authority or instance references. Subsequent phases can expose broader component composition, skeletal/clip animation bindings, additional locomotion profiles and combat definitions. The current anatomical hierarchy remains usable even when a model has no bones.

## Verification and measurements

Raw evidence: [production browser](CreatureDesignerBrowser.json), [performance](CreatureDesignerPerformance.json), and the final source/preservation validation report.

The production scenario uses the actual GameView, inspector, history, upload/save/create/delete routes, Notebook search and Mob menu with temporary Notebook files. It covers canonical Editor/Viewer opening, one root/no terrain, Viewer restrictions and optional simulation, custom creation and GLB import, metadata/model/root transforms, undo/redo, unsaved draft restoration, save/reopen/Save As with unrelated HTML, user discovery, two hares and a custom instance, independent damage, explicit reload, stable instance IDs, reference-only persistence, deleted-definition placeholders and recovery, and world cleanup.

The schema/runtime cases cover malformed/ambiguous HTML, inert embedded scripts, role/version/root enforcement, cycles/duplicates, unsupported components, invalid transforms/resources, relative paths, cache/reload semantics, cross-document shared GLB resources, independent anatomy and missing references. Existing MetaWorld and GameView suites exercise terrain/navigation, anatomy/senses, archery, melee, concealment and permissions. Final command results are recorded below after verification.

### Resource benchmark

Chromium/SwiftShader at 640×480; two trials reverse scenario order. Each uses 30 warm-up plus 180 measured real RAF frames and 30 Hz simulation. Cases are one anchored standalone root, twenty instances from one document, and thirty instances from three documents. They use the actual Rabbit GLB, synthetic flat support and no rendered terrain/vegetation. Document resolution includes HTML fetching and dependency HEAD checks; parsing/validation CPU is recorded separately from those checks. Assembly and model-ready timings are wall-clock measurements.

| Scenario | Resolution ms | Assembly ms | Model ready ms | Mean runtime ms/frame |
| --- | --- | --- | --- | --- |
| 1 standalone / 1 document | 17.2–18.9 | 0.9–4.5 | 10.9–36.9 | 0.068–0.118 |
| 20 instances / 1 document | 20.9–64.5 | 4.4–26.2 | 12.4–20.4 | 1.117–1.462 |
| 30 instances / 3 documents | 40.2–40.5 | 5.3–11.2 | 12.0–13.1 | 1.599–1.604 |

Each case used **one GLB request/decode and one live asset entry**, with 1/20/30 independent leases. Final visible draw calls were 1/20/30; renderer geometry counts were 2/21/31 (one shared model geometry plus independent physical proxies), with one texture. After disposal every case returned renderer geometry/texture counts and active model leases/entries to zero. No document parsing occurs in animation frames.

Mean frame pacing was approximately 16.665 ms and p95 approximately 17.0–17.2 ms. This is a software-renderer RAF floor, not evidence of hardware FPS improvement. Warm-up, module/shader caches, JIT and local HTTP scheduling explain substantial model/assembly timing spread. These are isolated component benchmarks, not a native GPU profile or a large rendered geographic world benchmark. Allocation counts do not prove absence of every JavaScript heap leak; validated definition metadata remains cached until page lifecycle ends.

### Final validation

- **9 focused creature cases** pass; the complete **68 MetaWorld test files** and **11 GameView test files** pass.
- Production C1 browser integration passes the full built-in/custom workflow, Viewer simulation/permissions, root transform defaults, authored HTML preservation, definition inheritance/reload, missing-reference save/recovery and cleanup.
- Existing production Archery Bow, Archery Target, Raycasting Teleporter and M1.4 concealment/sword scenarios pass against the migrated hare, including the legacy `brown-hare` path. Historical phase reports/screenshots are retained separately; C1 records compatibility-run summaries in its own validation report.
- A heavily concurrent initial MetaWorld run reported an Infinite Terrain process failure. All five cases passed independently; the full suite then passed with `--test-concurrency=2`. No terrain code or test assertion was weakened. Use limited concurrency for the resource-heavy full suite in this environment.
- C1 end-to-end UI testing used Chromium. A separate native desktop C1 workflow was not run. The performance harness uses SwiftShader and does not establish hardware GPU performance.
- `Notebook/test.html` and the original Rabbit models, texture and license notice remain byte-for-byte unchanged, verified by SHA-256. Only the new canonical HTML and a README pointer were added beside the original model bundle.

[Validation report and source hashes](CreatureDesignerValidation.json).

```sh
node --import ./scripts/register-browser-test-imports.mjs ApplicationSystem/public/MetaWorld/Creatures/Creature.test.mjs
node --import ./scripts/register-browser-test-imports.mjs --test --test-concurrency=2 $(find ApplicationSystem/public/MetaWorld -name '*.test.mjs')
node --import ./scripts/register-browser-test-imports.mjs --test --test-concurrency=2 $(find ApplicationSystem/public/PanelInstances/ViewPanels/GameViewDependencies -name '*.test.mjs')
node scripts/test-c1.mjs
node scripts/test-c1.mjs performance
```

`scripts/validate-c1.mjs` captures the local verification logs/reports, preservation checks and source hashes after the above and existing compatibility runners have completed. Drafts, resource checks and menus operate on file/open/edit events; HTML is never reparsed per animation frame.

## C3.1 capability and library ownership

Creature definitions may declare capability providers, equipment/trait defaults, granted skills and HTML library references. Shared frozen runtime expansion is resolved outside the render loop and never serialized as authored species data. Each mob owns its capability revisions, cooldowns, execution and temporary skill objects. See [C3.1 architecture, workflows and verification](CreatureDesignerPhaseC3_1CapabilitiesSkillsBehaviors.md). Existing gameplay targets and scoring remain authoritative; runtime-generated targets are filtered before type-specific world serialization.
