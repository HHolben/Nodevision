# Sandbox Focus Sessions

Select an HTML page in a workspace panel, open the normal Sessions selector, and choose **Sandbox — Build** or **Sandbox — Play**. Both open the normal Game View in a temporary tab. Build retains world authoring, Layers, and normal world saving. Play retains navigation, gameplay use targets, and pause while denying authoring. Use **Exit Sandbox** to return to the original tab. Escape remains owned by Game View: it releases the pointer and follows the existing pause behavior.

Save from Build to persist the world into its HTML document. A newly created world is initially an unsaved draft; a status message explains this. Exiting and reopening a session in the same application retains that draft and seed. Reloading the application before saving loses unsaved drafts, as expected for in-memory work. Play can create and explore an initial draft; switch to Build to save it.

## Architecture found

Built-in session files live in `ApplicationSystem/Sessions/BuiltIn/`. `SessionRegistry` discovers files and reads their title/description comments for the existing selector. `SessionController` reads a selected script, takes UI ownership, creates a `SessionExecutionContext`, and runs `SessionRuntime`. Commands pass through the shared session-safe command registry; named event waits pass through the event registry. `executionContext.addCleanup` owns teardown.

Most existing focus sessions hide the app shell behind a session root and intercept Escape. Sandbox adds a small `SessionUiOwnership.useWorkspace()` option which restores the shell and relinquishes Escape interception. This preserves the existing Game View toolbar and pause system. Other focus sessions retain their previous UI behavior.

Workspace panels are preserved in tabs. Sandbox opens a temporary normal `GameView` tab and restores the previous tab on exit. Game View's normal editing path opens MetaWorld Layers. A Layers split created for Sandbox is removed on exit without replacing existing editor contents. An existing split is retained.

File resolution prefers the active tab's file, then the selected file through the existing active-file resolver. The world startup adapter reads matching live editor HTML when available, otherwise the notebook HTML. The ordinary loader's no-world path normally creates the canonical equation-plane/webpage starter world. Sandbox supplies a declarative definition through a new optional loader hook instead; default non-Sandbox loading retains its existing behavior.

## Registration and startup

`SandboxBuild.NodevisionSession.js` and `SandboxPlay.NodevisionSession.js` call the same session-safe command, `sandbox.open`, with an explicit `build` or `play` argument, then wait for the registered `sandbox.finished` event. No registry list is hard-coded: the server's normal built-in discovery exposes both entries.

`SandboxFocusSession` owns session lifecycle and presentation. `SandboxWorkspace` owns the temporary tab and restoration. `SandboxWorldStartup` connects a reusable declarative planner and document-draft store to the normal Game View loader/serializer. None generates noise, meshes, collision, or chunks. No session timer or per-frame world-creation decision was introduced.

Game View now optionally accepts `resolveWorldDefinition`, `viewPermissions`, `beforeWorldDispose`, and `onWorldSaved`, and exposes `panel.worldReady`. The ordinary renderer, input, world loading, Layers, resource disposal, and startup error/retry screen remain in use. Loader errors propagate to the existing retry screen when requested by the panel. Failed partial loads are not captured as replacement drafts.

## Exact generation policy

`classifySandboxWorld` applies these rules in order:

1. No embedded world definition: creation is allowed.
2. The definition is structurally identical to `createDefaultHtmlWorld(filePath)`, ignoring object-key order: creation is allowed. Object IDs, types, transforms, materials, source URL, metadata, and all other fields must match. An object count alone is never sufficient.
3. An object has type `procedural-voxel-world`: reuse the existing whole definition, including ordinary authored objects and its seed.
4. Everything else: preserve the definition and show a concise “automatic terrain creation skipped” status. This includes explicitly empty worlds, changed defaults, and unrecognized content.

The check is deliberately stricter than guessing whether a previously normalized/saved starter world has been edited. Additional or modified fields make it authored. An already-open Game View for the same page is captured through the ordinary serializer before replacement, preserving unsaved authored changes rather than treating it as an empty page.

Embedded world recognition uses the existing loader's script conventions, including legacy application/json candidates. Ambiguous/unreadable JSON is not replaced. Legacy JSON comments are accepted without stripping comment-like text inside quoted strings. If the HTML's embedded world changes externally, a stale draft is discarded in favor of the page. Editing unrelated HTML prose does not discard the draft or regenerate its seed.

## Generated world and persistence

New worlds contain one normal `procedural-voxel-world` object:

```json
{
  "id": "procedural-terrain",
  "type": "procedural-voxel-world",
  "position": [-500, 0, -500],
  "size": [1000, 128, 1000],
  "voxelSize": 0.25,
  "generator": { "id": "nodevision-terrain-v1", "version": 1, "seed": 123456 },
  "chunks": { "voxelsPerAxis": 32, "loadRadius": 8 }
}
```

The sample seed above is illustrative. Creation calls `crypto.getRandomValues(new Int32Array(1))` once and places that signed integer in the definition. The existing generator ID/version and validation are reused unchanged. The world spans 4000 × 4000 horizontal cells, with 8 m chunk edges. Root metadata uses object-ground-only mode so the old fallback floor does not interfere.

`WorldDocumentDrafts` stores only declarative definitions and their source baseline, keyed by normalized HTML path. It stores no scene graph, chunk arrays, or renderer state. The runtime remains the live world authority; session exit takes a snapshot using the normal `buildWorldDefinition` serializer. Reentry consumes that draft rather than creating another terrain. Drafts are memory-only and create no sidecar files.

Build's normal world save merges the serialized definition into the current HTML, preferring a matching live editor buffer for Sandbox views, and uses the existing `/api/save` path. The normal procedural serializer keeps the generator definition and excludes runtime chunks. Successful saves advance the draft's source baseline so later unsaved world edits are retained correctly. Session mode and temporary permission scopes are not written into the world.

Spawn remains `{x:0,y:1.75,z:0}` in the new declarative world. During normal world loading, the existing procedural runtime's `prepareSpawn` clamps horizontal coordinates and raises the player to its deterministic sampled terrain height plus player clearance. The session contains no terrain-height algorithm.

## Build and Play permissions

Build uses the existing creative mode, normal toolbars, selection/manipulation, Layers, and world save. Procedural terrain itself remains read-only; ordinary authored objects remain editable.

Play uses survival mode and a temporary `authoring:false` permission scope. `WorldAuthoringPermissions` centralizes the additional restriction. It applies before creative overrides in the player ability rules, guards movement editing entry points and selected authoring tools, guards layer mutations/history, and blocks authoring controller entry points and saving. Attempting to switch to creative or opening another Game View during Play cannot bypass the scope. Existing saved `playerRules` are not modified.

Movement, looking, jumping, use targets, console gameplay, and portal travel remain on their normal paths. Tool-based authoring is disabled broadly for this MVP; finer gameplay-tool permissions can be added later. No new editing tools or separate engine are introduced. On exit the scope is released, temporary controls and the Game View tab are removed, and the previous workspace mode is restored. Ordinary Game Views outside a restricted scope preserve their existing permission behavior.

## Verification

Passed:

- Six focused planner/draft/permission tests: missing and canonical defaults; exact finite generator settings; stable seed reuse; authored/changed/empty world protection; draft retention across prose edits and invalidation on world changes; temporary permission cleanup; legacy commented JSON and malformed-world rejection.
- Built-in session discovery, command metadata, and completion-event registration.
- Existing Session registry/runtime/command adapter/event bridge and command registry tests, plus world routes, pause state, and renderer creation: nine test files including the new discovery test.
- Seven existing procedural voxel infrastructure tests.
- Browser integration using the actual Session runtime/command, Game View setup, renderer, loader, movement functions, layer bridge, save path, and teardown. It checks Build and Play launch, visible terrain, spawn, walking, pause, saved/reopened seed identity, one terrain definition, authored object preservation, no chunk serialization, post-save unsaved changes, no-save reentry, real voxel-placement and break entry-point restrictions, editor/layer restrictions, Exit Sandbox (including cancellation while startup is pending), and restoration of the original tab.
- Existing ordinary-world browser regression: load, selection, transforms, deletion, undo/redo, save/reload, analytic plane rendering/collision, and scoped Escape/input behavior.

Representative commands:

```sh
node --loader ./scripts/html-test-loader.mjs ApplicationSystem/public/MetaWorld/SandboxWorldPlanner.test.mjs
node ApplicationSystem/Sessions/SandboxSessions.test.mjs
node ApplicationSystem/public/MetaWorld/ProceduralVoxelWorld/ProceduralVoxelWorld.test.mjs
env -u ELECTRON_RUN_AS_NODE NV_WORLD_BROWSER=sandbox-session-browser.mjs node_modules/.bin/electron scripts/procedural-world.electron.cjs --no-sandbox
env -u ELECTRON_RUN_AS_NODE NV_WORLD_BROWSER=world-browser.mjs node_modules/.bin/electron scripts/procedural-world.electron.cjs --no-sandbox
```

The browser fixture uses a minimal tabbed shell and in-memory HTML backend. Its toolbar renderer and Layers presentation are fixture substitutes; the production session runtime, tab lifecycle, world engine, and layer APIs run directly. It is not a full application-shell click automation test. The fixture reports expected absent optional material-catalog/avatar assets and occasional software-renderer/ResizeObserver warnings; tested assertions complete without unhandled promise failures.

## Files added and changed

Added:

- `ApplicationSystem/Sessions/BuiltIn/SandboxBuild.NodevisionSession.js`
- `ApplicationSystem/Sessions/BuiltIn/SandboxPlay.NodevisionSession.js`
- `ApplicationSystem/Sessions/SandboxSessions.test.mjs`
- `ApplicationSystem/public/Sessions/SandboxFocusSession.mjs`
- `ApplicationSystem/public/Sessions/SandboxWorkspace.mjs`
- `ApplicationSystem/public/Sessions/SandboxWorldStartup.mjs`
- `ApplicationSystem/public/MetaWorld/SandboxWorldPlanner.mjs`
- `ApplicationSystem/public/MetaWorld/SandboxWorldPlanner.test.mjs`
- `ApplicationSystem/public/MetaWorld/WorldDocumentDrafts.mjs`
- `ApplicationSystem/public/MetaWorld/WorldAuthoringPermissions.mjs`
- `scripts/sandbox-session-browser.mjs`
- This report.

Changed: Session UI ownership; shared command definitions/registry/system handlers/event registry; Game View panel/startup, world loader/save, movement context/player rules; the Virtual World Editing callback; and the existing Electron world regression runner. Changes to oversized modules are small integration hooks. New native modules are below 200 nonblank/noncomment lines. The procedural generator, coordinate, meshing, chunk, and collision implementation was not redesigned or changed by this task. Unrelated pre-existing workspace changes were preserved.

## Limitations and next milestone

Unsaved drafts survive session exit but not application reload. Save from Build for durable persistence. The existing global Game View engine supports one active world; Sandbox follows that constraint. If another already-open Game View is displaced, its matching world is captured, but the old tab's engine is not independently kept running. Canonical-default detection intentionally favors preserving ambiguous worlds. Play's authoring restriction is an application interaction boundary, not a security sandbox against arbitrary developer-console code.

Terrain retains the prior MVP limits: read-only voxels, heightfield collision, translation-only transforms, and synchronous bounded chunk builds that can cause frame spikes. Session startup adds no per-frame terrain work and does not change the released generator version.

The smallest next functional milestone is sparse procedural voxel overrides and delta persistence, connected to the existing placement/break tools in Build while leaving Play restricted. Automatic portal generation remains unimplemented. A future reusable HTML-link planner should run alongside `planSandboxWorld` during world creation, produce normal portal object definitions, and preserve authored worlds; it should not add a renderer or per-frame link polling to the session.
