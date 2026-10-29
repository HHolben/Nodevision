// Cytoscape nodes use pointer gestures, not DOM dragstart. Outside the graph they dispatch to the same registered targets.
import { makeResourcePayload, beginResourceDrag } from './ResourceTransfer.mjs';
import { previewResourceAtPoint, dropResourceAtPoint, clearResourcePreview } from './ResourceDropTarget.mjs';
export function installGraphResourceDrag(cy, container) {
  let drag = null;
  const outside = event => { const r=container.getBoundingClientRect();return event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom; };
  function grab(event) {
    const native=event.originalEvent;
    if (!native || native.ctrlKey || native.metaKey || native.shiftKey || event.target.data('type')!=='file' || !event.target.data('fullPath')) return;
    const payload=makeResourcePayload({path:event.target.data('fullPath'),sourcePanel:'graph-manager'});
    drag={node:event.target,position:{...event.target.position()},payload,end:beginResourceDrag(payload),outside:false};
  }
  function move(event) { if (!drag)return;drag.outside=outside(event);if(drag.outside)previewResourceAtPoint(drag.payload,event);else clearResourcePreview(); }
  function finish(event) {
    if(!drag)return;const current=drag;drag=null;
    if(outside(event)){current.node.position(current.position);void dropResourceAtPoint(current.payload,event);}
    clearResourcePreview();current.end();
  }
  function cancel(event) { if(event && event.key!=='Escape')return;if(!drag)return;if(drag){if(drag.outside)drag.node.position(drag.position);drag.end();drag=null;}clearResourcePreview(); }
  cy.on('grab','node',grab);window.addEventListener('mousemove',move,true);window.addEventListener('mouseup',finish,true);window.addEventListener('keydown',cancel,true);
  return ()=>{cancel();cy.off('grab','node',grab);window.removeEventListener('mousemove',move,true);window.removeEventListener('mouseup',finish,true);window.removeEventListener('keydown',cancel,true);};
}
