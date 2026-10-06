// Nodevision/ApplicationSystem/public/panels/savedLayoutModel.mjs
// This module stores named workspace structures separately from file-bound sessions. An allowlist excludes document references, editor state, histories, and arbitrary panel variables at every serialization boundary.
const key = 'nodevision.workspace.layouts.v1';
const nodeKeys = ['type', 'direction', 'flex', 'panelType', 'panelClass', 'tabOrientation', 'collapsed'];
const variableKeys = ['theme', 'orientation', 'showToolbar', 'zoom', 'renderMode'];
export function sanitizeWorkspaceLayout(node) {
  if (!node || typeof node !== 'object') throw Error('Invalid layout');
  const result = {};
  for (const name of nodeKeys) if (['string','number','boolean'].includes(typeof node[name])) result[name] = node[name];
  if (Array.isArray(node.children)) result.children = node.children.map(sanitizeWorkspaceLayout);
  else {
    result.type = 'cell';
    result.panelType = node.panelType || node.instanceName || node.id || 'FileView';
    result.id = result.panelType;
    result.panelVars = { layoutEmpty: true };
    for (const name of variableKeys) if (['string','number','boolean'].includes(typeof node.panelVars?.[name])) result.panelVars[name] = node.panelVars[name];
    if (node.tabs?.length) {
      result.tabs = node.tabs.map((tab, index) => ({ ...sanitizeWorkspaceLayout({ ...tab, type: 'cell' }), tabId: `layout-tab-${index}` }));
      const index = Math.max(0, node.tabs.findIndex(tab => tab.tabId === node.activeTabId));
      result.activeTabId = `layout-tab-${index}`;
    }
  }
  return result;
}
export function listSavedLayouts(storage, query = '') {
  const entries = JSON.parse(storage.getItem(key) || '[]');
  if (!Array.isArray(entries)) throw Error('Saved layouts are invalid.');
  return entries.filter(entry => String(entry.name).toLowerCase().includes(query.trim().toLowerCase()));
}
export function saveNamedLayout(storage, name, layout) {
  name = String(name || '').trim();
  if (!name) throw Error('Enter a layout name.');
  const entries = listSavedLayouts(storage);
  if (entries.some(entry => entry.name.toLowerCase() === name.toLowerCase())) throw Error('That name already exists. Choose a different name.');
  const entry = { name, layout: sanitizeWorkspaceLayout(layout) };
  storage.setItem(key, JSON.stringify([...entries, entry]));
  return entry;
}
