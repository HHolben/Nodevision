// Compatibility routing only. Graph state and resources belong to each panel's Core factory.
const instances = new Map();
let nextId = 0;
let lastNavigationId = null;
let controlsOwner = null;
const visible = instance => instance && !instance.destroyed && !instance.inactive && instance.root?.isConnected &&
  !instance.root.closest('[hidden], [aria-hidden="true"]') && instance.root.getClientRects().length > 0;
export function activeGraphManager() {
  const cell = globalThis.window?.activeCell;
  if (!cell) return null;
  return [...instances.values()].find(instance => visible(instance) &&
    (cell === instance.root || cell.contains?.(instance.root) || instance.root.contains?.(cell))) || null;
}
export function graphManagerForId(id) { return instances.get(id) || null; }
export function graphManagerNavigationInstanceId() {
  const active = activeGraphManager();
  if (active) return active.id;
  const previous = instances.get(lastNavigationId);
  if (visible(previous)) return previous.id;
  const candidates = [...instances.values()].filter(visible);
  return candidates.length === 1 ? candidates[0].id : null;
}
export function noteGraphManagerNavigation(instance) { lastNavigationId = instance.id; }
export function registerGraphManager(instance) {
  instance.id = `graph-manager-${++nextId}`;
  instances.set(instance.id, instance);
  return () => { if (controlsOwner === instance) controlsOwner = null; instances.delete(instance.id); if (lastNavigationId === instance.id) lastNavigationId = null; };
}
export function callActiveGraphManager(method, ...args) {
  if (method === 'bindGraphManagerLayerControls') {
    const next = activeGraphManager();
    if (controlsOwner && controlsOwner !== next) controlsOwner.bindGraphManagerLayerControls(null);
    controlsOwner = next;
  }
  return activeGraphManager()?.[method]?.(...args) ?? false;
}
// File edits are application-wide invalidations. Only an active graph refreshes immediately.
export function refreshGraphManagers(options = {}) {
  const active = activeGraphManager();
  for (const instance of instances.values()) if (instance !== active) instance.invalidate();
  return active?.refreshGraphView(options) ?? false;
}
function navigationTarget(options) {
  const instance = options?.instanceId ? instances.get(options.instanceId) : activeGraphManager();
  return visible(instance) ? instance : null;
}
if (typeof window !== 'undefined') {
  let legacyGraph = window.cy;
  Object.defineProperty(window, 'cy', { configurable: true,
    get: () => activeGraphManager()?.graph || (instances.size === 0 ? legacyGraph : null),
    set: value => { legacyGraph = value; }
  });
  window.refreshGraphManager = refreshGraphManagers;
  window.getGraphManagerNavigationInstanceId = graphManagerNavigationInstanceId;
  window.revealPathInGraphManager = (path, options = {}) => navigationTarget(options)?.revealPathInGraphManager(path, options) ?? false;
  window.openDirectoryInGraphManager = (path, options = {}) => navigationTarget(options)?.openDirectoryInGraphManager(path) ?? false;
  for (const [name, method] of Object.entries({
    getGraphManagerPasteDestination: 'graphPasteDestinationDirectory',
    handleGraphManagerAction: 'handleGraphManagerAction',
    getGraphManagerExternalLinkedFilesVisible: 'getGraphManagerExternalLinkedFilesVisible',
    setGraphManagerExternalLinkedFilesVisible: 'setGraphManagerExternalLinkedFilesVisible',
    clearGraphAbstractionFilter: 'clearGraphAbstractionFilter',
    setGraphAbstractionRootFromSelection: 'setGraphAbstractionRootFromSelection',
    reopenGraphRootFromSelection: 'reopenGraphRootFromSelection',
    bindGraphManagerLayerControls: 'bindGraphManagerLayerControls'
  })) window[name] = (...args) => callActiveGraphManager(method, ...args);
}
