// Nodevision/ApplicationSystem/public/PanelInstances/InfoPanels/FileManagerZoom.mjs
// This module exposes row scale and compact or detailed file listing presentation without navigating directories, replacing selection, or loading additional metadata.
import { registerPanelZoomCapabilities } from '/panels/panelZoomCapabilities.mjs';
export function installFileManagerZoom(host) {
  const list = host.querySelector('.file-list');
  if (!list) return () => {};
  let zoom = 1, level = 'detailed';
  const style = document.createElement('style');
  style.textContent = '[data-nv-file-detail="compact"] a.file > span:first-child,[data-nv-file-detail="compact"] a.folder > span:first-child {display:none !important}';
  host.append(style); list.dataset.nvFileDetail = level;
  const unregister = registerPanelZoomCapabilities(host, {
    metadata: {
      geometric: { actions: ['zoom', 'set', 'reset'], unit: 'row scale' },
      semantic: { actions: ['zoom', 'set', 'reset'], levels: [{value:'compact',label:'Compact names'}, {value:'detailed',label:'Names and icons'}] }
    },
    fisheye: false,
    getState: mode => mode === 'semantic' ? { level } : mode === 'geometric' ? { zoom } : null,
    geometric(command) {
      const next = command.action === 'reset' ? 1 : command.zoom ?? zoom * (command.factor || 1);
      if (!Number.isFinite(next) || next <= 0) return false;
      zoom = Math.max(.5, Math.min(3, next)); list.style.zoom = String(zoom); return true;
    },
    semantic(command) {
      const next = command.action === 'reset' ? 'detailed' : command.action === 'set' ? command.level
        : command.factor > 1 ? 'detailed' : command.factor < 1 ? 'compact' : level;
      if (!['compact', 'detailed'].includes(next)) return false;
      if (next !== level) { level = next; list.dataset.nvFileDetail = level; }
      return true;
    }
  });
  return () => { unregister(); style.remove(); delete list.dataset.nvFileDetail; list.style.zoom = ''; };
}
