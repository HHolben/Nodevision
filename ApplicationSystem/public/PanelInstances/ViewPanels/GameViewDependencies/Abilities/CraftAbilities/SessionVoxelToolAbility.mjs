// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/GameViewDependencies/Abilities/CraftAbilities/SessionVoxelToolAbility.mjs
// Routes the existing inventory, use/attack keys and G settings to one transient brush transaction per held stroke.
import {installMovementApi} from '../movementContext.mjs';
import {worldAuthoringAllowed} from '/MetaWorld/WorldAuthoringPermissions.mjs';
import {TOOLS} from '/MetaWorld/SessionVoxels/Authoring.mjs';
import {openSessionVoxelSettings} from '/MetaWorld/SessionVoxels/Settings.mjs';
import {setStatus} from '/StatusBar.mjs';
export function installSessionVoxelToolAbility(ctx){
 let preview=null,last=null,active=null,operation=null,latch=false,adjust=false,plane=null;
 function stop(){active?.finish();active=null;last=null;operation=null;plane=null;if(preview){preview.removeFromParent();preview.geometry.dispose();preview.material.dispose();preview=null;}}
 if(window.VRWorldContext?.scene===ctx.scene)window.VRWorldContext.stopSessionVoxelTools=stop;
 function updateSessionVoxelTools(input={}){
  const world=window.VRWorldContext,api=world?.sessionVoxels,id=world?.inventory?.getSelectedItem()?.id,tool=id?.startsWith('session-voxel-')?id.slice(14):null;
  const focused=document.activeElement,typing=focused?.closest?.('input,textarea,select,[contenteditable="true"],dialog')||ctx.movementState.textEditing||ctx.movementState.textWorldConsoleActive;
  if(!api||!TOOLS.includes(tool)||world.scene!==ctx.scene||!worldAuthoringAllowed(ctx.movementState)||ctx.movementState.playerMode!=='creative'||typing||world.inventory.isMenuOpen()||input.cleanupOnly){stop();latch=false;return false;}
  if(input.stretch){if(!adjust){stop();openSessionVoxelSettings();}adjust=true;return true;}adjust=false;
  api.settings.tool=tool;api.sync();const direction=new ctx.THREE.Vector3();ctx.camera.getWorldDirection(direction);const hit=api.raycast(ctx.camera.getWorldPosition(new ctx.THREE.Vector3()).toArray(),direction.toArray());
  const op=input.attack?'erase':tool,pressed=!!(input.use||input.attack);if(active&&(active!==api||operation!==op||!pressed))stop();
  let at=hit?.at;if(at&&(op==='add'||op==='brush'))at=at.map((n,i)=>n+hit.normal[i]);
  if(active&&plane&&['brush','erase','paint','revert'].includes(op)){const origin=ctx.camera.getWorldPosition(new ctx.THREE.Vector3()),d=direction.getComponent(plane.axis),t=d?(plane.value-origin.getComponent(plane.axis))/d:-1;if(t>=0&&t<=24){at=api.cell(origin.addScaledVector(direction,t).toArray());at[plane.axis]=plane.cell;}else at=null;}
  if(at){if(!preview){preview=new ctx.THREE.Mesh(new ctx.THREE.BoxGeometry(1,1,1),new ctx.THREE.MeshBasicMaterial({color:0x55ccff,wireframe:true,depthTest:false}));preview.userData.isEditorHelper=true;preview.raycast=()=>{};ctx.scene.add(preview);}const size=['add','pick'].includes(op)?1:api.settings.brush.size;const shape=size>1&&api.settings.brush.shape==='sphere'?'sphere':'box';if(preview.userData.shape!==shape){preview.geometry.dispose();preview.geometry=shape==='sphere'?new ctx.THREE.SphereGeometry(.5,16,12):new ctx.THREE.BoxGeometry(1,1,1);preview.userData.shape=shape;}
   preview.position.fromArray(api.point(at).map(n=>n+(size%2===0?.125:0)));preview.scale.setScalar(size*.25);preview.material.color.set(op==='erase'?0xff6655:op==='revert'?0x77ee88:0x55ccff);preview.visible=true;
  }else if(preview)preview.visible=false;
  try{if(pressed&&at&&!(op==='add'&&latch)){if(op==='pick'){if(!latch)api.edit('pick',[at]);}else{if(!active){api.begin();active=api;operation=op;const axis=hit.normal.findIndex(n=>n!==0);if(axis>=0)plane={axis,value:api.point(at)[axis],cell:at[axis]};}if(!last||at.some((n,i)=>n!==last[i]))api.stroke(op,last,at);last=at;}}else if(!pressed){active?.finish();active=null;last=null;}api.flush();}catch(e){active?.cancel();active=null;last=null;setStatus('Temporary voxels',e.message);}latch=pressed;return true;
 }
 for(const tool of TOOLS)ctx.api.registerSelectedItemAction('session-voxel-'+tool,{use:()=>true,attack:()=>true,adjust:()=>{openSessionVoxelSettings();return true;}});
 return installMovementApi(ctx,{updateSessionVoxelTools});
}
