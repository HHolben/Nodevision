// Nodevision/ApplicationSystem/public/SvgGeometry/LayerOrder.mjs
// This module supplies the shared top-first object ordering for SVG Layers and the geometry inspector. Structural nodes remain eligible because the existing Layers panel explicitly exposes them as selectable objects.
export function layerPanelChildren(parent,root) {
  return Array.from(parent?.children||[]).filter(child=>!child.getAttribute('data-nv-editor-ui') && child.getAttribute('data-nv-sketch-session')!=='true' && child.getAttribute('data-nv-sketch-construction')!=='true' && !(parent===root&&child.getAttribute('data-layer')==='true')).reverse();
}
export function layerPosition(element,root) {
  const parent=element.parentElement;
  const siblings=parent===root && element.getAttribute('data-layer')==='true'
    ?Array.from(root.children).filter(child=>child.getAttribute('data-layer')==='true').reverse():layerPanelChildren(parent,root);
  const index=siblings.indexOf(element);
  return {position:index<0?null:index+1,total:siblings.length,parent:parent===root?null:parent?.getAttribute('data-layer-name')||parent?.id||parent?.localName};
}
