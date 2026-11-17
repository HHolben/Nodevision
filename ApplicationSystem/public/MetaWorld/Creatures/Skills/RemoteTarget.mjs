import {createArcheryTarget} from '../../ArcheryTarget/Runtime.mjs';
import {createGround} from '../../Mobs/Ground.mjs';
import {viewAllowsAbility} from '../../WorldAuthoringPermissions.mjs';
// Owned gameplay objects reuse target collision/scoring without entering authored objects/history.
export function remoteTargetEffect(ctx,owner,args,config){
 const failed=(status,reason)=>({status,reason});if(!ctx||ctx.movementState.paused||ctx.movementState.worldRules?.allowToolUse===false||!(viewAllowsAbility(ctx.movementState,'allowToolUse')||ctx.movementState.viewPermissions?.gameplay===true))return failed('permission-denied','Gameplay target placement is not permitted');
 if(Math.abs(args.orientation[0])>1e-6||Math.abs(args.orientation[2])>1e-6)return failed('invalid-target','Ground targets support upright yaw orientation only');
 if(args.targetType!=='archery-target')return failed('invalid-target','Only the registered archery target is allowed');const position=owner.getPosition();if(Math.hypot(...args.location.map((n,i)=>n-position[i]))>config.maxDistance)return failed('out-of-range','Requested target exceeds skill range');
 const stats={groundQueries:0,collisionQueries:0},self={userData:{}},ground=createGround(ctx,self,stats);const y=ground.sample(args.location,.7,2.3,.16);if(!Number.isFinite(y))return failed('blocked-location',ground.lastFailure||'Unsupported or obstructed surface');
 const id='skill-target-'+crypto.randomUUID(),root=createArcheryTarget(ctx.THREE,{id,position:[args.location[0],y,args.location[2]],rotation:args.orientation,label:'',feedback:false},ctx.colliders,{panel:ctx.panel});Object.assign(root.userData,{runtimeGenerated:true,skillOwner:owner.id,placedByPlayer:false,breakable:false});ctx.scene.add(root);ctx.objects.push(root);let elapsed=0,disposed=false,lastHit=null;
 const onHit=e=>{if(e.detail?.targetId===id)lastHit={target:id,score:e.detail.score,arrow:e.detail.arrowId||null};};ctx.panel?.addEventListener('archery-target-hit',onHit);
 function cancel(){if(disposed)return;disposed=true;ctx.panel?.removeEventListener('archery-target-hit',onHit);ctx.archeryBow?.flight.removeTarget(root);root.userData.archeryTargetRuntime.dispose();const i=ctx.objects.indexOf(root);if(i>=0)ctx.objects.splice(i,1);}
 return {status:'success',target:id,root,hit:()=>lastHit,tick(dt){if(root.userData.archeryTargetRuntime.disposed){cancel();return;}elapsed+=dt;if(elapsed>=config.lifetime)cancel();},cancel,disposed:()=>disposed};
}
