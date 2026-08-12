// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/GameViewDependencies/Abilities/CommandAbilities/MovementUpdateLoop.mjs
// This file composes the Game View movement update frame from focused ability modules. It preserves the original frame order while keeping command, movement, interaction, and construction responsibilities independently readable.

export function createMovementUpdateLoop(ctx) {
  const { controls, getBindings, movementState } = ctx;

  return function update() {
    if (ctx.api.runFramePreflight().stop) return;
    const nowMs = performance.now();
    const baseSpeed = 0.2;
    const bindings = getBindings();
    const inputState = ctx.api.buildInputState(bindings);
    const inventory = window.VRWorldContext?.inventory;
    ctx.api.handleInventoryToggles(inputState, inventory);
    applySkipClickFrame(ctx, inputState);
    if (ctx.api.handleStlEditUse(inputState.use)) return;
    if (ctx.api.handleInventoryMenu(inputState, inventory)) return;
    const crouching = inputState.crouch;
    const crawling = inputState.crawl;
    const inEditorMode = ctx.api.playerMode() === "creative";
    const editorGravityEnabled = movementState.editorGravityEnabled !== false;
    const editorGravityDisabled = inEditorMode && !editorGravityEnabled;
    ctx.api.updateInputLatches(inputState, editorGravityDisabled);
    ctx.api.applyEditorModeState({ inputState, crouching, crawling, inEditorMode });
    ctx.api.applyPlayerMovementFrame({
      inputState,
      crouching,
      crawling,
      inEditorMode,
      editorGravityDisabled,
      speed: baseSpeed
    });
    ctx.api.handleCameraCommands(inputState);
    ctx.api.updateTapeMeasurePreview();
    if (ctx.api.handleInspectAndCollision({ inspecting: inputState.inspect, nowMs })) return;
    if (ctx.api.handleEditorSelectionCommands({ inputState, inEditorMode, nowMs })) return;
    if (ctx.api.handleUsePhase({ inputState, using: inputState.use, nowMs })) return;
    if (ctx.api.handleAttackPhase({ attacking: inputState.attack, nowMs })) return;
    ctx.api.handlePassivePortalTravel(inputState.inspect);
  };
}

function applySkipClickFrame(ctx, inputState) {
  if (!ctx.movementState?.skipClickFrame) return;
  inputState.use = false;
  inputState.stretch = false;
  ctx.movementState.skipClickFrame = false;
}
