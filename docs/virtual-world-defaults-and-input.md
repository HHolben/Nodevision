# HTML world defaults and Escape behavior

The normal HTML Module Map entries remain `ViewHTML.mjs` / `HTMLeditor.mjs`. Entering a Virtual World explicitly opens `GameView.mjs`; both Virtual World Viewing and Editing use its shared `initScene.mjs` runtime. World JSON is inert metadata inside the HTML document. The default webpage object loads the Notebook HTML URL, not GameView or the application shell, so merely displaying it does not enter another world.

## Findings and defaults

`/api/load-world` reads embedded JSON. Previously a page with no definition returned an error, leaving the renderer's unowned `PlaneGeometry(50, 50)` gray ground visible. Existing equation-plane objects already had mathematical collision/picking, and iframe objects already supported DOM content, selection, transforms, deletion, and save fields. Their rendering and persistence had gaps relevant to these defaults: equation planes ignored saved transforms; object IDs and rotations were omitted from ordinary serialization; iframe DOM content used a bounding rectangle instead of perspective; and layer history recreated expression objects but not deleted iframe/equation objects.

`MetaWorld/DefaultHtmlWorld.mjs` now generates two canonical objects only when an HTML/HTM page has no embedded definition: an infinite `equation-collider-plane` at y=0 and a 2.4 × 1.35 m iframe centered at (0, 1.75, -1). Three.js cameras face -Z, and the iframe's front faces +Z. The initial player is at (0, 1.75, 0), with level pitch and zero yaw. The iframe source uses the existing `/Notebook/` convention with encoded path components. Asset import into a page without a definition uses the same factory. Existing definitions, including explicit empty object arrays, never receive these defaults.

Creation through world viewing initializes the in-memory world; the ordinary Creative-mode save writes its JSON into the HTML. Viewing alone does not rewrite the page. Once saved, moved/deleted defaults stay moved/deleted. `metadata.objectGroundOnly` removes the legacy renderer floor from the scene and disables its and implicit y=0 collision floor for these worlds even if all objects are later deleted. Legacy saved worlds keep their previous floor behavior.

`infinitePlane.mjs` extends the existing equation object. A four-vertex viewport quad analytically intersects camera rays with the object's local y=0 plane and writes projected depth. Geometry is created once; rendering updates two reused matrix uniforms, without large meshes or searches for default objects. Picking and collision derive the plane from its world transform. Rotation, translation, and scale persist using the same object definition and serialization path. Horizontal ground contact does not block walking, and deleting the plane removes both visible and mathematical ground.

`worldLoading.mjs`, `worldSave.mjs`, and the existing Layers history now preserve these objects' IDs, rotations, scale/size, and deletion through save/reload and undo/redo. Existing grab, translate, rotate, stretch, and inspector entry points record transformations in that history. `iframeProjection.mjs` projects a fixed 1024-pixel page viewport into the object's plane using CSS matrix3d; camera movement changes perspective without continually reflowing the HTML. Source resolution is cached until its input changes.

## Escape and pause

The old standalone `VirtualWorld.html` / `VirtualWorldGame.js` has a pause menu, but GameView does not load those scripts or that DOM. Its prior pause command merely unlocked controls; `FramePreflightAbility` returned before player physics whenever capture was absent, while other render-loop work continued. Global input handlers also recorded toolbar clicks as gameplay input.

`worldPauseState.mjs` separates captured/free from paused and advances Escape synchronously: captured → free/running → paused → resumed, with capture requested. No timer or frame polling decides Escape transitions. `worldPause.mjs` supplies the shared GameView menu and one pause/resume path for both modes, explicit controls, and keyboard input. This fills the missing GameView menu rather than trying to mount the independent standalone game engine. The standalone page itself is unchanged.

Only the applicable active GameView context handles Escape. Repeat keydown is ignored, keyup releases the latch, and pointer-lock loss merely changes capture state. This also accommodates browsers that consume the first Escape keydown to exit pointer lock. Toolbar clicks neither capture nor pause. Input handlers reject toolbar/text-field gameplay input, clear stale inputs on focus changes, and retain canvas recapture. Pause gates simulation updates, suspends active world audio, and holds temporal time without accumulating elapsed wall time. Rendering remains available for the menu. Resume restores activity and requests native capture; denial leaves a running pointer-free world that can be recaptured with a canvas click. Panel disposal removes listeners and the menu; context changes release stale capture.

## Validation and limits

### GameView startup recovery

The reported `BindToCurrentSequence failed` log comes from Chromium rejecting WebGL context creation, before world content is loaded. The three preceding module 404s were unrelated: the toolbar supplies `ViewPanels`, while the resolver only recognized `ViewPanel`. The resolver now accepts both and searches the known folder first.

`createWorldRenderer.mjs` acquires a context explicitly, tries WebGL2 without antialiasing before falling back to WebGL1, and passes the successful context to Three. If all attempts fail, it preserves browser diagnostics and throws a classified error. GameView catches startup errors, cleans up partially initialized resources, and displays a Retry button. A disposed panel ignores pending startup results. This fallback cannot repair a browser graphics backend that rejects every context request; restarting the browser/app or correcting its graphics configuration may still be necessary.

The inspector creates its renderer only when a target is inspected. Preview failure leaves object properties and the main world available. Refresh retries the preview; hiding stops its animation, and disposal releases its context. GameView also disposes the temporal panel's interval during teardown.

Run `node ApplicationSystem/public/PanelInstances/ViewPanels/GameViewDependencies/createWorldRenderer.test.mjs` and `python3 scripts/test-svg-layers-browser.py --world-startup` for this regression. The browser test runs actual GameView initialization with controlled context rejection, tests repeated Retry and recovery with a real context without antialiasing, optional preview failure/recovery, partial startup cleanup, and closing during startup. It does not reproduce the user's particular Mesa/ANGLE failure.

Run:

```sh
node --test ApplicationSystem/server/routes/worldRoutes.test.mjs ApplicationSystem/public/PanelInstances/ViewPanels/GameViewDependencies/worldPauseState.test.mjs
python3 scripts/test-svg-layers-browser.py --world
```

The Node tests exercise the real loading endpoint with temporary HTML files, preserve existing and empty definitions, and test pause transitions without pointer-event timing assumptions. The Chromium suite uses real Three.js r128, world loading, Layers selection/history, save injection, plane picking/collision, shader compilation and rendered pixels, and reload after object transforms/deletion. It tests the real DOM input adapter and PointerLockControls with deterministic native-lock notifications, including rapid presses, repeat, explicit resume, toolbar input, text fields, and inactive contexts.

Native OS Escape delivery and browser user-gesture rules cannot be certified by synthetic events. Pointer-lock notifications are simulated in the integration test; native capture still requires browser permission/user activation. The infinite-plane shader needs WebGL2 or fragment-depth support. The DOM iframe shares the existing overlay renderer's limitation that ordinary 3D meshes cannot fully occlude HTML content. Page-authored animation inside iframe content is controlled by that webpage, independently of world simulation pause. Complex equation inequalities and temporal/bounded equation objects retain their existing behavior and are not converted into infinite objects.
