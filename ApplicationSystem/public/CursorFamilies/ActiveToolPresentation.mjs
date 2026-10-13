// Nodevision/ApplicationSystem/public/CursorFamilies/ActiveToolPresentation.mjs
// This module supplies stable semantic tool icons and read-only interaction indicators. It never observes CSS cursor properties or pointer events.
export const toolGlyphs=Object.freeze({
  'object-select':'↖','text-select':'Ⅰ','text-edit':'Ⅰ','cell-select':'▦','rectangle-select':'⬚',
  'line-draw':'╱','rectangle-draw':'□','circle-draw':'○','ellipse-draw':'⬭','polygon-draw':'⬠','arc-draw':'◜',
  'hand-pan':'✋','gameplay':'⊕','bezier-draw':'∿','rotate':'⟳',
});
export function interactionTool(activeTool) {
  if(['pan','hand','hand-pan'].includes(activeTool))return {id:'hand-pan',label:'Pan',glyph:toolGlyphs['hand-pan'],kind:'interaction',readOnly:true};
  if(['text-edit','text-editing'].includes(activeTool))return {id:'text-edit',label:'Text Editing',glyph:'Ⅰ',kind:'interaction',readOnly:true};
  return null;
}
