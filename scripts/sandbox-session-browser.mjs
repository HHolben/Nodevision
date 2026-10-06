// Nodevision/scripts/sandbox-session-browser.mjs
// This fixture launches the actual Session runtime and Game View in a minimal tabbed shell, checking world planning, persistence, permissions, movement, and teardown.
import { startSession,quitActiveSession,getActiveSession } from '/Sessions/SessionController.mjs';
import { openPanelTabInCell,getActivePanelTab } from '/panels/panelTabs.mjs';
import { getActiveMetaWorldLayerBridge } from '/MetaWorld/MetaWorldLayerState.mjs';
import { createDefaultHtmlWorld } from '/MetaWorld/DefaultHtmlWorld.mjs';
import { readWorldDraft } from '/MetaWorld/WorldDocumentDrafts.mjs';
import { createSandboxWorldStartup } from '/Sessions/SandboxWorldStartup.mjs';
import { applyDirectionalMovement,applyGroundMovement } from '/PanelInstances/ViewPanels/GameViewDependencies/movementSteps.mjs';
import { installTerrainGroundAbility } from '/PanelInstances/ViewPanels/GameViewDependencies/Abilities/MovementAbilities/TerrainGroundAbility.mjs';
import { createCollisionChecker } from '/PanelInstances/ViewPanels/GameViewDependencies/collisionCheck.mjs';
import * as THREE from '/lib/three/three.module.js';
const ok=(value,label)=>{if(!value)throw Error(label);};
const tick=()=>new Promise(resolve=>setTimeout(resolve,25));
async function until(check,label){for(let i=0;i<300;i++){if(check())return;await tick();}throw Error('Timed out: '+label);}
const errors=[];window.addEventListener('unhandledrejection',event=>errors.push(String(event.reason?.stack||event.reason)));
try{
 window.NodevisionState={currentMode:'HTMLediting',virtualWorldMode:'survival'};
 window.selectedFilePath='sandbox-test.html';
 const cell=document.getElementById('editor').closest('.panel-cell');cell.replaceChildren();window.activeCell=cell;
 const originalTab=await openPanelTabInCell(cell,{panelType:'FileView',panelClass:'ViewPanel',panelVars:{filePath:'sandbox-test.html'}},host=>{host.textContent='Original HTML panel';});
 let pageReads=0,holdAt=Infinity,releaseRead=null;
 let html='<!doctype html><html><body><h1>Preserve my page</h1></body></html>', saves=0;
 const nativeFetch=window.fetch.bind(window);
 const scripts={};for(const mode of ['Build','Play'])scripts[mode]=await(await nativeFetch('/sandbox-builtins/Sandbox'+mode+'.NodevisionSession.js')).text();
 window.fetch=async(url,options)=>{
  const text=String(url);
  if(text.startsWith('/api/sessions/read')){const mode=text.includes('SandboxPlay')?'Play':'Build';return new Response(JSON.stringify({session:{id:'Sandbox'+mode+'.NodevisionSession.js',scope:'builtin',title:'Sandbox — '+mode,source:scripts[mode]}}));}
  if(text==='/Notebook/sandbox-test.html'){pageReads++;if(pageReads===holdAt)return new Promise(resolve=>{releaseRead=()=>resolve(new Response(html));});return new Response(html);}
  if(text==='/api/load-world')return new Response(JSON.stringify({worldDefinition:createDefaultHtmlWorld('sandbox-test.html')}));
  if(text==='/api/save'){html=JSON.parse(options.body).content;saves++;return new Response('{"success":true}');}
  if(text.includes('GameControllerSettings.json'))return new Response('{}');
  return nativeFetch(url,options);
 };
 const terrain=()=>window.VRWorldContext?.objects.find(o=>o.userData.proceduralVoxelRuntime);
 async function launch(mode){window.activeCell=cell;await startSession('builtin','Sandbox'+mode+'.NodevisionSession.js');await until(()=>terrain()?.children.length>0,'terrain in '+mode);await tick();}
 function walk(){
  const ctx=window.VRWorldContext,ms=ctx.movementState;ms.velocityY=0;ms.isGrounded=true;ms.activeExpressionTerrainColliderId='procedural-terrain';
  const movement={api:{},colliders:ctx.colliders,movementState:ms,groundLevel:0,playerRadius:.35,stepHeight:.5};installTerrainGroundAbility(movement);
  const collision=createCollisionChecker({colliders:ctx.colliders,movementState:ms,playerRadius:.35});
  const controls={getObject:()=>ctx.camera,getDirection:v=>v.set(1,0,0)},start=ctx.camera.position.x;
  for(let i=0;i<20;i++){
   applyDirectionalMovement({THREE,controls,movementState:ms,inputState:{moveForward:true},forward:new THREE.Vector3(),right:new THREE.Vector3(),up:new THREE.Vector3(0,1,0),speed:.2,wouldCollide:collision,stepHeight:.5});
   applyGroundMovement({controls,inputState:{},movementState:ms,gravity:.012,jumpSpeed:.28,groundLevel:movement.api.sampleExpressionTerrainGroundLevel(ctx.camera.position),wouldCollide:collision});
  }
  ok(ctx.camera.position.x>start+3,'movement works');ok(ms.isGrounded,'player remains on terrain');
 }
 await launch('Build');
 ok(!document.body.classList.contains('nv-session-mode'),'workspace is visible');
 ok(window.NodevisionState.currentMode==='Virtual World Editing','Build exposes editing');
 let ctx=window.VRWorldContext,root=terrain(),seed=root.userData.proceduralVoxelRuntime.definition.generator.seed;
 ok(ctx.camera.position.y>10,'spawn above generated ground');walk();
 ctx.panel._vrRenderer.render(ctx.scene,ctx.camera);ok(ctx.panel._vrRenderer.info.render.triangles>0,'normal renderer draws terrain');
 let bridge=getActiveMetaWorldLayerBridge();const authored=bridge.addObjectLayer({id:'sandbox-authored',type:'box',position:[4,28,-3],size:[1,1,1],color:'#cc7733',isSolid:true});
 ok(authored,'Build creates ordinary objects');
 ok(await ctx.saveVirtualWorldFile(),'normal world save succeeds');ok(saves===1,'save wrote one HTML document');
 const saved=JSON.parse(new DOMParser().parseFromString(html,'text/html').querySelector('#nodevision-metaworld').textContent);
 ok(saved.objects.filter(o=>o.type==='procedural-voxel-world').length===1,'save has one procedural definition');ok(saved.objects.length<5,'no runtime chunks serialized');bridge.addObjectLayer({id:'after-save-box',type:'box',position:[2,29,2],size:[1,1,1]});ok(html.includes('Preserve my page'),'page preserved');
 await quitActiveSession();ok(!window.VRWorldContext,'engine disposed on exit');ok(root.children.length===0,'chunk geometry removed');
 ok(!document.querySelector('.nv-sandbox-exit'),'exit handler removed');ok(getActivePanelTab(cell)?.tabId===originalTab.tabId,'original tab restored');
 await launch('Play');ctx=window.VRWorldContext;root=terrain();bridge=getActiveMetaWorldLayerBridge();
 ok(root.userData.proceduralVoxelRuntime.definition.generator.seed===seed,'Play reuses persisted seed');
 ok(ctx.objects.filter(o=>o.userData.proceduralVoxelRuntime).length===1,'reentry does not duplicate terrain');
 ok(ctx.movementState.playerMode==='survival','Play uses navigation mode');ok(ctx.objects.some(o=>o.userData.metaWorldLayerId==='after-save-box'),'post-save unsaved edit retained');walk();
 const count=ctx.objects.length;
 const abilityContext={api:{},movementState:ctx.movementState};
 (await import('/PanelInstances/ViewPanels/GameViewDependencies/Abilities/ConstructAbilities/VoxelPlacementAbility.mjs')).installVoxelPlacementAbility(abilityContext);
 (await import('/PanelInstances/ViewPanels/GameViewDependencies/Abilities/AttackAbilities/BreakTargetAbility.mjs')).installBreakTargetAbility(abilityContext);
 ok(abilityContext.api.tryPlaceVoxel()===false,'Play blocks actual voxel placement');
 ok(abilityContext.api.tryBreakTargetBlock()===false,'Play blocks actual break entry point');
 ok(bridge.addObjectLayer({type:'box'})===false,'Play blocks creation');ok(bridge.removeObjectLayer('sandbox-authored')===false,'Play blocks deletion');
 ok(bridge.recordObjectTransform(ctx.objects[0])===false,'Play blocks transforms');
 ok(ctx.terrainToolController.generateTerrain()===false,'Play blocks terrain authoring');
 ok(ctx.objectInspector.inspectTarget(ctx.objects[0])===false,'Play suppresses edit inspector');
 ok(ctx.equationColliderController.addPlane({})===false,'Play blocks equation insertion');
 ctx.setPlayerMode('creative');ok(ctx.movementState.playerMode==='survival','cannot bypass restriction with mode switch');
 ok(await ctx.saveVirtualWorldFile()===false,'Play cannot save authoring changes');ok(ctx.objects.length===count,'world intact');
 ctx.pause();ok(ctx.movementState.paused,'normal pause available');ctx.resume();
 await quitActiveSession();await launch('Build');
 ok(terrain().userData.proceduralVoxelRuntime.definition.generator.seed===seed,'Build returns to same world');
 ok(getActiveMetaWorldLayerBridge().removeObjectLayer('sandbox-authored'),'Build restores delete ability');
 await quitActiveSession();
 // No-save exit/reentry preserves a pending document definition and all authored additions.
 html='<html><body>Another empty page</body></html>';await launch('Build');seed=terrain().userData.proceduralVoxelRuntime.definition.generator.seed;
 getActiveMetaWorldLayerBridge().addObjectLayer({id:'unsaved-box',type:'box',position:[2,30,2],size:[1,1,1]});await quitActiveSession();
 ok(readWorldDraft('sandbox-test.html',html),'unsaved draft retained');await launch('Play');
 ok(terrain().userData.proceduralVoxelRuntime.definition.generator.seed===seed,'unsaved seed retained');ok(window.VRWorldContext.objects.some(o=>o.userData.metaWorldLayerId==='unsaved-box'),'unsaved authored object retained');document.querySelector('.nv-sandbox-exit').click();await until(()=>!getActiveSession(),'Exit Sandbox completes session');
 const existing={name:'Authored',type:'world',objects:[{id:'mine',type:'box',position:[0,1,0],size:[1,1,1]}]};
 const startup=createSandboxWorldStartup({readHtml:async()=>'<script id="nodevision-metaworld">'+JSON.stringify(existing)+'</script>',getRuntime:()=>null});
 ok(JSON.stringify(await startup.resolve('authored.html'))===JSON.stringify(existing),'authored definition untouched');
 holdAt=pageReads+2;window.activeCell=cell;await startSession('builtin','SandboxPlay.NodevisionSession.js');
 await until(()=>releaseRead&&document.querySelector('.nv-sandbox-exit'),'startup pending with exit available');
 document.querySelector('.nv-sandbox-exit').click();await until(()=>!getActiveSession(),'exit during startup');
 releaseRead();await tick();ok(!window.VRWorldContext,'cancelled startup cannot resurrect engine');
 ok(!document.querySelector('.nv-sandbox-exit'),'cancelled startup control removed');
 ok(!getActiveSession(),'session wait and handlers cleaned');ok(window.NodevisionState.currentMode==='Default'||window.NodevisionState.currentMode==='HTMLediting','workspace mode restored');
 ok(errors.length===0,'no unhandled failures: '+errors.join('; '));
 document.getElementById('result').textContent='PASS: actual Sandbox Build/Play sessions, normal Game View rendering/walking/spawn/pause, compact HTML save, seed reuse, unsaved drafts, authoring restrictions, authored-world preservation and workspace teardown';
}catch(error){await quitActiveSession();document.getElementById('result').textContent='FAIL: '+error.stack;}
