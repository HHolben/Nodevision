// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/GameViewDependencies/worldPauseState.mjs
// This controller separates pointer capture from simulation pause and advances Escape synchronously, even when pointer-lock notifications arrive later.
export function createWorldPauseState({ captured = false, unlock, lock, onPause = () => {} }) {
  let paused = false;
  return {
    get paused() { return paused; },
    get captured() { return captured; },
    pointerLockChanged(value) { captured = value === true && !paused; },
    pause() {
      if (paused) return;
      paused = true;
      captured = false;
      unlock();
      onPause(true);
    },
    resume() {
      if (paused) { paused = false; onPause(false); }
      // Capture is confirmed by pointerlockchange; denied requests leave a running, free world.
      lock();
    },
    escape() {
      if (paused) this.resume();
      else if (captured) { captured = false; unlock(); }
      else this.pause();
    }
  };
}
