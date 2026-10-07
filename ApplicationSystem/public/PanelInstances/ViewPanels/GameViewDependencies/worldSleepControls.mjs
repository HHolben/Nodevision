// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/GameViewDependencies/worldSleepControls.mjs
// This pause-menu component delegates sleep actions to the active world's astronomical clock and reports unavailable solar events without calculating them in the UI.
import { applyOverlayButtonAppearance } from '/OverlayAppearance.mjs';
export function installWorldSleepControls(menu,panel){
  const row=document.createElement('div'),status=document.createElement('div');
  status.setAttribute('role','status');row.className='nv-world-sleep-controls';
  const events=new AbortController(),buttons=[];
  const runtime=()=>window.VRWorldContext?.panel===panel?window.VRWorldContext.astronomy:null;
  for(const [kind,label] of [['nightfall','Sleep until nightfall'],['daybreak','Sleep until daybreak']]){
    const button=document.createElement('button');button.textContent=label;button.dataset.sleep=kind;applyOverlayButtonAppearance(button);
    button.addEventListener('click',event=>{
      event.stopPropagation();const result=runtime()?.sleep(kind);status.textContent=result?.message||'This world has no supported Sun.';
    },{signal:events.signal});row.append(button);buttons.push(button);
  }
  row.append(status);menu.append(row);
  return {refresh(){for(const b of buttons)b.disabled=!runtime()?.hasSun;status.textContent='';},dispose(){events.abort();row.remove();}};
}
