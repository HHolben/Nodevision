// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/GameViewDependencies/hangGliderTool.mjs
// This controller owns deployment, collision-checked gliding motion, an editor-only wing visual, and the equipped glider's aerodynamic dialog. It reuses normal ground movement for vertical collision and landing resolution.
import {normalizeHangGliderSettings,hangGliderForces} from './hangGliderPhysics.mjs';
import {openHangGliderSettings} from './hangGliderSettings.mjs';
export function createHangGliderTool({THREE,scene,panel,inventory,controls,movementState}) {
  let jumpDown=false,speed=0,dialog=null,disposed=false;
  const direction=new THREE.Vector3(0,0,-1),aim=new THREE.Vector3(),next=new THREE.Vector3();
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute([-2,0,.6, 0,.2,-1, 0,-.1,.4, 0,-.1,.4, 0,.2,-1, 2,0,.6],3));
  geometry.computeVertexNormals();
  const material=new THREE.MeshStandardMaterial({color:0xf5a623,side:THREE.DoubleSide,roughness:.8});
  const wing=new THREE.Mesh(geometry,material);wing.name='Player hang glider';wing.userData.isEditorHelper=true;wing.visible=false;wing.raycast=()=>{};scene.add(wing);
  const held=()=>inventory.getHeldItems().find(({item})=>item.id==='hang-glider')?.item;
  function fold() { movementState.isGliding=false;movementState.gliderSpeed=0;speed=0;wing.visible=false; }
  function update() {
    if(disposed)return;
    if(!held() || movementState.isGrounded || movementState.isFlying || movementState.isSwimming || movementState.worldMode==='2d')fold();
    if(!held())dialog?.close();
    wing.visible=movementState.isGliding===true;
    if(wing.visible){wing.position.copy(controls.getObject().position);wing.position.y+=.45;wing.rotation.y=Math.atan2(-direction.x,-direction.z);}
  }
  function step({inputState,allowed,gravity,wouldCollide}) {
    const pressed=!!inputState.jump && !jumpDown;jumpDown=!!inputState.jump;
    if(disposed || !held() || !allowed || !Number.isFinite(gravity) || gravity<=0 || movementState.isGrounded){fold();return gravity;}
    controls.getDirection(aim);aim.y=0;
    if(aim.lengthSq()>1e-8)aim.normalize();else aim.copy(direction);
    if(pressed && !movementState.textEditing) {
      if(movementState.isGliding)fold();
      else {movementState.isGliding=true;direction.copy(aim);speed=0;}
    }
    if(!movementState.isGliding)return gravity;
    const settings=normalizeHangGliderSettings(held().hangGliderSettings);
    direction.lerp(aim,settings.steering);if(direction.lengthSq()>1e-8)direction.normalize();
    const forces=hangGliderForces(speed,Number(movementState.velocityY)||0,gravity,settings);
    speed=forces.speed;movementState.velocityY=forces.velocityY;
    // Small collision steps prevent the configured speed cap from tunneling
    // through walls. Ground/ceiling collision remains in applyGroundMovement.
    const count=Math.max(1,Math.ceil(speed/.1)),distance=speed/count;
    for(let index=0;index<count;index++) {
      next.copy(controls.getObject().position).addScaledVector(direction,distance);
      if(wouldCollide(next)){speed=0;break;}
      controls.getObject().position.copy(next);
    }
    movementState.gliderSpeed=speed*60;
    update();return forces.gravity;
  }
  function openSettings() {
    if(disposed || !held())return false;
    if(dialog){dialog.dialog.focus();return true;}
    dialog=openHangGliderSettings({panel,movementState,controls,item:held(),onClose(){dialog=null;}});return true;
  }
  const unsubscribe=inventory.subscribeSelection(update);
  return {step,update,fold,openSettings,wing,
    dispose(){if(disposed)return;disposed=true;unsubscribe();dialog?.close();fold();wing.removeFromParent();geometry.dispose();material.dispose();}
  };
}
