// Nodevision/scripts/raycasting-teleporter-browser.mjs
// Exercises inventory, trusted primary input, terrain collision, cancellation and Viewer reopening in the production GameView rather than a standalone tool fixture.
import {setupPanel} from '/PanelInstances/ViewPanels/GameView.mjs';
import {createToolbar} from '/panels/createToolbar.mjs';
import {saveCurrentWorldFile} from '/PanelInstances/ViewPanels/GameViewDependencies/worldSave.mjs';
import {checkTeleporterAssets} from './teleporter-assets-browser.mjs';
const check=(v,m)=>{if(!v)throw Error(m);};
const wait=async(fn,label)=>{const end=performance.now()+45000;while(!fn()){if(performance.now()>end)throw Error(label);await new Promise(r=>setTimeout(r,25));}};
const tick=()=>new Promise(r=>setTimeout(r,100));
try{
 console.log('NV_TEST_PROGRESS','teleporter fixture started');
 window.NodevisionState={currentMode:'Virtual World Editing',virtualWorldMode:'creative'};
 await createToolbar();console.log('NV_TEST_PROGRESS','toolbar ready');const panel=document.getElementById('editor');Object.assign(panel.style,{width:'800px',height:'600px'});
 await setupPanel(panel,{filePath:'world.html'});check(await panel.worldReady,'Production world opens');console.log('NV_TEST_PROGRESS','world ready');
 const ctx=window.VRWorldContext,root=ctx.objects.find(o=>o.userData.terrainRuntime),runtime=root.userData.terrainRuntime,tool=ctx.raycastingTeleporter;
 await runtime.ready;check(tool,'Tool registered');const original=JSON.stringify(runtime.serialize()),documentBefore=JSON.stringify(ctx.currentWorldDefinition),objects=ctx.objects.length;
 ctx.movementState.editorGravityEnabled=false;ctx.resume();
 ctx.inventory.setMenuOpen(true);
 [...document.querySelectorAll('[data-inventory-categories] button')].find(b=>b.textContent==='Tools').click();
 const cell=document.querySelector('[data-inventory-item-id="raycasting-teleporter"]');check(cell,'Inventory tool cell');cell.click();
 check(ctx.inventory.getSelectedItem()?.id==='raycasting-teleporter','Inventory equips tool');ctx.inventory.setMenuOpen(false);document.activeElement?.blur();
 const player=ctx.controls.getObject(),camera=panel._vrViewController.getActiveCamera();
 const aim=(x,z)=>{player.position.set(x,10,z);camera.lookAt(x,0,z);player.updateMatrixWorld(true);};
 aim(20,20);await wait(()=>tool.target,'Terrain target acquired');check(tool.visual.gun.visible&&tool.visual.marker.visible,'Gun and marker visible');
 async function fire(){const rect=panel.querySelector('canvas').getBoundingClientRect();window.teleporterInputRequest={x:rect.x+rect.width/2,y:rect.y+rect.height/2};await wait(()=>!window.teleporterInputRequest,'Trusted primary input delivered');await tick();}
 const orientation=camera.quaternion.clone();await fire();check(camera===player&&camera.quaternion.equals(orientation),'Player and camera remain synchronized with orientation preserved');check(player.position.y<5,'Primary mouse teleports to geographic terrain');check(tool.status.textContent.includes('Ready')||tool.status.textContent==='Teleported','Safe target feedback');check(ctx.movementState.velocityY===0,'Velocity cleared');
 console.log('NV_TEST_PROGRESS','primary input and geographic landing verified');
 // The far end remains coarse while near chunks stream around the player.
 player.position.set(20,10,20);camera.lookAt(45,1,65);await wait(()=>tool.target?.coarse&&tool.target.point.z>60,'Distant coarse terrain target');const destination=tool.target.point.clone();await fire();check(player.position.y<5&&Math.abs(player.position.z-destination.z)<.1,'Coarse geographic destination resolves');
 console.log('NV_TEST_PROGRESS','coarse geographic landing verified');
 for(const mode of ['polygonal','voxel']){
  await runtime.setRepresentation(mode);aim(20,20);await wait(()=>runtime.manager.columnReady(2,2)&&tool.target&&!tool.target.coarse,'Detailed '+mode+' target');await fire();check(player.position.y<5,'Detailed '+mode+' teleport');
 }
 console.log('NV_TEST_PROGRESS','voxel and polygonal detailed landing verified');
 // Hold the real shared readiness promise to exercise delayed completion and cancellation.
 const ready=runtime.ready;let release;runtime.ready=new Promise(r=>release=r);aim(20,20);await tick();await fire();check(tool.pending&&player.position.y===10,'Pending request holds original position');
 check(await tool.fire()===false,'Duplicate activation rejected');ctx.inventory.equipItemToActiveHand(null);release(true);await tick();check(!tool.pending&&player.position.y===10,'Unequip cancels pending request');runtime.ready=ready;ctx.inventory.equipItemToActiveHand('raycasting-teleporter');await tick();
 runtime.ready=new Promise(r=>release=r);await fire();check(tool.pending,'Second pending request');ctx.movementState.heldKeys.w=true;await tick();check(player.position.y===10,'Pending movement remains frozen');ctx.movementState.heldKeys.w=false;release(true);await wait(()=>!tool.pending,'Prepared request completes');check(player.position.y<5,'Verified destination commits after readiness');runtime.ready=ready;
 // Exercise the supported controller primary binding through the production input-state builder.
 aim(20,20);await tick();const getPads=navigator.getGamepads;Object.defineProperty(navigator,'getGamepads',{configurable:true,value:()=>[{connected:true,buttons:Array.from({length:6},(_,i)=>({pressed:i===5})),axes:[]}]});await wait(()=>player.position.y<5,'Controller primary activation');Object.defineProperty(navigator,'getGamepads',{configurable:true,value:getPads});await tick();
 console.log('NV_TEST_PROGRESS','pending cancellation, readiness and controller input verified');
 aim(20,20);camera.lookAt(20,100,20);check(await tool.fire()===false&&player.position.y===10,'Miss never moves player');aim(20,20);
 ctx.setPlayerMode('survival');check(await tool.fire()===false,'Play mode cannot teleport');ctx.setPlayerMode('creative');
 runtime.ready=Promise.resolve(false);check(await tool.fire()===false&&player.position.y===10,'Unavailable source cancels safely');runtime.ready=ready;
 runtime.ready=new Promise(r=>release=r);await fire();check(tool.pending,'Cancellation request pending');tool.update({rotate:true});release(true);await tick();check(!tool.pending&&player.position.y===10,'Secondary input cancels without travel');runtime.ready=ready;
 runtime.ready=new Promise(r=>release=r);await fire();document.dispatchEvent(new KeyboardEvent('keyup',{key:'Escape',bubbles:true}));await tick();check(!tool.pending&&player.position.y===10,'Escape keyup cancels when locked keydown is consumed');release(true);runtime.ready=ready;
 await checkTeleporterAssets(check);console.log('NV_TEST_PROGRESS','imported assets and constructions verified');
 check(JSON.stringify(runtime.serialize())===original&&ctx.objects.length===objects&&JSON.stringify(ctx.currentWorldDefinition)===documentBefore,'Travel preserves terrain and objects');
 ctx.inventory.equipItemToActiveHand(null);await tick();check(!tool.visual.gun.visible&&!tool.visual.marker.visible,'Unequip hides helpers');
 check(await saveCurrentWorldFile({state:ctx.state,movementState:ctx.movementState,objects:ctx.objects,lights:ctx.lights}),'Production save');
 ctx.inventory.equipItemToActiveHand('raycasting-teleporter');aim(20,20);runtime.ready=new Promise(r=>release=r);const closing=tool.fire();check(tool.pending,'Close while pending');const closingPosition=player.position.clone();panel.cleanup();release(true);check(await closing===false&&player.position.equals(closingPosition),'Closure cancels pending travel');check(!tool.visual.gun.parent&&!tool.visual.marker.parent&&!tool.status.isConnected,'World cleanup releases helpers');
 window.NodevisionState.currentMode='Virtual World Viewing';await setupPanel(panel,{filePath:'world.html',viewPermissions:{authoring:false}});check(await panel.worldReady,'Viewer reopens');
 const viewer=window.VRWorldContext;check(!viewer.inventory.items.some(i=>i.id==='raycasting-teleporter'),'Viewer inventory excludes teleporter');
 const reopened=viewer.objects.find(o=>o.userData.terrainRuntime).userData.terrainRuntime;await reopened.ready;check(JSON.stringify(reopened.serialize())===original,'Save/reopen preserves geographic source and cache');
 panel.cleanup();document.getElementById('result').textContent='PASS: production inventory, trusted primary and controller input, geographic coarse and detailed voxel/polygonal travel, physics, cancellation, permissions, imported GOX/STL/glTF/GLB, constructions, cleanup and save/reopen';
}catch(error){document.getElementById('result').textContent='FAIL: '+error.stack;}
