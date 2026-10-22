// Nodevision/ApplicationSystem/public/AssetDownloads/AssetEditorContext.mjs
// Captures an explicit editor instance and insertion bookmark independently of subsequent panel focus.
import { snapshotInsertMediaOriginContext, resolveSvgEditorContextForInsertMedia } from '/ToolbarJSONfiles/insertMediaPanel.mjs';
import { normalizeNotebookFilePath } from '/utils/notebookPath.mjs';
export const assetDocumentPath = value => normalizeNotebookFilePath(value || '');
export function editorHosts(cell) {
  const tab = cell?.__nvPanelTabs?.tabs?.find(item => item.tabId === cell.__nvPanelTabs.activeTabId);
  return { tab, host: tab?.contentElement || cell };
}
export async function captureAssetEditorContext(cell = window.activeCell) {
  if (!cell?.isConnected || cell.dataset.instanceName === 'DownloadAssetsPanel' || cell.dataset.id === 'DownloadAssetsPanel') return null;
  const { tab, host } = editorHosts(cell);
  const origin = snapshotInsertMediaOriginContext(cell);
  if (origin.originPanelClass !== 'EditorPanel' && !['GameView', 'GraphicalEditor', 'CodeEditor'].includes(origin.originPanelType)) return null;
  const context = { cell, host, tabId: tab?.tabId || '', origin: { ...origin, originCell: cell }, kind: 'unsupported', path: '', capturedAt: Date.now() };
  const code = host?.__nvCodeEditorSession || host?.querySelector?.('.monaco-editor-container')?.__nvCodeEditorSession;
  if (code?.editor?.getModel?.()) {
    Object.assign(context, { kind: 'code', api: code.editor, model: code.editor.getModel(), path: assetDocumentPath(code.filePath), getSourcePath: () => assetDocumentPath(code.filePath), selection: code.editor.getSelection() });
    context.version = context.model.getVersionId();
  } else {
    const html = host?.__nvHtmlEditorContext || cell.__nvHtmlEditorContext;
    const svg = resolveSvgEditorContextForInsertMedia(context.origin);
    const raster = host?.__nvRasterEditorApi || (window.__nvRasterEditorApi && host?.contains(window.__nvRasterEditorApi.getCanvas?.()) ? window.__nvRasterEditorApi : null);
    if ((origin.originPanelType === 'GameView' || host?.contains(window.VRWorldContext?.panel)) && window.VRWorldContext?.currentWorldPath) {
      const world = window.VRWorldContext;
      const { getActiveMetaWorldLayerBridge } = await import('/MetaWorld/MetaWorldLayerState.mjs');
      const { worldAuthoringAllowed } = await import('/MetaWorld/WorldAuthoringPermissions.mjs');
      const { readCameraPlacement } = await import('/ToolbarJSONfiles/worldShapeWidget.mjs');
      Object.assign(context, { kind: 'world', api: getActiveMetaWorldLayerBridge(), getBridge: getActiveMetaWorldLayerBridge, canEdit: () => worldAuthoringAllowed(world.movementState), world, path: assetDocumentPath(world.currentWorldPath), position: readCameraPlacement() });
    } else if (html?.getEditorElement?.()?.isConnected && host?.contains(html.getEditorElement())) {
      const root = html.getEditorElement(); html.selection?.capture();
      const api = root.__nvAssetInsertionTools || (window.HTMLWysiwygTools?.getEditorElement?.() === root ? window.HTMLWysiwygTools : null);
      Object.assign(context, { kind: 'html', api, root, path: assetDocumentPath(html.filePath), range: html.selection?.getRange(), snapshot: root.innerHTML });
    } else if (svg.ok && host?.contains(svg.context.svgRoot)) {
      Object.assign(context, { kind: 'svg', api: svg.context, root: svg.context.svgRoot, path: assetDocumentPath(svg.context.filePath || origin.originEditorPath), layer: svg.context.getActiveLayer?.() || svg.context.svgRoot });
    } else if (raster) {
      Object.assign(context, { kind: 'raster', api: raster, root: raster.getCanvas(), path: assetDocumentPath(raster.filePath) });
    } else context.path = assetDocumentPath(origin.originEditorPath);
  }
  context.extension = context.path.split('.').pop()?.toLowerCase();
  return context;
}
export function validateAssetEditorContext(context) {
  if (!context?.cell?.isConnected || !context.host?.isConnected || !context.path) return 'The originating document is closed or has no saved path.';
  if (context.tabId && context.cell.__nvPanelTabs?.activeTabId !== context.tabId) return 'The originating tab is not active. Select it and capture the target again.';
  const { host } = editorHosts(context.cell);
  if (host !== context.host) return 'The originating editor has been replaced.';
  if (context.host.dataset.readOnly === 'true' || context.api?.readOnly === true || context.api?.isReadOnly?.()) return 'The document is read-only.';
  if (context.kind === 'code') {
    if (context.getSourcePath && context.getSourcePath() !== context.path) return 'The code document path changed. Capture the target again.';
    if (context.api.getModel() !== context.model || context.model.isDisposed?.()) return 'The code document has changed.';
    if (context.api.getRawOptions?.().readOnly) return 'The code editor is read-only.';
    if (context.model.getVersionId() !== context.version) return 'Source changed after capture. Capture the target again before insertion.';
    if (!context.selection) return 'No code caret was captured.';
  }
  if (context.kind === 'html') {
    if (!context.root.isConnected || context.root.contentEditable === 'false') return 'The HTML editor is unavailable or read-only.';
    if (!context.api?.insertHTMLAtCaret || !context.range || !context.root.contains(context.range.startContainer) || !context.root.contains(context.range.endContainer)) return 'No valid HTML text caret was captured. Place a caret and capture the target again.';
    if (context.root.innerHTML !== context.snapshot) return 'HTML changed after capture. Capture the target again before insertion.';
  }
  if (context.kind === 'svg') {
    if (!context.root.isConnected || !context.layer?.isConnected) return 'The SVG layer is no longer available.';
    for (let node = context.layer; node; node = node.parentElement) {
      if (node.getAttribute?.('data-nv-locked') === 'true') return 'The captured SVG layer is locked.';
      if (node === context.root) break;
    }
  }
  if (context.kind === 'raster' && (!context.root?.isConnected || !context.api?.insertImageFromInsertion)) return 'Raster placement is unavailable.';
  if (context.kind === 'world' && context.canEdit?.() === false) return 'The world is read-only or authoring is disabled in this view.';
  if (context.kind === 'world' && (context.getBridge?.() !== context.api || window.VRWorldContext !== context.world || assetDocumentPath(context.world.currentWorldPath) !== context.path || assetDocumentPath(context.api?.sourcePath) !== context.path)) return 'The originating world is no longer active.';
  return '';
}
export function listAssetEditorCells() {
  return [...document.querySelectorAll('.panel-cell')].filter(cell => !cell.querySelector('.panel-cell') && cell.dataset.id !== 'DownloadAssetsPanel' && (cell.dataset.panelClass === 'EditorPanel' || cell.dataset.id === 'GameView'));
}
