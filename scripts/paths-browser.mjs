// Nodevision/scripts/paths-browser.mjs
// This integration test exercises Insert Path against a real streamed voxel world, the existing inspector/history/save pipeline, rendered pixel output, and Sandbox authoring guards.
import * as THREE from '/lib/three/three.module.js';
import { loadWorldFromFile } from '/PanelInstances/ViewPanels/GameViewDependencies/worldLoading.mjs';
import { saveCurrentWorldFile } from '/PanelInstances/ViewPanels/GameViewDependencies/worldSave.mjs';
import { createObjectInspector } from '/PanelInstances/ViewPanels/GameViewDependencies/objectInspector.mjs';
import { getActiveMetaWorldLayerBridge } from '/MetaWorld/MetaWorldLayerState.mjs';
import { acquireWorldViewPermissions } from '/MetaWorld/WorldAuthoringPermissions.mjs';
import insertPath from '/ToolbarCallbacks/insert/insertPath.mjs';
import { installTerrainGroundAbility } from '/PanelInstances/ViewPanels/GameViewDependencies/Abilities/MovementAbilities/TerrainGroundAbility.mjs';
const ok=(v,m)=>{if(!v)throw Error(m);},tick=()=>new Promise(r=>requestAnimationFrame(r));
try {
  window.NodevisionState={currentMode:'Virtual World Editing'};
  const panel=document.getElementById('editor'),scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(55,4/3,.1,500);
  const state={currentWorldPath:'paths.html'},movementState={playerMode:'creative',playerHeight:1.75,environment:{},isGrounded:true};
  const context=window.VRWorldContext={THREE,scene,camera,panel,state,movementState,objects:[],colliders:[],lights:[],portals:[],collisionActions:[],useTargets:[],spawnPoints:[],waterVolumes:[],measurementVisuals:[],controls:{getObject:()=>camera,unlock(){}}};
  const terrain={id:'hills',type:'procedural-voxel-world',position:[0,0,0],size:[32,64,32],voxelSize:.25,generator:{id:'nodevision-terrain-v1',version:1,seed:42},chunks:{voxelsPerAxis:32,loadRadius:2},generation:{water:false,caves:false,vegetation:true}};
  const box={id:'keep-box',type:'box',position:[30,15,30],size:[1,1,1],isSolid:true,color:'#dd3344'};
  let definition={name:'Path world',type:'world',worldType:'NodevisionMetaWorld',spawnPosition:{x:16,y:40,z:16},objects:[terrain,box]},savedHtml='';
  const fetchOriginal=window.fetch;window.fetch=async(url,options)=>{
    if(url==='/api/load-world')return {ok:true,json:async()=>({worldDefinition:structuredClone(definition)})};
    if(url==='/Notebook/paths.html')return {ok:true,text:async()=>'<html><body>Keep page content</body></html>'};
    if(url==='/api/save'){savedHtml=JSON.parse(options.body).content;return {ok:true,json:async()=>({success:true})};}
    return fetchOriginal(url,options);
  };
  await loadWorldFromFile('paths.html',state,THREE);
  let bridge=getActiveMetaWorldLayerBridge(),root=context.objects.find(o=>o.userData.proceduralVoxelRuntime),runtime=root.userData.proceduralVoxelRuntime;await runtime.ready;
  camera.position.set(16,55,36);camera.lookAt(16,0,12);camera.updateMatrixWorld(true);
  for(let i=0;i<100;i++)runtime.update(new THREE.Vector3(16,15,16));
  const renderer=new THREE.WebGLRenderer({preserveDrawingBuffer:true});renderer.setSize(800,600);panel.append(renderer.domElement);panel._vrRenderer=renderer;
  scene.add(new THREE.HemisphereLight(0xffffff,0x888888,2));scene.background=new THREE.Color('#e9edf0');renderer.render(scene,camera);
  context.objectInspector=createObjectInspector({THREE,panel,scene,sceneObjects:context.objects,colliders:context.colliders,portals:context.portals,spawnPoints:context.spawnPoints});
  const canvas=renderer.domElement,paths=()=>context.objects.filter(o=>o.userData.pathRuntime);
  const point=(x,z)=>{const y=runtime.generator.base.getTerrainHeight(Math.floor(x*4),Math.floor(z*4))*.25;return [x,y,z];};
  function eventAt(p,type='pointerdown',detail=1){scene.updateMatrixWorld(true);const v=new THREE.Vector3(...p).project(camera),r=canvas.getBoundingClientRect();canvas.dispatchEvent(new PointerEvent(type,{clientX:r.left+(v.x+1)*r.width/2,clientY:r.top+(1-v.y)*r.height/2,button:0,pointerId:1,detail,bubbles:true,cancelable:true}));}
  const key=key=>window.dispatchEvent(new KeyboardEvent('keydown',{key,bubbles:true,cancelable:true}));
  ok(await insertPath(),'Insert Path opens');eventAt(point(4,8));ok(paths().length===0,'single click is only a draft');eventAt(point(10,8),'pointermove');key('Escape');ok(paths().length===0&&!context.cancelPathDrawing,'Escape cancels without a saved object');
  const {configurePathTool}=await import('/MetaWorld/Paths/PathTool.mjs');configurePathTool({terrainInteraction:'grade',elevationMode:'authored'});
  await insertPath();eventAt(point(4,8));eventAt(point(12,8));eventAt(point(24,8));key('Enter');
  ok(paths().length===1,'Enter commits a three-point path');let mesh=paths()[0],id=mesh.userData.metaWorldLayerId;
  ok(bridge.getPathDefinition(id).controlPoints.length===3,'all vertices persisted');
  ok(document.querySelector('[data-path-properties] input[aria-label="Width (m)"]'),'existing inspector hosts properties');
  bridge.updatePath(id,{controlPoints:[[4,12,8],[12,12,8],[24,12,8]],interpolation:'smooth'});mesh=paths()[0];await mesh.userData.pathRuntime.ready;
  ok(!mesh.userData.pathRuntime.materialError,'canonical gravel material resolves');
  ok(Math.abs(mesh.userData.colliderRef.sampleGroundY(12,8)-12.025)<1e-6,'walking collider matches surface');
  ok(runtime.generator.getTerrainHeight(48,32)===48,'live terrain is graded');
  const ctx={colliders:context.colliders,movementState:{...movementState,objectGroundOnly:true},groundLevel:0,stepHeight:.5,playerRadius:.25,api:{}};
  installTerrainGroundAbility(ctx);ok(Math.abs(ctx.api.sampleExpressionTerrainGroundLevel(new THREE.Vector3(12,13.775,8))-12.025)<1e-6,'existing player movement walks on path');
  const width=document.querySelector('[data-path-properties] input[aria-label="Width (m)"]');width.value=3;width.dispatchEvent(new Event('change'));
  ok(bridge.getPathDefinition(id).width===3,'width property edits');bridge.undo();ok(bridge.getPathDefinition(id).width===2,'undo width');bridge.redo();ok(bridge.getPathDefinition(id).width===3,'redo width');
  const adds=[...document.querySelectorAll('[data-path-properties] button')].filter(b=>b.title==='Insert point on next segment');adds[0].click();ok(bridge.getPathDefinition(id).controlPoints.length===4,'insert point');
  document.querySelector('[data-path-properties] button[title="Remove control point"]').click();ok(bridge.getPathDefinition(id).controlPoints.length===3,'remove point');
  bridge.updatePath(id,{position:[0,1,0],surfaceMaterial:'gravel'});mesh=paths()[0];await mesh.userData.pathRuntime.ready;
  ok(!mesh.userData.pathRuntime.materialError,'canonical gravel resolves');
  ok(Math.abs(mesh.userData.colliderRef.sampleGroundY(12,8)-13.025)<1e-6,'whole-path translation');
  await saveCurrentWorldFile({state,movementState,objects:context.objects,lights:[]});
  const saved=JSON.parse(new DOMParser().parseFromString(savedHtml,'text/html').querySelector('script').textContent),savedPath=saved.objects.find(o=>o.id===id);
  ok(savedPath.surfaceMaterial==='gravel'&&savedPath.controlPoints.length===3&&!savedPath.vertices,'compact authoritative save');ok(savedHtml.includes('Keep page content'),'host HTML retained');
  runtime=context.objects.find(o=>o.userData.proceduralVoxelRuntime).userData.proceduralVoxelRuntime;
  bridge.removeObjectLayer(id);ok(!paths().length&&runtime.generator.getTerrainHeight(48,32)===runtime.generator.base.getTerrainHeight(48,32),'delete removes grading');bridge.undo();ok(paths().length===1,'undo deletion');
  definition=saved;await loadWorldFromFile('paths.html',state,THREE);bridge=getActiveMetaWorldLayerBridge();runtime=context.objects.find(o=>o.userData.proceduralVoxelRuntime).userData.proceduralVoxelRuntime;await runtime.ready;
  ok(bridge.getPathDefinition(id).surfaceMaterial==='gravel'&&runtime.generator.getTerrainHeight(48,32)===52,'reload material and grade');
  bridge.regenerateVoxelWorld('hills',{...terrain,generator:{...terrain.generator,seed:86}});runtime=context.objects.find(o=>o.userData.proceduralVoxelRuntime).userData.proceduralVoxelRuntime;await runtime.ready;
  ok(bridge.getPathDefinition(id).controlPoints[0][1]===12&&runtime.generator.getTerrainHeight(48,32)===52,'authored elevation survives regeneration');
  const follow=bridge.updatePath(null,{controlPoints:[[4,10,16],[24,10,16]],elevationMode:'follow-terrain',width:1});
  let followed=context.objects.find(o=>o.userData.metaWorldLayerId===follow.id).userData.pathRuntime;
  ok(Math.abs(followed.ribbon.samples[0][1]-runtime.generator.base.getTerrainHeight(16,64)*.25)<1e-6,'follow terrain reads original heightfield');
  bridge.regenerateVoxelWorld('hills',{...terrain,generator:{...terrain.generator,seed:93}});runtime=context.objects.find(o=>o.userData.proceduralVoxelRuntime).userData.proceduralVoxelRuntime;await runtime.ready;
  followed=context.objects.find(o=>o.userData.metaWorldLayerId===follow.id).userData.pathRuntime;
  ok(Math.abs(followed.ribbon.samples[0][1]-runtime.generator.base.getTerrainHeight(16,64)*.25)<1e-6,'follow terrain updates after regeneration');
  bridge.removeObjectLayer('hills');ok(followed.warning&&Number.isFinite(followed.ribbon.heightAt(10,16)),'missing terrain retains selectable path geometry with a warning');
  bridge.undo();runtime=context.objects.find(o=>o.userData.proceduralVoxelRuntime).userData.proceduralVoxelRuntime;await runtime.ready;
  bridge.setObjectVisibility(follow.id,false);ok(Number.isNaN(context.objects.find(o=>o.userData.metaWorldLayerId===follow.id).userData.colliderRef.sampleGroundY(10,16)),'hidden paths disable collision');
  bridge.removeObjectLayer(follow.id);
  const release=acquireWorldViewPermissions({authoring:false});ok(await insertPath()===false,'Sandbox Play refuses drawing');ok(bridge.updatePath(id,{width:4})===false,'Sandbox Play refuses API mutation');release();
  for(let i=0;i<100;i++)runtime.update(new THREE.Vector3(16,15,16));
  await insertPath();eventAt(point(4,24));eventAt(point(12,24));eventAt(point(12,24),'pointerdown',2);ok(paths().length===2,'double-click finishes');ok(paths().at(-1).userData.pathRuntime.serialize().controlPoints.length===2,'double-click does not duplicate vertex');
  for(let i=0;i<100;i++)runtime.update(new THREE.Vector3(16,15,16));
  context.objectInspector.hide();camera.position.set(16,55,36);camera.lookAt(16,0,12);scene.add(new THREE.HemisphereLight(0xffffff,0x888888,2));renderer.render(scene,camera);
  const gl=renderer.getContext(),pixels=new Uint8Array(800*600*4);gl.readPixels(0,0,800,600,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
  ok(new Set(pixels).size>8&&renderer.info.render.triangles>100,`nonblank rendered terrain and paths: ${new Set(pixels).size} values, ${renderer.info.render.triangles} triangles`);
  const {createPlayerInventory}=await import('/PanelInstances/ViewPanels/GameViewDependencies/playerInventory.mjs');context.inventory=createPlayerInventory({panel});context.inventory.assignItemToSlot(0,'path');context.inventory.assignItemToSlot(1,'3d-model');
  const {pathToolState,pathCommand}=await import('/MetaWorld/Paths/PathTool.mjs'),{createCursorFamilyProvider}=await import('/CursorFamilies/providers/WorldCursorProvider.mjs');
  window.NodevisionState.currentMode='Build Mode';context.inventory.selectDominantSlot(0);for(let i=0;i<100&&!context.pathDrawing;i++)await tick();ok(context.pathDrawing&&createCursorFamilyProvider().getActiveToolId()==='path','inventory selection activates same Path cursor even when Build mode label differs');
  key('g');for(let i=0;i<100&&!document.querySelector('[data-path-settings]');i++)await tick();const settings=document.querySelector('[data-path-settings]');ok(settings,'G opens native settings');const widthSetting=settings.querySelector('[aria-label="Width (m)"]');widthSetting.value=1;widthSetting.dispatchEvent(new Event('change'));ok(pathToolState().settings.width===1,'settings configure shared tool');[...settings.querySelectorAll('button')].find(b=>b.textContent==='Done').click();
  eventAt(point(4,28));ok(pathToolState().points.length===1,'draft retained in controller');context.inventory.selectDominantSlot(1);ok(!context.pathDrawing&&pathToolState().points.length===1,'switching tools suspends without losing draft');context.inventory.selectDominantSlot(0);for(let i=0;i<100&&!context.pathDrawing;i++)await tick();ok(pathToolState().points.length===1,'reselect restores draft');key('Escape');ok(!context.pathDrawing&&pathToolState().points.length===0,'Escape explicitly discards draft');
  const commanded=await pathCommand(['create',{controlPoints:[[4,12,28],[12,13,28]],width:1,elevationMode:'locally-flat',terrainInteraction:'grade',smoothing:.5,surfaceMaterial:'dirt'}]);const commandMesh=context.objects.find(o=>o.userData.metaWorldLayerId===commanded.id);await commandMesh.userData.pathRuntime.ready;ok(!commandMesh.userData.pathRuntime.materialError,'dirt uses existing soil material');
  await pathCommand(['extend',{id:commanded.id}]);ok(pathToolState().points.length===2,'extend starts with existing world-space points');eventAt(point(24,28));key('Enter');ok(bridge.getPathDefinition(commanded.id).controlPoints.length===3,'extending updates the same path');bridge.undo();ok(bridge.getPathDefinition(commanded.id).controlPoints.length===2,'extension is one undo transaction');bridge.redo();
  await pathCommand(['update',{id:commanded.id,surfaceMaterial:'paved'}]);const paved=context.objects.find(o=>o.userData.metaWorldLayerId===commanded.id);await paved.userData.pathRuntime.ready;ok(!paved.userData.pathRuntime.materialError,'paved resolves an existing solid surface material');await pathCommand(['delete',{id:commanded.id}]);ok(!bridge.getPathDefinition(commanded.id),'command deletion uses normal layer history');context.inventory.dispose();window.NodevisionState.currentMode='Virtual World Editing';
  window.pathFixture={context,renderer,bridge,camera,point,insertPath,
    async settle(){await Promise.all(context.objects.map(o=>(o.userData.proceduralVoxelRuntime||o.userData.pathRuntime)?.ready));for(let i=0;i<100;i++)context.objects.forEach(o=>o.userData.proceduralVoxelRuntime?.update(new THREE.Vector3(16,15,16)));context.objectInspector.hide();renderer.render(scene,camera);},
    screenPoint(p){scene.updateMatrixWorld(true);camera.updateMatrixWorld(true);const v=new THREE.Vector3(...p).project(camera),r=canvas.getBoundingClientRect();return {x:r.left+(v.x+1)*r.width/2,y:r.top+(1-v.y)*r.height/2};},
    resize(w,h){panel.style.width=w+'px';panel.style.height=h+'px';renderer.setSize(w,h);camera.aspect=w/h;const fit=Math.max(1,1.33/camera.aspect);camera.position.set(16,55*fit,12+24*fit);camera.lookAt(16,0,12);camera.updateProjectionMatrix();renderer.render(scene,camera);},
    render(){renderer.render(scene,camera);}};
  document.getElementById('result').textContent='PASS: Path creation, cancel, Enter/double-click, properties, add/remove points, materials, walking collision, grading, undo/redo, compact HTML save/load, regeneration, Sandbox Play guards, and rendered pixels';
}catch(error){document.getElementById('result').textContent='FAIL: '+error.stack;}
