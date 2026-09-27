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
  const requestCapture = () => {
    if (disposed || !isActive()) return;
    canvas.focus();
    try { Promise.resolve(canvas.requestPointerLock()).catch(() => {}); } catch { /* Browser may require a fresh canvas click. */ }
  };
  const state = createWorldPauseState({
    captured: controls.isLocked,
    lock: requestCapture,
    unlock: () => controls.unlock(),
    onPause(paused) {
      movementState.paused = paused;
      menu.style.display = paused ? 'block' : 'none';
      if (paused) {
        for (const object of objects) {
          const audio = object?.userData?.soundRuntime?.audio;
          if (audio && !audio.paused) { pausedAudio.add(audio); audio.pause(); }
        }
        resume.focus();
      } else {
        for (const audio of pausedAudio) Promise.resolve(audio.play()).catch(() => {});
        pausedAudio.clear();
      }
    }
  });
  canvas.tabIndex = 0;
  const typing = target => target?.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target?.tagName);
  const applicable = event => !disposed && isActive() && !event.defaultPrevented && !typing(event.target);
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
  const pointerlockchange = () => state.pointerLockChanged(document.pointerLockElement === canvas);
  const blur = () => { escapeDown = false; };
  const contextChanged = () => {
    if (!isActive()) {
      escapeDown = false;
      if (controls.isLocked) controls.unlock();
    }
    menu.style.display = isActive() && state.paused ? 'block' : 'none';
  };
  const onResume = () => state.resume();
  resume.addEventListener('click', onResume);
  document.addEventListener('keydown', keydown);
  document.addEventListener('keyup', keyup);
  document.addEventListener('pointerlockchange', pointerlockchange);
  window.addEventListener('blur', blur);
  window.addEventListener('activePanelChanged', contextChanged);
  return {
    state, menu,
    acceptsInput(event) { return !state.paused && isActive() && !typing(event?.target) && (controls.isLocked || panel.contains(event?.target)); },
    capture() { if (!state.paused) requestCapture(); },
    dispose() {
      disposed = true;
      document.removeEventListener('keydown', keydown);
      document.removeEventListener('keyup', keyup);
      document.removeEventListener('pointerlockchange', pointerlockchange);
      window.removeEventListener('blur', blur);
      window.removeEventListener('activePanelChanged', contextChanged);
      pausedAudio.clear(); menu.remove();
    }
  };
}
