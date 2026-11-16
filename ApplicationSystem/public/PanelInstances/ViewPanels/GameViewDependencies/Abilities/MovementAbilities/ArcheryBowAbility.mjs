// Uses the existing selected-item dispatcher and inventory lifetime; Viewer and world tool-use permissions retain their existing policy.
import {worldAuthoringAllowed} from '/MetaWorld/WorldAuthoringPermissions.mjs';
import {createArcheryBow,BOW_ID} from '../../Archery/Controller.mjs';
export function installArcheryBowAbility(ctx){
 const world=window.VRWorldContext;if(world?.scene!==ctx.scene||!world.inventory||!worldAuthoringAllowed(ctx.movementState))return;
 world.archeryBow?.dispose();if(!world.inventory.items.some(item=>item.id===BOW_ID))world.inventory.addItem(BOW_ID,1,'Archery Bow',{tool:true,category:'tools',autoAssign:false});
 const bow=createArcheryBow(ctx,world);world.archeryBow=bow;
 ctx.api.registerSelectedItemAction(BOW_ID,{use:()=>true,attack:()=>{bow.cancel();return true;},adjust:bow.configure});
 Object.assign(ctx.api,{updateArcheryBow:bow.update,tickArchery:bow.tick});
}
