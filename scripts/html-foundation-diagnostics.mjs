// Main-window listener/observer counters and native input-to-rAF measurements for the isolated workspace.
const listeners = new Map([[window, new Map()], [document, new Map()]]);
let listenerCount = 0, observers = 0;
const add = EventTarget.prototype.addEventListener, remove = EventTarget.prototype.removeEventListener;
const capture = options => typeof options === 'boolean' ? options : Boolean(options?.capture);
function registrations(target, callback) {
  const registry = listeners.get(target);
  if (!registry) return null;
  if (!registry.has(callback)) registry.set(callback, new Set());
  return registry.get(callback);
}
EventTarget.prototype.addEventListener = function(type, callback, options) {
  const entries = registrations(this, callback), key = type + ':' + capture(options);
  if (entries && !entries.has(key)) { entries.add(key); listenerCount++; }
  return add.call(this, type, callback, options);
};
EventTarget.prototype.removeEventListener = function(type, callback, options) {
  const entries = registrations(this, callback), key = type + ':' + capture(options);
  if (entries?.delete(key)) listenerCount--;
  if (entries && !entries.size) listeners.get(this).delete(callback);
  return remove.call(this, type, callback, options);
};
const NativeObserver = MutationObserver;
window.MutationObserver = class extends NativeObserver {
  observe(...args) { if (!this.counted) { this.counted = true; observers++; } return super.observe(...args); }
  disconnect() { if (this.counted) { this.counted = false; observers--; } return super.disconnect(); }
};
const inputs = [];
const timers = new Set(), intervals = new Set();
const nativeTimeout = window.setTimeout.bind(window), nativeClear = window.clearTimeout.bind(window);
window.setTimeout = (callback, ms, ...args) => {
  const id = nativeTimeout(() => { timers.delete(id); if (typeof callback === 'function') callback(...args); else (0, eval)(callback); }, ms);
  timers.add(id); return id;
};
window.clearTimeout = id => { timers.delete(id); nativeClear(id); };
const nativeInterval = window.setInterval.bind(window), nativeClearInterval = window.clearInterval.bind(window);
window.setInterval = (...args) => { const id = nativeInterval(...args); intervals.add(id); return id; };
window.clearInterval = id => { intervals.delete(id); nativeClearInterval(id); };
document.addEventListener('beforeinput', event => {
  if (!event.isTrusted || !event.target.closest?.('#wysiwyg')) return;
  const start = performance.now(), inputType = event.inputType;
  requestAnimationFrame(() => {
    const first = performance.now() - start;
    requestAnimationFrame(() => inputs.push({ inputType, firstRafMs: first, secondRafMs: performance.now() - start }));
  });
}, true);
window.foundationDiagnostics = {
  inputs,
  watchRefreshes(layers, viewer) {
    const counts = { layersMutationBatches: 0, viewerRefreshMutations: 0, viewerFramesMounted: 0 };
    const seenFrames = new WeakSet();
    const layerObserver = new NativeObserver(() => counts.layersMutationBatches++);
    const viewerObserver = new NativeObserver(records => {
      for (const record of records) for (const node of record.addedNodes) {
        const frames = node.localName === 'iframe' ? [node] : [...node.querySelectorAll?.('iframe') || []];
        for (const frame of frames) if (!seenFrames.has(frame)) { seenFrames.add(frame); counts.viewerFramesMounted++; }
      }
      counts.viewerRefreshMutations += records.filter(record => record.type === 'attributes' ||
        [...record.addedNodes].some(node => node.localName === 'iframe' || node.querySelector?.('iframe'))).length;
    });
    layerObserver.observe(layers, { childList: true, subtree: true });
    viewerObserver.observe(viewer, { childList: true, subtree: true, attributes: true, attributeFilter: ['src', 'srcdoc'] });
    return { counts, dispose() { layerObserver.disconnect(); viewerObserver.disconnect(); } };
  },
  counts: () => ({ globalListeners: listenerCount, observingMutationObservers: observers, pendingTimeouts: timers.size,
    activeIntervals: intervals.size, toolbarCalls: window.toolbarUpdates || 0 }),
};
