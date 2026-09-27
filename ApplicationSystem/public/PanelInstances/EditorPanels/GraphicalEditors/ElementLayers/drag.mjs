// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/ElementLayers/drag.mjs
// This module delegates Layers drag events and updates only the current drop indicator; expensive preservation checks and document mutations run exclusively on drop.
import { svgDropRejection } from './reparent.mjs';
export function bindLayerDrag(panel, state) {
  if(state.dragCleanup) return;
  let source=null, highlighted=null;
  const handlers=[];
  const on=(type,fn)=>{panel.addEventListener(type,fn);handlers.push(()=>panel.removeEventListener(type,fn));};
  const rowFor=event=>event.target.closest?.('[data-nv-layer-drag-row]');
  const clear=()=>{if(highlighted){highlighted.style.boxShadow='';delete highlighted.dataset.dropState;} highlighted=null;};
  function plan(row,event) {
    const data=row?.__nvLayerNode;
    if(!source || !data) return null;
    const actions=state.dragActions;
    if(source.type==='layer' && !state.readOnly) {
      if(data.type!=='layer' || source.element===data.element || data.element===actions.root) return null;
      const rect=row.getBoundingClientRect();
      return {reorder:true,target:data,after:event.clientY<rect.top+rect.height/2};
    }
    const target=data.element;
    const reason=svgDropRejection(actions.root,source.element,target);
    return {target,reason};
  }
  on('dragstart',event=>{
    const row=rowFor(event), data=row?.__nvLayerNode;
    const control=event.target.closest?.('button,input');
    if(!data || data.element===state.dragActions.root || (control && !(data.type==='layer' && control===row.children[2]))) {event.preventDefault();return;}
    source=data; event.stopPropagation();
    event.dataTransfer?.setData('text/plain',data.element.id || data.element.localName);
    if(event.dataTransfer) event.dataTransfer.effectAllowed='move';
  });
  on('dragover',event=>{
    if(!source) return;
    event.stopPropagation();
    const row=rowFor(event), drop=plan(row,event);
    const valid=drop && !drop.reason;
    if(valid) event.preventDefault();
    if(event.dataTransfer) event.dataTransfer.dropEffect=valid?'move':'none';
    const nextState=valid?'valid':'invalid';
    if(highlighted===row && row?.dataset.dropState===nextState) return;
    clear(); if(!row) return; highlighted=row;
    row.dataset.dropState=nextState; row.style.boxShadow=`inset 0 0 0 2px ${valid?'#2784dd':'#bd3434'}`;
  });
  on('dragleave',event=>{if(highlighted && !highlighted.contains(event.relatedTarget)) clear();});
  on('dragend',()=>{source=null;clear();});
  on('drop',async event=>{
    if(!source) return;
    event.preventDefault();event.stopPropagation();
    const drop=plan(rowFor(event),event), dragged=source;source=null;clear();
    if(!drop || drop.reason) return;
    try {
      if(drop.reorder) state.dragActions.reorder(dragged.layerId,drop.target.layerId,drop.after?'after':'before');
      else await state.dragActions.move(dragged.element,drop.target);
      state.lastDragError=''; state.dragMessage.textContent='';
    } catch(error) { state.lastDragError=error.message; state.dragMessage.textContent=error.message; }
  });
  state.dragCleanup=()=>{clear();handlers.forEach(remove=>remove());source=null;};
}
export function markLayerDragRow(row, element, layerId, type='element') {
  row.dataset.nvLayerDragRow='true'; row.__nvLayerNode={element,layerId,type};row.draggable=true;
}
