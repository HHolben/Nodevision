// Nodevision/scripts/world-runtime-pause-browser.mjs
// Checks both GameView modes against the initialized runtime, including temporal pause gates and the shared public pause controls.
export async function checkRuntimePause(panel) {
  const ok = (value, message) => { if (!value) throw Error(message); };
  const context = window.VRWorldContext;
  const canvas = panel._vrCanvas;
  const originalMode = window.NodevisionState.currentMode;
  const originalRequest = canvas.requestPointerLock;
  const originalExit = document.exitPointerLock;
  const descriptor = Object.getOwnPropertyDescriptor(document, 'pointerLockElement');
  const temporal = panel._vrTemporalController;
  const pause = panel._vrPause;
  let locked = null;
  Object.defineProperty(document, 'pointerLockElement', { configurable: true, get: () => locked });
  const change = target => { locked = target; document.dispatchEvent(new Event('pointerlockchange')); };
  canvas.requestPointerLock = () => change(canvas);
  document.exitPointerLock = () => change(null);
  const escape = () => {
    const target = document.activeElement || canvas;
    target.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    target.dispatchEvent(new KeyboardEvent('keyup', { key: 'Escape', bubbles: true }));
  };
  const sampleTime = async () => {
    await new Promise(resolve => setTimeout(resolve, 30));
    temporal.update();
    return temporal.getTimeSeconds();
  };
  try {
    for (const mode of ['Virtual World Viewing', 'Virtual World Editing']) {
      window.NodevisionState.currentMode = mode;
      canvas.click();
      ok(pause.state.captured, `${mode}: established canvas click captures`);
      escape();
      ok(!pause.state.captured && !context.movementState.paused, `${mode}: first Escape frees running world`);
      const runningTime = temporal.getTimeSeconds();
      ok(await sampleTime() > runningTime, `${mode}: unlocked world time advances`);
      escape();
      ok(context.movementState.paused && pause.menu.style.display === 'block', `${mode}: second Escape opens shared pause menu`);
      const pausedTime = temporal.getTimeSeconds();
      ok(await sampleTime() === pausedTime, `${mode}: paused time stays fixed`);
      escape();
      ok(pause.state.captured && !context.movementState.paused, `${mode}: third Escape resumes and captures`);
      ok(await sampleTime() > pausedTime, `${mode}: resumed world time advances`);
      context.pause();
      ok(pause.state.paused, `${mode}: public pause uses the same state`);
      context.resume();
      ok(!pause.state.paused && pause.state.captured, `${mode}: public resume uses the same state`);
    }
    change(null);
    window.NodevisionState.currentMode = 'Default';
    const outside = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    canvas.dispatchEvent(outside);
    ok(!outside.defaultPrevented && !pause.state.paused, 'ordinary modes retain Escape');
  } finally {
    change(null);
    canvas.requestPointerLock = originalRequest;
    document.exitPointerLock = originalExit;
    if (descriptor) Object.defineProperty(document, 'pointerLockElement', descriptor);
    else delete document.pointerLockElement;
    window.NodevisionState.currentMode = originalMode;
  }
}
