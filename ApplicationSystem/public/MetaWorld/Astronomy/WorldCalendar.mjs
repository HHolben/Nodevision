// Nodevision/ApplicationSystem/public/MetaWorld/Astronomy/WorldCalendar.mjs
// This calendar anchors an absolute instant to the canonical temporal controller without adding an animation clock or continuously reading host time.
export function createWorldCalendar(temporal, config, { now = () => Date.now(), timezone = () => Intl.DateTimeFormat().resolvedOptions().timeZone } = {}) {
  const zone = config.timezone || timezone();
  new Intl.DateTimeFormat('en', { timeZone: zone });
  let instant = config.mode === 'system-local' ? now() : Date.parse(config.mode === 'saved' ? config.savedTime || config.initialTime : config.initialTime);
  if (!Number.isFinite(instant)) throw Error('Astronomy requires an ISO calendar instant with an explicit timezone.');
  if (config.mode !== 'system-local' && !/(Z|[+-]\d\d:\d\d)$/.test(config.mode === 'saved' ? config.savedTime || config.initialTime || '' : config.initialTime || '')) throw Error('Calendar time must include Z or a UTC offset.');
  if (Number.isFinite(config.timeScale)) temporal.applySettings({ ...temporal.getSettings(), timeScale: config.timeScale });
  let anchor = temporal.getTimeSeconds();
  const current = () => instant + (temporal.getTimeSeconds() - anchor) * 1000;
  return { timezone: zone, get localDateTime() { return new Date(current()).toLocaleString(undefined, { timeZone: zone }); }, get instant() { return current(); },
    jumpTo(milliseconds) {
      const delta = (milliseconds - current()) / 1000;
      if (!Number.isFinite(delta) || delta <= 0) return false;
      const settings = temporal.getSettings();
      temporal.applySettings({ ...settings, elapsedSeconds: settings.elapsedSeconds + delta,
        staticTimeSeconds: settings.staticTimeSeconds + delta });
      return true;
    },
    synchronize() { instant = now(); anchor = temporal.getTimeSeconds(); },
    snapshot() { return { ...config, timezone: zone, ...(config.mode === 'saved' ? { savedTime: new Date(current()).toISOString() } : {}) }; }
  };
}
export function seasonAt(instant, latitude, timezone = 'UTC') {
  const month = Number(new Intl.DateTimeFormat('en', { month: 'numeric', timeZone: timezone }).format(new Date(instant)));
  const north = Math.floor((month % 12) / 3), index = (north + (latitude < 0 ? 2 : 0)) % 4;
  return ['winter', 'spring', 'summer', 'autumn'][index];
}
