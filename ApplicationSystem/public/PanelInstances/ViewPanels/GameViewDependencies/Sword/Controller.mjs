import {createArrowSweep} from '../Archery/Collision.mjs';import {createSwordCombat} from './Combat.mjs';import {createSwordVisuals} from './Visuals.mjs';import {swordPose} from './Pose.mjs';import {playerActorId} from '../PlayerModifiers.mjs';
export const SWORD_ID='sword';
export function meleePermitted(ctx){const s=ctx.movementState;return ctx.api.canUseAbility('allowToolUse')||(s.viewPermissions?.authoring===false&&s.viewPermissions.gameplay===true&&s.worldRules?.allowToolUse===true);}
export function createSword(ctx,world){
 const {THREE,movementState:state}=ctx,inventory=world.inventory,visual=createSwordVisuals(THREE,ctx.scene),collision=createArrowSweep({...ctx,exactAnatomy:true});let disposed=false,pressed=false,pad=false,lastTime=performance.now(),revision=state.toolInput?.revision||0;
 const emit=(type,detail)=>{world.panel.dispatchEvent(new CustomEvent('nv-sword',{detail:{type,...detail}}));if(type==='sword-hit')visual.flash();if(type==='sword-hit')world.panel.dispatchEvent(new CustomEvent('mob-sensory-signal',{detail:{type:'sound',sourceId:detail.attackId,actorId:playerActorId(world),category:'impact',position:detail.point,intensity:.8}}));};
 const combat=createSwordCombat({THREE,sweep:collision.sweep,emit,actorId:playerActorId(world)}),selected=()=>inventory.getSelectedItem()?.id===SWORD_ID;
 const allowed=()=>!disposed&&window.VRWorldContext===world&&meleePermitted(ctx)&&state.worldMode!=='2d'&&!state.paused&&!state.textEditing&&!state.textWorldConsoleActive&&!inventory.isMenuOpen()&&!document.activeElement?.closest?.('input,textarea,select,dialog,[contenteditable]:not([contenteditable="false"])');
 function cancel(){combat.cancel();pressed=false;pad=false;visual.hide();lastTime=performance.now();}
 function update(input={}){const now=performance.now(),dt=(now-lastTime)/1000;lastTime=now;if(!selected())return false;const queue=state.toolInput,events=queue?.events.splice(0)||[];if(queue&&revision!==queue.revision){revision=queue.revision;cancel();return true;}
  if(input.cleanupOnly||!allowed()){cancel();return true;}
  for(const event of events){if(event.down&&!pressed){pressed=true;combat.begin();}else if(!event.down)pressed=false;}
  if(input.toolPadUse&&!pad)combat.begin();pad=!!input.toolPadUse;
  const camera=world.panel._vrViewController?.getActiveCamera?.()||ctx.camera;visual.pose(combat.update(dt,camera,inventory.getActiveHand())||swordPose(THREE,camera,null,inventory.getActiveHand()));input.use=input.toolUse=input.attack=input.rotate=input.stretch=false;return true;
 }
 const unsubscribe=inventory.subscribeSelection(()=>{cancel();revision=state.toolInput?.revision||0;state.toolInput?.events.splice(0);});const oldDispose=inventory.dispose;function inventoryDispose(...args){dispose();return oldDispose.apply(inventory,args);}inventory.dispose=inventoryDispose;
 function dispose(){if(disposed)return;disposed=true;cancel();unsubscribe();visual.dispose();if(inventory.dispose===inventoryDispose)inventory.dispose=oldDispose;}
 return {update,cancel,suspend:cancel,dispose,combat,visual,snapshot(){return {...combat.snapshot(),equipped:selected(),disposed,collisionQueries:collision.queries,resources:visual.snapshot()};}};
}
