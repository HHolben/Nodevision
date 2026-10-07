// Nodevision/scripts/player-view-browser.mjs
// This fixture verifies live foot-aligned avatars and equivalent console exit transitions through the existing camera controller in both Sandbox modes.
import * as THREE from '/lib/three/three.module.js';
export function checkPlayerViews(ctx,mode){
  const ok=(v,m)=>{if(!v)throw Error(mode+': '+m);},view=ctx.panel._vrViewController,consoleView=ctx.panel._vrTextWorldConsole;
  const player=ctx.controls.getObject(),saved=player.position.clone(),height=ctx.movementState.playerHeight;
  const originalMode=ctx.movementState.cameraMode;
  const apply=()=>{view.update();consoleView.update();};
  function enter(id){for(let i=0;i<7&&ctx.movementState.cameraMode!==id;i++){view.cycleMode();apply();}ok(ctx.movementState.cameraMode===id,'enter '+id);}
  enter('third');
  for(const ground of [0,18,20.25,100.25]){
    player.position.y=ground+height;apply();const box=new THREE.Box3().setFromObject(view.getAvatar());
    ok(Math.abs(box.min.y-ground)<.001,'avatar feet match collider bottom at '+ground);ok(Math.abs(box.max.y-(ground+height))<.001,'avatar height follows body');
    ok(view.getActiveCamera()!==ctx.camera,'third-person uses follow camera');
  }
  player.position.copy(saved);enter('first');ok(!view.getAvatar().visible,'first-person hides avatar');
  enter('text');apply();
  const button=ctx.panel.querySelector('button[aria-label="Close console view"]');ok(button,'close button exists');
  ok(ctx.panel.querySelectorAll('button[aria-label="Close console view"]').length===1,'one close button');
  ok(button.style.position==='absolute'&&button.style.top==='6px'&&button.style.right==='6px','top-right console control');
  let leaked=0;const listener=()=>leaked++;ctx.panel.addEventListener('click',listener);
  button.focus();button.click();apply();const next=ctx.movementState.cameraMode;
  ok(next==='first'&&!ctx.movementState.textWorldConsoleActive,'X advances out of console');ok(leaked===0,'X does not bubble to world');
  ok(document.activeElement!==button,'no stale close-button focus');
  enter('text');const input=button.parentElement.querySelector('input');input.focus();
  input.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyU',key:'u',bubbles:true,cancelable:true}));apply();
  ok(ctx.movementState.cameraMode===next,'console U and X have identical transitions');
  enter('text');ok(ctx.panel.querySelectorAll('button[aria-label="Close console view"]').length===1,'reentry has no duplicate');
  ctx.movementState.requestCycleCamera=true;apply();ok(ctx.movementState.cameraMode===next,'movement keyboard request uses same cycle');
  ctx.panel.removeEventListener('click',listener);enter(originalMode||'first');player.position.copy(saved);
}
