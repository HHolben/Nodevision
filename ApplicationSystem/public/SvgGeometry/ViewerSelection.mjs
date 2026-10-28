// Nodevision/ApplicationSystem/public/SvgGeometry/ViewerSelection.mjs
// This module supplies inspection-only selection methods on the existing SVG viewer Layers context. Selection references live outside the SVG DOM and never enable mutation commands or editor tools.
export function installViewerSelection(context,events=window) {
  let selected=[];
  context.getSelectedElements=()=>selected.filter(el=>context.svgRoot.contains(el));
  context.getSelectedElement=()=>context.getSelectedElements()[0]||null;
  context.setSelection=elements=>{
    selected=[...new Set(elements)].filter(el=>el!==context.svgRoot&&context.svgRoot.contains(el));
    events.dispatchEvent(new CustomEvent('nv-svg-view-selection-changed',{detail:{context,selectedElements:context.getSelectedElements()}}));
  };
  context.toggleSelection=element=>context.setSelection(selected.includes(element)?selected.filter(el=>el!==element):[...selected,element]);
  context.clearSelection=()=>context.setSelection([]);
}
