// Nodevision/ApplicationSystem/public/ToolbarCallbacks/file/downloadAssets.mjs
// Opens one asset discovery panel using the workspace's right-edge split and normal docking lifecycle.
import { captureAssetEditorContext } from '/AssetDownloads/AssetEditorContext.mjs';
import { createPanelDOM } from '/panels/panelFactory.mjs';
import { ensureAdjacentPanelCell } from '/panels/workspaceParts/workspaceAdjacentPanel.mjs';
import { ensureWorkspace, ensureTopRow, createCell } from '/panels/workspaceParts/workspaceCells.mjs';
let pending = null;
export default async function downloadAssets() { return openDownloadAssets({ mode: 'standalone' }); }
export async function openDownloadAssets(options = {}) {
  const origin = options.origin || await captureAssetEditorContext();
  const launch = { ...options, origin, mode: options.mode || 'standalone' };
  const existing = document.querySelector('.panel[data-instance-name="DownloadAssetsPanel"]');
  if (existing) { void existing.__nvSetAssetLaunch?.(launch); existing.hidden = false; existing.scrollIntoView({ block: 'nearest' }); return existing; }
  if (pending) { const panel = await pending; if (launch.mode === 'insert') void panel.__nvSetAssetLaunch?.(launch); return panel; }
  pending = (async () => {
    const { panel } = await createPanelDOM('DownloadAssetsPanel', 'DownloadAssetsPanel', 'InfoPanel', { displayName: 'Download Assets', ...launch });
    const cells = [...document.querySelectorAll('#workspace .panel-cell')].filter(cell => !cell.querySelector('.panel-cell') && cell.getBoundingClientRect().width > 0);
    const rightmost = cells.sort((a, b) => b.getBoundingClientRect().right - a.getBoundingClientRect().right)[0];
    const previousCell = cells.find(cell => cell.dataset.id === 'DownloadAssetsPanel' && !cell.querySelector('.panel'));
    const adjacent = !previousCell && rightmost && ensureAdjacentPanelCell({ originCell: rightmost, panelId: 'DownloadAssetsPanel',
      reuseAdjacentSibling: false, reuseExistingPanel: true, edge: 'right', splitPercent: 60, activate: false });
    const cell = previousCell || adjacent?.cell || createCell(ensureTopRow(ensureWorkspace()));
    cell.dataset.id = 'DownloadAssetsPanel'; cell.dataset.panelClass = 'InfoPanel';
    cell.querySelector('.panel-split-placeholder')?.remove();
    panel.__nvDefaultDockCell = cell;
    cell.appendChild(panel);
    panel.__nvSetLayout?.('docked');
    return panel;
  })();
  try { return await pending; } finally { pending = null; }
}
