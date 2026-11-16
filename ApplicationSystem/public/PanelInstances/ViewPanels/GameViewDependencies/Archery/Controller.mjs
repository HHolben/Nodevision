// Inventory-owned bow controller. Press/release events come from the existing input router; controller input uses the same configured action.
import {releaseTip} from './Aim.mjs';
import {drawFraction,drawForce,launchSpeed} from './Physics.mjs';
import {loadSettings,openSettings} from './Settings.mjs';
import {arrowEnvironment} from './Gravity.mjs';
import {createArrowSweep} from './Collision.mjs';
import {createArcheryVisuals} from './Visuals.mjs';
import {createFlights} from './Flight.mjs';
import {createPrediction} from './Prediction.mjs';
export const BOW_ID='archery-bow';
export function createArcheryBow(ctx,world){
 const {THREE,movementState:state}=ctx,inventory=world.inventory,visual=createArcheryVisuals(THREE,ctx.scene),collision=createArrowSweep(ctx);
 let preferences=loadSettings(),drawing=null,dialog=null,disposed=false,lastTime=performance.now(),lastPad=false,blocked=false,revision=state.toolInput?.revision||0,worldPath=world.currentWorldPath;
 const stats={lastForce:0,lastSpeed:0};let aimCache=null;
 const emit=(type,detail)=>{world.panel.dispatchEvent(new CustomEvent('nv-archery',{detail:{type,...detail}}));if(type==='arrow-hit-object'||type==='arrow-hit-terrain')world.panel.dispatchEvent(new CustomEvent('mob-sensory-signal',{detail:{type:'sound',sourceId:detail.arrowId,actorId:detail.shooterId,category:'impact',position:detail.point,intensity:.8}}));};
 const flight=createFlights({THREE,sweep:collision.sweep,emit,visual,listener:()=>ctx.controls.getObject().position.toArray()}),prediction=createPrediction(collision.sweep,visual);
 const selected=()=>inventory.getSelectedItem()?.id===BOW_ID;
 const allowed=()=>!disposed&&window.VRWorldContext===world&&ctx.api.canUseAbility('allowToolUse')&&state.worldMode!=='2d'&&!state.paused&&!state.textEditing&&!state.textWorldConsoleActive&&!inventory.isMenuOpen()&&!document.activeElement?.closest?.('input,textarea,select,dialog,[contenteditable]:not([contenteditable="false"])');
 const camera=()=>world.panel._vrViewController?.getActiveCamera?.()||ctx.camera;
 function cancel(){drawing=null;lastPad=false;prediction.hide();visual.hide();}
 function begin(time){if(drawing||!selected()||!allowed()||blocked)return;drawing={start:time,settings:{...preferences},full:false};emit('bow-draw-started',{});}
 function launchAt(time){
  if(!drawing||!selected()||!allowed())return;const force=drawForce(Math.max(0,time-drawing.start)/1000,drawing.settings),launch=aim(force);drawing=null;prediction.hide();stats.lastForce=force;stats.lastSpeed=launchSpeed(force);
  const r=flight.launch(launch.p,launch.v,{force,speed:stats.lastSpeed,shooterId:state.playerCharacter?.id||'session-player'});if(launch.blocker)flight.impact(r,launch.blocker);return r;
 }
 function aim(force,colliders=JSON.stringify(colliderKey())){
  const view=camera(),origin=view.getWorldPosition(new THREE.Vector3()),direction=view.getWorldDirection(new THREE.Vector3()).normalize();
  // Release on the authoritative crosshair ray, outside the 0.35 m player radius. Sweep the entire camera-to-tip path first.
  const key=JSON.stringify([force,...origin.toArray(),...direction.toArray(),colliders]);if(aimCache?.key===key)return aimCache.launch;
  const tip=releaseTip(THREE,origin,direction,ctx.controls.getObject().position,state.playerHeight),blocker=collision.sweep(origin.toArray(),tip.toArray());
  const launch={p:blocker?blocker.point:tip.toArray(),v:direction.multiplyScalar(launchSpeed(force)).toArray(),blocker};aimCache={key,launch};return launch;
 }
 function configure(){if(!selected()||!allowed()||dialog)return false;cancel();blocked=true;dialog=openSettings({world,ctx,value:preferences,onChange:s=>{preferences=s;},onClose:()=>{dialog=null;blocked=true;}});return true;}
 function suspend(){if(flight.records.length)flight.followAttachments();cancel();blocked=true;lastTime=performance.now();state.toolInput?.events.splice(0);flight.resetClock();}
 function tick(){
  const now=performance.now(),dt=(now-lastTime)/1000;lastTime=now;if(disposed)return;
  if(worldPath!==world.currentWorldPath){flight.clear();cancel();worldPath=world.currentWorldPath;}
  if(state.paused){suspend();return;}
  if(flight.records.length)flight.tick(dt,arrowEnvironment(ctx));else{flight.stats.physicsMs=0;flight.stats.steps=0;}
 }
 function update(input={}){
  const now=performance.now(),queue=state.toolInput,events=queue?.events.splice(0)||[];
  if(queue&&queue.revision!==revision){revision=queue.revision;cancel();blocked=true;}
  if(input.cleanupOnly||!selected()||!allowed()){cancel();blocked=true;return false;}
  if(input.stretch&&!state.selectedItemAdjustLatch){state.selectedItemAdjustLatch=true;configure();input.stretch=false;return true;}
  if(!input.toolUse&&!events.some(e=>e.down))blocked=false;
  if(input.rotate||input.attack){cancel();blocked=true;}else{
   for(const e of events){if(e.down){blocked=false;begin(e.time);}else{launchAt(e.time);blocked=false;}}
   const pad=!!input.toolPadUse;if(pad&&!lastPad)begin(now);if(!pad&&lastPad)launchAt(now);lastPad=pad;
  }
  if(drawing&&!input.toolUse)cancel();
  if(drawing){const held=Math.max(0,now-drawing.start)/1000,u=drawFraction(held,drawing.settings);if(u===1&&!drawing.full){drawing.full=true;emit('bow-fully-drawn',{});}
   visual.updateBow(camera(),u,true,inventory.getActiveHand());
   if(drawing.settings.trace){const colliders=JSON.stringify(colliderKey()),launch=aim(drawForce(held,drawing.settings),colliders);prediction.update(launch,arrowEnvironment(ctx),colliders,now);}else prediction.hide();
  }else visual.updateBow(camera(),0,false,inventory.getActiveHand());
  input.use=false;input.toolUse=false;input.attack=false;input.rotate=false;input.stretch=false;return true;
 }
 function colliderKey(){return ctx.objects.filter(o=>!o.userData?.noninteractive).map(o=>{o.updateWorldMatrix(true,false);const t=o.userData?.terrainRuntime;const children=[];if(!t)o.traverse(child=>{if(child.isMesh){child.updateWorldMatrix(true,false);children.push(child.uuid,child.visible,...child.matrixWorld.elements,child.geometry?.attributes.position?.version,child.geometry?.index?.version);}});return [o.uuid,o.visible,...o.matrixWorld.elements,children,t?.manager.loaded.revision,t?.manager.invalidated.revision,t?.manager.columnLevels.revision,t?.mapRevision,t?.representation];});}
 let wasSelected=selected();const unsubscribe=inventory.subscribeSelection(()=>{if(wasSelected&&!selected())ctx.heldKeys[ctx.getBindings().use]=false;wasSelected=selected();cancel();blocked=true;state.toolInput?.events.splice(0);});
 const oldDispose=inventory.dispose;function inventoryDispose(...args){dispose();return oldDispose.apply(inventory,args);}inventory.dispose=inventoryDispose;
 function dispose(){if(disposed)return;disposed=true;dialog?.close();unsubscribe();cancel();flight.clear();visual.dispose();if(inventory.dispose===inventoryDispose)inventory.dispose=oldDispose;}
 return {update,tick,suspend,cancel,configure,dispose,visual,flight,prediction,get settings(){return {...preferences};},get drawing(){return drawing?{held:Math.max(0,performance.now()-drawing.start)/1000,force:drawForce(Math.max(0,performance.now()-drawing.start)/1000,drawing.settings)}:null;},snapshot(){return {...stats,...flight.snapshot(),...prediction.stats,collisionQueries:collision.queries,bufferBytes:visual.bytes};}};
}
