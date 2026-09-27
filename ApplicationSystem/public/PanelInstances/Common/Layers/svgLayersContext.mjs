// Nodevision/ApplicationSystem/public/PanelInstances/Common/Layers/svgLayersContext.mjs
// This module resolves the active SVG Layers provider and promotes viewer organization gestures through the existing GraphicalEditor lifecycle, using stable authored-node addresses rather than a second save or selection system.
import { svgNodePath, svgNodeAtPath } from "../../EditorPanels/GraphicalEditors/ElementLayers/nodeAddress.mjs";
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
  const contexts=viewing ? [window.SVGViewLayersContext,window.SVGEditorContext] : [window.SVGEditorContext,window.SVGViewLayersContext];
  return contexts.find(context=>svgContextPath(context?.filePath)===path && context?.svgRoot?.isConnected && context.layers?.attachHost) || null;
}
function address(root,node) {
  return {path:svgNodePath(root,node), id:node.id, tag:node.localName, markup:new XMLSerializer().serializeToString(node)};
}
function resolve(root,entry,strict=false) {
  const node=svgNodeAtPath(root,entry.path);
  if(!node || node.localName!==entry.tag || (entry.path.length && entry.id && node.id!==entry.id) || (strict && new XMLSerializer().serializeToString(node)!==entry.markup)) throw new Error('The editor document differs from the viewed SVG. Select the object again in the editor Layers panel.');
  return node;
}
export async function promoteSvgLayerMove(viewContext, element, target, before=null) {
  const source=address(viewContext.svgRoot,element), destination=address(viewContext.svgRoot,target);
  const insertion=before && address(viewContext.svgRoot,before);
  let context=window.SVGEditorContext;
  if(svgContextPath(context?.filePath)!==svgContextPath(viewContext.filePath) || !context?.svgRoot?.isConnected) {
    context=await new Promise((resolveReady,reject)=>{
      const timer=setTimeout(()=>{window.removeEventListener('nv-svg-editor-context-ready',ready);reject(new Error('The SVG editor did not become ready. Open graphical editing and retry the move.'));},15000);
      function ready(event) {
        if(svgContextPath(event.detail?.filePath)!==svgContextPath(viewContext.filePath)) return;
        clearTimeout(timer);window.removeEventListener('nv-svg-editor-context-ready',ready);resolveReady(event.detail.context);
      }
      window.addEventListener('nv-svg-editor-context-ready',ready);
      window.dispatchEvent(new CustomEvent('toolbarAction',{detail:{id:'GraphicalEditor',type:'EditorPanel',replaceActive:false,panelVars:{filePath:viewContext.filePath}}}));
    });
  }
  let failure = null;
  context.activate?.();
  try {
    const sourceNode=resolve(context.svgRoot,source,true), targetNode=resolve(context.svgRoot,destination);
    const beforeNode=insertion && resolve(context.svgRoot,insertion);
    return context.reparentLayerElement(sourceNode,targetNode,beforeNode);
  } catch(error) { failure=error; throw error; }
  finally {
    window.dispatchEvent(new CustomEvent('nv-svg-layers-provider-changed'));
    if(failure) context.layers?.reportError?.(failure.message);
  }
}
