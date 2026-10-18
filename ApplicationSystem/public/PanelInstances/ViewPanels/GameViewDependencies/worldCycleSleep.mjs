// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/GameViewDependencies/worldCycleSleep.mjs
// This adapter exposes brightness-cycle periods as sleep targets on the same clock used by the temporal manipulator.
export function cycleOnEnable(cycle) {
  if (!cycle.enabled || cycle.periods.length !== 1 || cycle.periods[0].time !== 0 || cycle.periods[0].brightness !== 1) return cycle;
  return { ...cycle, periods: [
    { time: 0, brightness: 1 },
    { time: cycle.durationSeconds / 4, brightness: 0.5 },
    { time: cycle.durationSeconds / 2, brightness: 0.05 },
    { time: cycle.durationSeconds * 3 / 4, brightness: 0.5 }
  ] };
}

export function createCycleSleepRuntime(context) {
  function sleepOptions() {
    const cycle = context.consolePanels?.getEnvironmentDefinition?.().dayNightCycle;
    if (!cycle?.enabled || !context.temporalController || !(cycle.durationSeconds > 0)) return [];
    const now = context.temporalController.getTimeSeconds();
    const phase = ((now % cycle.durationSeconds) + cycle.durationSeconds) % cycle.durationSeconds;
    return cycle.periods.map((period, index) => {
      const offset = ((period.time - phase) % cycle.durationSeconds + cycle.durationSeconds) % cycle.durationSeconds;
      return { id: String(index), label: `Period ${index + 1} (${Math.round(period.brightness * 100)}% brightness)`,
        seconds: offset > 0.000001 ? offset : cycle.durationSeconds };
    }).sort((a, b) => a.seconds - b.seconds);
  }
  return { sleepOptions, sleep(id) {
    const target = sleepOptions().find(option => option.id === id);
    if (!target) return { ok: false, message: 'No available day/night period.' };
    const temporal = context.temporalController;
    const time = temporal.getTimeSeconds() + target.seconds;
    temporal.applySettings({ ...temporal.getSettings(), elapsedSeconds: time, staticTimeSeconds: time });
    context.consolePanels.updateEnvironmentLighting?.(time);
    return { ok: true, message: `Advanced to ${target.label}.` };
  } };
}
