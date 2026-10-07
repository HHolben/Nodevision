// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/GameViewDependencies/textConsoleClose.mjs
// This module owns a compact accessible console close control and delegates button and console keyboard input to the existing camera cycle.
export function installConsoleClose(root,input,advance){
  const lifetime=new AbortController(),options={signal:lifetime.signal};
  const button=document.createElement('button');button.type='button';button.textContent='×';button.setAttribute('aria-label','Close console view');
  Object.assign(button.style,{position:'absolute',right:'6px',top:'6px',zIndex:'1',width:'26px',height:'26px',padding:'0',font:'22px/1 sans-serif',
    color:'#f3f0dc',background:'#25352b',border:'1px solid #a3bc8b',borderRadius:'3px',cursor:'pointer'});
  for(const event of ['pointerdown','mousedown','dblclick'])button.addEventListener(event,e=>{e.preventDefault();e.stopPropagation();},options);
  button.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();advance();},options);
  for(const event of ['mouseenter','focus'])button.addEventListener(event,()=>{button.style.outline='2px solid #9bd67b';},options);
  for(const event of ['mouseleave','blur'])button.addEventListener(event,()=>{button.style.outline='';},options);
  root.addEventListener('keydown',e=>{if(e.code==='KeyU'&&!e.repeat&&!e.ctrlKey&&!e.metaKey&&!e.altKey){e.preventDefault();e.stopPropagation();advance();}},{...options,capture:true});
  root.append(button);return {button,dispose(){lifetime.abort();button.remove();}};
}
