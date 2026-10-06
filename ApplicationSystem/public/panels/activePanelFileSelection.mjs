// Nodevision/ApplicationSystem/public/panels/activePanelFileSelection.mjs
// This module publishes a file-backed active panel through the canonical Notebook selection store without issuing another file-open command or inferring files for utility panels.
import { getNodevisionSelectedPath, setNodevisionSelectedPath } from '../NodevisionSelection.mjs';
export function notebookPanelPath(value = '') {
  const path = String(value).replace(/^\/?Notebook\//, '');
  if (!path || /^(?:[a-z]+:|\/|\\)/i.test(path) || path.split('/').includes('..')) return '';
  return path;
}
export function activePanelFilePath(cell) {
  if (!cell) return '';
  const tabs = cell.__nvPanelTabs;
  const tab = tabs?.tabs.find(item => item.tabId === tabs.activeTabId);
  const host = tab?.contentElement || cell;
  const type = tab?.panelType || cell.dataset?.panelId || cell.dataset?.id || '';
  if (!/View|Editor/i.test(type) || /GraphManager|FileManager/.test(type)) return '';
  const documentHost = host.querySelector?.('[data-nv-file-view-root], [data-nv-graphical-editor-path]');
  return notebookPanelPath(documentHost?.dataset?.nvFileViewRenderedPath || documentHost?.dataset?.nvGraphicalEditorPath ||
    documentHost?.dataset?.currentFilePath || host.dataset?.currentFilePath || tab?.panelVars?.filePath || (!tab && cell.dataset?.currentFilePath) || '');
}
export function installActivePanelFileSelection() {
  let cell = null, queued = false;
  const sync = () => {
    queued = false;
    const path = activePanelFilePath(cell);
    if (path && path !== getNodevisionSelectedPath()) setNodevisionSelectedPath(path, { source: 'active-panel' });
  };
  const schedule = () => { if (!queued) { queued = true; queueMicrotask(sync); } };
  const observer = new MutationObserver(schedule);
  const activate = event => {
    cell = event.detail?.cell || null; observer.disconnect();
    if (cell) observer.observe(cell, { subtree: true, attributes: true, attributeFilter: ['data-current-file-path', 'data-nv-file-view-rendered-path', 'data-nv-graphical-editor-path'] });
    schedule();
  };
  window.addEventListener('activePanelChanged', activate);
  return () => { observer.disconnect(); window.removeEventListener('activePanelChanged', activate); cell = null; };
}
