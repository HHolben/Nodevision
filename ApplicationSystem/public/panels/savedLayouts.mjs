// Nodevision/ApplicationSystem/public/panels/savedLayouts.mjs
// This module connects named structural layouts to the existing workspace renderer and cleanup lifecycle. Restored file panels start neutral and no document buffers are included in local settings storage.
import { serializeWorkspace, renderLayout } from './workspace.mjs';
import { serializeWorkspaceCollapseState, applySerializedWorkspaceCollapseState } from './workspaceLayoutCollapseIntegration.mjs';
import { cleanupPanelCells } from './workspaceParts/workspacePanelLoader.mjs';
import { sanitizeWorkspaceLayout, saveNamedLayout, listSavedLayouts } from './savedLayoutModel.mjs';
export function saveCurrentNamedLayout(name) {
  const workspace = document.getElementById('workspace');
  if (!workspace) throw Error('No workspace is open.');
  return saveNamedLayout(localStorage, name, serializeWorkspaceCollapseState(serializeWorkspace(workspace), workspace));
}
function contextIsDirty(context) {
  return typeof context?.isDirty === 'function' ? context.isDirty() : Boolean(context?.isDirty || context?.dirty);
}
export async function loadSavedLayout(entry) {
  const workspace = document.getElementById('workspace');
  if (!workspace) throw Error('No workspace is open.');
  const hosts = [...workspace.querySelectorAll('*')];
  const dirty = window.NodevisionState?.fileIsDirty || hosts.some(host =>
    contextIsDirty(host.__nvSvgEditorContext) || contextIsDirty(host.__nvHtmlEditorContext));
  if (dirty) throw Error('Save or close unsaved documents before loading a layout.');
  const layout = sanitizeWorkspaceLayout(entry.layout);
  cleanupPanelCells(workspace); workspace.replaceChildren();
  await renderLayout(layout, workspace);
  applySerializedWorkspaceCollapseState(workspace, layout);
}
export function showSavedLayouts() {
  const dialog = document.createElement('dialog'), search = document.createElement('input'), list = document.createElement('select');
  search.type = 'search'; search.placeholder = 'Search layouts'; search.setAttribute('aria-label', 'Search saved layouts');
  list.size = 8; list.setAttribute('aria-label', 'Saved layouts');
  list.style.cssText = 'display:block;min-width:20rem;max-width:80vw';
  const status = document.createElement('p'); status.setAttribute('role', 'status');
  let entries = [];
  const refresh = () => {
    try { entries = listSavedLayouts(localStorage, search.value); list.replaceChildren(...entries.map((entry, index) => new Option(entry.name, String(index)))); }
    catch (error) { status.textContent = error.message; }
  };
  search.oninput = refresh;
  const load = document.createElement('button'); load.textContent = 'Load layout';
  load.onclick = async () => { if (list.selectedIndex < 0) return; load.disabled = true;
    try { await loadSavedLayout(entries[Number(list.value)]); dialog.close(); } catch (error) { status.textContent = error.message; } finally { load.disabled = false; } };
  const close = document.createElement('button'); close.textContent = 'Cancel'; close.onclick = () => dialog.close();
  dialog.append(search, list, status, load, close); dialog.addEventListener('close', () => dialog.remove(), { once: true });
  document.body.appendChild(dialog); refresh(); dialog.showModal(); search.focus();
}
