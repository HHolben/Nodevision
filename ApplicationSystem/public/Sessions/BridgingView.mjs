// Nodevision/ApplicationSystem/public/Sessions/BridgingView.mjs
// Compact configuration, progress and summary controls remain outside the authored HTML body.
import {htmlEditorChromeRemovalSelector} from '../PanelInstances/EditorPanels/GraphicalEditors/HTMLeditorComponents/HtmlSourceProvenance.mjs';
import {formatTime} from './HTMLDraftFocusMetrics.mjs';
export function createBridgingView(root) {
  const surface=document.createElement('section');surface.style.cssText='height:100%;width:100%;display:flex;flex-direction:column;background:white;color:#18202b;min-height:0';surface.className='nv-bridging';root.replaceChildren(surface);
  const style=document.createElement('style');style.textContent=`.nv-bridging > [hidden],.nv-bridging > .nv-bridging-bar > [hidden],.nv-bridging ${htmlEditorChromeRemovalSelector}{display:none!important}`;surface.append(style);
  const make=(tag,text,parent=surface)=>{const node=document.createElement(tag);node.textContent=text||'';parent.append(node);return node;};
  const config=make('form');config.style.cssText='padding:16px;display:flex;gap:10px;align-items:center;flex-wrap:wrap';make('strong','Focus Session — Bridging',config);
  const button=(text,parent=config)=>{const b=make('button',text,parent);b.type='button';return b;};
  const choose=button('Choose HTML document'),create=button('New HTML document');
  const path=make('span','No document selected',config);
  function input(text,type,value){const label=make('label',text+' ',config),field=make('input','',label);field.type=type;if(type==='checkbox')field.checked=value;else field.value=value;return field;}
  const words=input('Word target','checkbox',true),growth=input('Additional words','number',100);growth.min='1';growth.step='1';growth.style.width='90px';
  const timer=input('Timer','checkbox',true),minutes=input('Minutes','number',25),seconds=input('Seconds','number',0);minutes.min='0';seconds.min='0';seconds.max='59';minutes.style.width=seconds.style.width='65px';
  const presets=make('select','',config);presets.setAttribute('aria-label','Timer presets');
  for(const value of [5,10,15,25,30,60]){const option=make('option',value+' minutes',presets);option.value=value;option.selected=value===25;}
  presets.onchange=()=>{minutes.value=presets.value;seconds.value='0';};
  const syncGoals=()=>{growth.disabled=!words.checked;minutes.disabled=seconds.disabled=presets.disabled=!timer.checked;};
  words.addEventListener('change',syncGoals);timer.addEventListener('change',syncGoals);syncGoals();
  const baseline=make('span','',config),start=make('button','Begin writing',config);start.type='submit';start.disabled=true;
  const cancel=button('Cancel');
  const bar=make('div');bar.className='nv-bridging-bar';bar.style.cssText='padding:8px 12px;display:flex;align-items:center;gap:12px;flex-wrap:wrap';bar.hidden=true;
  const status=make('span','Bridging',bar),progress=make('progress','',bar);progress.max=1;
  const end=button('End Session',bar),retry=button('Retry save',bar);retry.hidden=true;
  const message=make('div');message.setAttribute('role','status');message.style.cssText='padding:0 12px;white-space:pre-wrap';
  const host=make('div');host.style.cssText='flex:1;min-height:0;overflow:auto';
  const goal=()=>({wordsEnabled:words.checked,timerEnabled:timer.checked,targetGrowth:growth.valueAsNumber,durationMs:(Number(minutes.value)*60+Number(seconds.value))*1000});
  function counts(count){baseline.textContent=`Current: ${count} words · Required: ${words.checked?count+Number(growth.value):'timer only'}`;}
  function update(stats,phase){const g=goal();status.textContent=`Bridging | ${g.timerEnabled?formatTime(stats.remainingMs)+' remaining | ':''}${stats.netWordsAdded>=0?'+':''}${stats.netWordsAdded}${g.wordsEnabled?' / '+g.targetGrowth+' words | '+stats.remainingWords+' to go':' words'}`;progress.hidden=!g.wordsEnabled;progress.value=g.targetGrowth?Math.max(0,Math.min(1,stats.netWordsAdded/g.targetGrowth)):1;end.disabled=phase!=='writing';retry.hidden=phase!=='failed';}
  function summary(stats){host.hidden=true;end.hidden=true;retry.hidden=true;progress.hidden=true;status.textContent='Bridging — saved';message.textContent=`Ended: ${stats.reason}\nDuration: ${formatTime(stats.elapsedMs)}\nInitial: ${stats.initialWordCount} words · Final: ${stats.currentWordCount} words\nNet change: ${stats.netWordsAdded}${stats.targetGrowth!==null?' · Requested growth: '+stats.targetGrowth:''}`;}
  return {surface,config,choose,create,path,growth,words,baseline,start,cancel,bar,status,end,retry,message,host,goal,counts,update,summary,button};
}
