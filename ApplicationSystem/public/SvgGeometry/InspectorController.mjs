// Nodevision/ApplicationSystem/public/SvgGeometry/InspectorController.mjs
// This controller subscribes to existing SVG provider and selection events and coalesces document mutations into one measurement update per animation frame. Its cache exists only while the inspector is open and never changes editor selection or document state.
import { getActiveSvgLayersContext } from '../PanelInstances/Common/Layers/svgLayersContext.mjs';
import { measureSvg } from './MeasureSvg.mjs';
import { layerPosition } from './LayerOrder.mjs';
export function observeGeometryInspector(render) {
  let context=null, observer=null, frame=0, disposed=false, cache=new WeakMap();
  const events=['nv-svg-editor-selection-changed','nv-svg-editor-selection-mutated','nv-svg-view-selection-changed','nv-svg-layers-provider-changed','activePanelChanged','modeChanged','fileSelected','nv-svg-editor-context-ready'];
  function schedule(){if(!disposed&&!frame)frame=requestAnimationFrame(update);}
  function update(){
    frame=0;if(disposed)return;
    const next=getActiveSvgLayersContext();
    if(next!==context){
      observer?.disconnect();context=next;cache=new WeakMap();
      if(context){
        observer=new MutationObserver(records=>{
          const relevant=records.some(record=>!record.target.closest?.('[data-nv-editor-ui]') && !(record.type==='childList'&&[...record.addedNodes,...record.removedNodes].every(n=>n.nodeType===1&&n.hasAttribute('data-nv-editor-ui'))));
          if(relevant){cache=new WeakMap();schedule();}
        });
        observer.observe(context.svgRoot,{attributes:true,childList:true,subtree:true,characterData:true});
      }
    }
    const selected=context?.getSelectedElements?.().filter(el=>context.svgRoot.contains(el))||[];
    if(selected.length!==1){render({count:selected.length});return;}
    const element=selected[0];
    if(!cache.has(element))cache.set(element,measureSvg(element,context.svgRoot));
    render({count:1,element,measurement:cache.get(element),order:layerPosition(element,context.svgRoot)});
  }
  const invalidate=event=>{if(event.type==='nv-svg-editor-selection-mutated')cache=new WeakMap();schedule();};
  for(const name of events)window.addEventListener(name,invalidate);
  update();
  return ()=>{disposed=true;cancelAnimationFrame(frame);observer?.disconnect();for(const name of events)window.removeEventListener(name,invalidate);};
}
