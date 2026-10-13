// Nodevision/ApplicationSystem/public/CursorFamilies/providers/WorldCursorProvider.mjs
// This provider represents the current Virtual World interaction without treating pointer lock, hover, dragging, or crosshair presentation as a tool change.
export function createCursorFamilyProvider() {
  return {id:'world-cursor-tools',withContext(context){return {...this,context};},
    getTools(){return [{id:'gameplay',label:'World Interaction',glyph:'⊕',kind:'interaction',readOnly:true}];},
    getActiveToolId(){return 'gameplay';},getFallbackToolId(){return 'gameplay';}};
}
