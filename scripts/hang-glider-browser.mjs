// Nodevision/scripts/hang-glider-browser.mjs
// This browser regression drives the real player movement frame with a held glider and verifies jump transitions, collisions, settings, exclusions and cleanup.
import * as THREE from '/lib/three/three.module.js';
import {createPlayerInventory} from '/PanelInstances/ViewPanels/GameViewDependencies/playerInventory.mjs';
import {createHangGliderTool} from '/PanelInstances/ViewPanels/GameViewDependencies/hangGliderTool.mjs';
import {installPlayerMovementFrameAbility} from '/PanelInstances/ViewPanels/GameViewDependencies/Abilities/MovementAbilities/PlayerMovementFrameAbility.mjs';
import {installSelectedItemActionAbility} from '/PanelInstances/ViewPanels/GameViewDependencies/Abilities/CommandAbilities/SelectedItemActionAbility.mjs';
import {installEditorSelectionCommandAbility} from '/PanelInstances/ViewPanels/GameViewDependencies/Abilities/CommandAbilities/EditorSelectionCommandAbility.mjs';
let checks=0;const ok=(value,label)=>{checks++;if(!value)throw Error(label);};
try {
  window.NodevisionState={currentMode:'Virtual World Editing'};
  const panel=document.getElementById('editor'),scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(),inventory=createPlayerInventory({panel});
  const movementState={playerMode:'creative',worldMode:'3d',playerHeight:1.75,isGrounded:true,velocityY:0,heldKeys:{}};
  const controls={getObject:()=>camera,getDirection:vector=>camera.getWorldDirection(vector),unlock(){}};
  const glider=createHangGliderTool({THREE,scene,panel,inventory,controls,movementState});
  window.VRWorldContext={scene,panel,inventory,movementState,hangGliderTool:glider};
  let collision=()=>false,water=null,mounted=null;
  const ctx={THREE,scene,controls,camera,movementState,forward:new THREE.Vector3(),right:new THREE.Vector3(),up:new THREE.Vector3(0,1,0),
    groundLevel:0,basePlayerHeight:1.75,baseSwimSpeedMultiplier:.5,stepHeight:.5,defaultCrouchJumpMultiplier:1.5,selectedItemActions:new Map(),
    wouldCollide:position=>collision(position),api:{getActiveMountedVehicle:()=>mounted,updateGrabbedObjectFollow(){},updateGizmoHandleOrientations(){},
      getWaterVolumeAtPosition:()=>water,readActiveGravityModel:()=>({mode:'flat',flatG:.012}),runSpeedMultiplier:()=>1,clearRunState(){},updateMountedFlyingCarpet(){},
      sampleExpressionTerrainGroundLevel:()=>0,readJumpForce:()=>.28,clearVectorGravityMotion(){}}};
  installPlayerMovementFrameAbility(ctx);installSelectedItemActionAbility(ctx);installEditorSelectionCommandAbility(ctx);
  const tick=(jump=false,extra={})=>ctx.api.applyPlayerMovementFrame({inputState:{jump,...extra},crouching:false,crawling:false,inEditorMode:true,editorGravityDisabled:false,speed:.2});
  const airborne=()=>{glider.fold();camera.position.set(0,20,0);camera.rotation.set(0,0,0);movementState.isGrounded=false;movementState.velocityY=-.1;tick(false);tick(true);};
  ok(inventory.items.some(item=>item.id==='hang-glider' && item.tool),'glider inventory tool');
  inventory.equipItemToActiveHand('hang-glider');camera.position.y=1.75;
  tick(true);ok(!movementState.isGliding && !movementState.isGrounded,'first jump is ordinary ground jump');
  for(let i=0;i<3;i++)tick(true);ok(!movementState.isGliding,'holding ground jump does not deploy');
  tick(false);tick(true);ok(movementState.isGliding,'fresh airborne jump deploys');
  glider.update();ok(glider.wing.visible,'deployed wing visible');
  for(let i=0;i<3;i++)tick(true);ok(movementState.isGliding,'held jump does not repeatedly toggle');
  tick(false);tick(true);ok(!movementState.isGliding,'second fresh airborne jump folds');
  airborne();const y=camera.position.y,z=camera.position.z;
  for(let i=0;i<60;i++)tick(false,{moveForward:true});
  ok(camera.position.z<z-3,'weight produces forward travel without walking');
  ok(camera.position.y<y && camera.position.y>y-8,'glider descends slowly instead of hovering or free-falling');
  ok(movementState.gliderSpeed>0 && movementState.gliderSpeed<=24,'speed capped');
  camera.rotation.y=-Math.PI/2;const x=camera.position.x;for(let i=0;i<60;i++)tick();ok(camera.position.x>x+2,'look direction steers glider');
  airborne();collision=position=>position.z<-.15;for(let i=0;i<120;i++)tick();ok(camera.position.z>=-.15,'horizontal collision prevents wall penetration');collision=()=>false;
  airborne();camera.position.y=1.76;movementState.velocityY=-.3;tick();ok(movementState.isGrounded && !movementState.isGliding,'landing folds glider and preserves ground collision');
  airborne();movementState.isFlying=true;tick();ok(!movementState.isGliding,'powered flight folds glider');movementState.isFlying=false;
  airborne();water={};tick();ok(!movementState.isGliding,'swimming folds glider');water=null;
  airborne();mounted={};tick();ok(!movementState.isGliding,'mounting folds glider');mounted=null;
  airborne();ctx.api.applyPlayerMovementFrame({inputState:{jump:false},inEditorMode:true,editorGravityDisabled:true,speed:.2});ok(!movementState.isGliding,'disabled gravity folds glider');
  airborne();movementState.worldMode='2d';tick();ok(!movementState.isGliding,'2D movement remains unchanged');movementState.worldMode='3d';
  airborne();glider.step({inputState:{jump:false},allowed:false,gravity:0,wouldCollide:()=>false});ok(!movementState.isGliding,'unsupported gravity cannot power glider');
  airborne();inventory.equipItemToActiveHand(null);tick();ok(!movementState.isGliding,'unequipping folds glider');
  inventory.switchHand();inventory.equipItemToActiveHand('hang-glider');inventory.switchHand();airborne();ok(movementState.isGliding,'off-hand glider can deploy');
  let flashlightOpened=false;window.VRWorldContext.flashlightTool={openSettings(){flashlightOpened=true;return true;}};
  inventory.equipItemToActiveHand('flashlight');movementState.selectedItemAdjustLatch=false;ctx.api.handleAdjustPress(true,performance.now());ok(flashlightOpened,'active flashlight keeps G priority over off-hand glider');
  inventory.equipItemToActiveHand(null);
  movementState.selectedItemAdjustLatch=false;ok(ctx.api.handleAdjustPress(true,performance.now()),'G routes to held glider');
  const form=()=>panel.querySelector('[data-hang-glider-settings]');ok(form(),'G shows aerodynamic controls');
  const input=(key,value)=>{const field=form().querySelector(`[data-field="${key}"]`);field.value=value;field.dispatchEvent(new Event('input',{bubbles:true}));};
  input('lift','.75');input('thrust','.4');input('drag','.05');input('steering','.15');input('maxSpeed','12');
  const item=inventory.items.find(item=>item.id==='hang-glider');ok(item.hangGliderSettings.lift===.75 && item.hangGliderSettings.maxSpeed===12,'aerodynamics applied to inventory item');
  input('lift','2');ok(item.hangGliderSettings.lift===.75,'invalid lift cannot create hover');
  form().querySelector('button').click();ok(!form() && !movementState.textEditing,'Done restores input');
  for(let i=0;i<60;i++)tick();ok(movementState.gliderSpeed<=12,'configured speed cap used by movement');
  glider.openSettings();ok(form().querySelector('[data-field="lift"]').value==='0.75','settings retained on reopen');
  glider.dispose();ok(!form() && !glider.wing.parent && !movementState.isGliding,'cleanup removes settings and wing');inventory.dispose();
  document.getElementById('result').textContent=`PASS: ${checks} hang glider inventory, airborne jump, physics, collisions, G settings and cleanup checks`;
} catch(error) {document.getElementById('result').textContent='FAIL: '+error.stack;}
