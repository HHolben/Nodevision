// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/GameViewDependencies/worldSleepControls.mjs
// This pause-menu component offers one sleep action with upcoming solar-time choices supplied by astronomy or the configured day/night cycle.
import { createCycleSleepRuntime } from './worldCycleSleep.mjs';
import { applyOverlayButtonAppearance } from '/OverlayAppearance.mjs';
export function installWorldSleepControls(menu,panel){
  const row=document.createElement('div'),status=document.createElement('div'),select=document.createElement('select');
  const button=document.createElement('button');button.textContent='Sleep Until';button.dataset.sleep='selected';
  select.setAttribute('aria-label','Sleep until time of day');select.className='nv-world-sleep-target';
  applyOverlayButtonAppearance(button);status.setAttribute('role','status');row.className='nv-world-sleep-controls';
  Object.assign(row.style,{display:'flex',gap:'8px',flexWrap:'wrap',alignItems:'center',justifyContent:'center'});
  const events=new AbortController();
  const runtime=()=>{
    const context=window.VRWorldContext;
    if(context?.panel!==panel)return null;
    return context.astronomy??createCycleSleepRuntime(context);
  };
  function refresh(clearStatus=true){
    const targets=runtime()?.sleepOptions()||[];select.replaceChildren();
    for(const target of targets){const option=document.createElement('option');option.value=target.id;option.textContent=target.label;select.append(option);}
    select.disabled=button.disabled=!targets.length;
    if(!targets.length){const option=document.createElement('option');option.textContent='No available sleep times';select.append(option);}
    if(clearStatus)status.textContent='';
  }
  button.addEventListener('click',event=>{
    event.stopPropagation();const result=runtime()?.sleep(select.value);status.textContent=result?.message||'This world has no available sleep times.';refresh(false);
  },{signal:events.signal});
  row.append(button,select,status);menu.append(row);
  return {refresh,dispose(){events.abort();row.remove();}};
}
