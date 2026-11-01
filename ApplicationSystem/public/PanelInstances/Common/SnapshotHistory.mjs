// Nodevision/ApplicationSystem/public/PanelInstances/Common/SnapshotHistory.mjs
// This module provides bounded undo and redo history for immutable document snapshots. Editors supply snapshot access and comparison behavior so structurally shared document data can be reused without serialization.
// Immutable document snapshots. Editors retain structurally shared data, not serialized documents.
export function createSnapshotHistory({readSnapshot,writeSnapshot,maxEntries=25,maxBytes=Infinity,weight=()=>0,equal=(a,b)=>a===b}) {
  const past=[],future=[],limit=Math.max(1,Math.floor(maxEntries)||25);
  function push(stack,state){stack.push(state);while(stack.length>limit||stack.length>1&&stack.reduce((n,s)=>n+weight(s),0)>maxBytes)stack.shift();}
  function restore(from,to){if(!from.length)return false;push(to,readSnapshot());writeSnapshot(from.pop());return true;}
  return {record(before){if(equal(before,readSnapshot()))return false;push(past,before);future.length=0;return true;},undo:()=>restore(past,future),redo:()=>restore(future,past),canUndo:()=>!!past.length,canRedo:()=>!!future.length,clear(){past.length=future.length=0;}};
}
