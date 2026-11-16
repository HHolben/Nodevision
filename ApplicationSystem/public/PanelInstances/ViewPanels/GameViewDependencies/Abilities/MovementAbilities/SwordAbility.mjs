import {worldSensorySignals} from '/MetaWorld/Mobs/SensorySignals.mjs';
import {createSword,SWORD_ID} from '../../Sword/Controller.mjs';import {playerActorId} from '../../PlayerModifiers.mjs';
export function installSwordAbility(ctx){
 const world=window.VRWorldContext;if(world?.scene!==ctx.scene||!world.inventory)return;world.sword?.dispose();
 world.playerModifiers=world.inventory.modifiers;ctx.movementState.playerModifiers=world.playerModifiers;
 const unwatch=world.playerModifiers.subscribe((id,active)=>{if(id==='total-concealment'&&active){let count=0;for(const actor of new Set([playerActorId(world),'session-player'])){count+=worldSensorySignals(world).signals.forgetActor(actor);for(const root of world.objects)count+=root.userData.mobRuntime?.forgetActor(actor)||0;}world.playerModifiers.recordInvalidation(count);}});
 if(!world.inventory.items.some(item=>item.id===SWORD_ID))world.inventory.addItem(SWORD_ID,1,'Sword',{tool:true,category:'tools',autoAssign:false});
 const sword=createSword(ctx,world);world.sword=sword;ctx.api.registerSelectedItemAction(SWORD_ID,{use:()=>true,attack:()=>true});ctx.api.updateSword=sword.update;
 const dispose=sword.dispose;sword.dispose=()=>{unwatch();dispose();};
 // Inventory owns the controller, including the modifier-awareness subscription.
 const oldDispose=world.inventory.dispose;world.inventory.dispose=function(...args){unwatch();return oldDispose.apply(this,args);};
}
