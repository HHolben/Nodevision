// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/GameViewDependencies/worldPause.mjs
// This adapter owns the shared GameView pause menu, scoped Escape events, and pointer-lock lifecycle while leaving simulation updates independent of pointer capture.
import { createWorldPauseState } from './worldPauseState.mjs';
import { applyOverlayButtonAppearance } from '/OverlayAppearance.mjs';

// Pause-menu presentation inherits user-defined world and overlay theme settings.
export function installWorldPause({ panel, canvas, controls, movementState, objects, isActive }) {
  const menu = document.createElement('div');
  menu.className = 'nv-world-pause-menu';
  menu.setAttribute('role', 'dialog');
  menu.setAttribute('aria-label', 'World paused');
  Object.assign(menu.style, {
    position: 'absolute', inset: 'var(--nv-world-pause-inset, 30% 20% auto)', zIndex: '100',
    padding: 'var(--nv-world-pause-padding, 20px)', background: 'var(--nv-world-pause-background, rgba(0,0,0,.85))',
    color: 'var(--nv-world-pause-color, white)', font: 'var(--nv-world-pause-font, inherit)',
    textAlign: 'center', display: 'none',
  });
  const heading = document.createElement('h2'); heading.textContent = 'Paused';
  const resume = document.createElement('button'); resume.textContent = 'Resume';
  applyOverlayButtonAppearance(resume);
  menu.append(heading, resume); panel.appendChild(menu);
  const pausedAudio = new Set();
  let disposed = false;
  let captureAllowed = controls.isLocked;
  // Toolbar focus retains the world's context; other cells and preserved hidden tabs do not.
  const active = () => {
    const cell = panel.closest('.panel-cell');
    const tab = panel.closest('.nv-panel-tab-content');
    return !disposed && isActive() && !panel.closest('[hidden], [aria-hidden="true"]')
      && tab?.__nvPanelContentLifecycle?.state !== 'inactive'
      && (!cell || !window.activeCell || window.activeCell === cell);
  };
  const releaseCapture = () => {
    captureAllowed = false;
    if (document.pointerLockElement === canvas) controls.unlock();
  };
  const rejectStaleCapture = () => {
    if (!captureAllowed || !active() || state.paused) releaseCapture();
  };
  const requestCapture = () => {
    if (!active() || state.paused) return;
    captureAllowed = true;
    canvas.focus();
    // A pending native request may finish after pause, deactivation, or disposal.
    try { Promise.resolve(canvas.requestPointerLock()).then(rejectStaleCapture, () => {}); }
    catch { /* Browser may require a fresh canvas click. */ }
  };
  const state = createWorldPauseState({
    captured: controls.isLocked,
    lock: requestCapture,
    unlock: releaseCapture,
    onPause(paused) {
      movementState.paused = paused;
      menu.style.display = paused && active() ? 'block' : 'none';
      if (paused) {
        for (const object of objects) {
          const audio = object?.userData?.soundRuntime?.audio;
          if (audio && !audio.paused) { pausedAudio.add(audio); audio.pause(); }
        }
        if (active()) resume.focus();
      } else {
        for (const audio of pausedAudio) Promise.resolve(audio.play()).catch(() => {});
        pausedAudio.clear();
      }
    }
  });
  canvas.tabIndex = 0;
  const typing = target => target?.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target?.tagName);
  const applicable = event => {
    const overlay = event.target?.closest?.('dialog, [role="dialog"], [role="menu"]');
    const cell = event.target?.closest?.('.panel-cell');
    return active() && !event.defaultPrevented && !typing(event.target)
      && (!overlay || overlay === menu) && (!cell || cell === panel.closest('.panel-cell'));
  };
  let escapeDown = false;
  const keydown = event => {
    if (event.key !== 'Escape' || !applicable(event)) return;
    event.preventDefault(); event.stopPropagation();
    if (event.repeat || escapeDown) return;
    escapeDown = true;
    state.escape();
  };
  const keyup = event => {
    if (event.key !== 'Escape') return;
    // Browsers can consume locked Escape's keydown. Lock loss already freed the pointer;
    // its keyup must not advance the pause cycle a second time.
    escapeDown = false;
  };
  const pointerlockchange = () => {
    const captured = document.pointerLockElement === canvas;
    if (captured) rejectStaleCapture();
    else captureAllowed = false;
    state.pointerLockChanged(captured && captureAllowed);
  };
  const blur = () => { escapeDown = false; releaseCapture(); state.pointerLockChanged(false); };
  const visibilityChanged = () => { if (document.hidden) blur(); };
  const contextChanged = () => {
    if (!active()) blur();
    menu.style.display = active() && state.paused ? 'block' : 'none';
  };
  const onResume = () => state.resume();
  resume.addEventListener('click', onResume);
  document.addEventListener('keydown', keydown);
  document.addEventListener('keyup', keyup);
  document.addEventListener('pointerlockchange', pointerlockchange);
  document.addEventListener('visibilitychange', visibilityChanged);
  window.addEventListener('blur', blur);
  window.addEventListener('activePanelChanged', contextChanged);
  window.addEventListener('nv-panel-content-deactivated', contextChanged);
  window.addEventListener('nv-panel-content-activated', contextChanged);
  return {
    state, menu,
    acceptsInput(event) { return !state.paused && active() && !typing(event?.target) && (state.captured || panel.contains(event?.target)); },
    capture() { if (!state.paused) requestCapture(); },
    dispose() {
      disposed = true;
      releaseCapture();
      state.pointerLockChanged(false);
      document.removeEventListener('keydown', keydown);
      document.removeEventListener('keyup', keyup);
      document.removeEventListener('pointerlockchange', pointerlockchange);
      document.removeEventListener('visibilitychange', visibilityChanged);
      window.removeEventListener('blur', blur);
      window.removeEventListener('activePanelChanged', contextChanged);
      window.removeEventListener('nv-panel-content-deactivated', contextChanged);
      window.removeEventListener('nv-panel-content-activated', contextChanged);
      pausedAudio.clear(); menu.remove();
    }
  };
}
