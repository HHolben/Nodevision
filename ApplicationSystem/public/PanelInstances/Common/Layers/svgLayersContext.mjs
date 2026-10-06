// Nodevision/ApplicationSystem/public/PanelInstances/Common/Layers/svgLayersContext.mjs
// This module resolves the active SVG Layers provider for the current document and mode. Viewer inspection remains independent of the graphical editor lifecycle.
export function svgContextPath(value = '') { return String(value).replace(/[?#].*$/, '').replace(/^\/?Notebook\//i,'').replace(/^\/+/, ''); }
export function getActiveSvgDocumentPath() {
  const state=window.NodevisionState || {};
  const viewing=state.currentMode==='Default' || /view/i.test(state.currentMode || '');
  const path=svgContextPath((viewing ? state.activeFileViewPath : state.activeEditorFilePath) || window.currentActiveFilePath || state.selectedFile || window.selectedFilePath);
  return path.toLowerCase().endsWith('.svg') ? path : '';
}
export function getActiveSvgLayersContext() {
  const state=window.NodevisionState || {};
  const viewing=state.currentMode==='Default' || /view/i.test(state.currentMode || '');
  const path=getActiveSvgDocumentPath();
  if(!path) return null;
  const contexts=viewing ? [window.SVGViewLayersContext] : [window.SVGEditorContext,window.SVGViewLayersContext];
  return contexts.find(context=>svgContextPath(context?.filePath)===path && context?.svgRoot?.isConnected && context.layers?.attachHost) || null;
}
