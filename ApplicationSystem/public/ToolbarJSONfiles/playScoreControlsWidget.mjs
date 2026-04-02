// Nodevision/ApplicationSystem/public/ToolbarJSONfiles/playScoreControlsWidget.mjs
// Sub-toolbar widget for View -> Play Score controls (Play/Pause + tempo input).

function clamp(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function getTools() {
  return window.NodevisionMIDITools || null;
}

function tryRouteToActivePanel(actionKey) {
  const handler = window.NodevisionState?.activeActionHandler;
  if (typeof handler === "function") {
    try {
      handler(actionKey);
      return true;
    } catch {
      return false;
    }
  }
  return false;
}

export function initToolbarWidget(hostElement) {
  if (!hostElement) return;

  const playBtn = hostElement.querySelector('[data-nv-midi-action="play"]');
  const pauseBtn = hostElement.querySelector('[data-nv-midi-action="pause"]');
  const tempoInput = hostElement.querySelector("[data-nv-midi-tempo]");
  const clickToggle = hostElement.querySelector("[data-nv-midi-click]");

  const syncTempo = () => {
    const tools = getTools();
    const bpm = tools?.getTempo?.() ?? window.NodevisionState?.midiTempoBpm ?? 120;
    if (tempoInput) tempoInput.value = String(clamp(bpm, 20, 400, 120));
  };

  const syncClick = () => {
    const tools = getTools();
    const enabled = tools?.isClickTrackEnabled?.() ?? window.NodevisionState?.midiClickTrackEnabled ?? false;
    if (clickToggle) clickToggle.checked = Boolean(enabled);
  };

  if (playBtn) {
    playBtn.addEventListener("click", (e) => {
      e.preventDefault();
      const tools = getTools();
      if (tools?.play) tools.play();
      else tryRouteToActivePanel("midiPlayScore");
    });
  }

  if (pauseBtn) {
    pauseBtn.addEventListener("click", (e) => {
      e.preventDefault();
      const tools = getTools();
      if (tools?.pause) tools.pause();
      else tryRouteToActivePanel("midiPauseScore");
    });
  }

  if (tempoInput) {
    tempoInput.addEventListener("change", () => {
      const next = clamp(tempoInput.value, 20, 400, 120);
      tempoInput.value = String(next);
      const tools = getTools();
      if (tools?.setTempo) tools.setTempo(next);
      else {
        window.NodevisionState = window.NodevisionState || {};
        window.NodevisionState.midiTempoBpm = next;
      }
    });
    tempoInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        tempoInput.blur();
      }
    });
  }

  if (clickToggle) {
    clickToggle.addEventListener("change", () => {
      const enabled = Boolean(clickToggle.checked);
      const tools = getTools();
      if (tools?.setClickTrackEnabled) tools.setClickTrackEnabled(enabled);
      window.NodevisionState = window.NodevisionState || {};
      window.NodevisionState.midiClickTrackEnabled = enabled;
    });
  }

  syncTempo();
  syncClick();
}
