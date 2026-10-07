// Nodevision/scripts/procedural-world-browser.mjs
// This harness exercises procedural terrain through the real Game View loader, renderer, movement sampler, layer history, and HTML save path.
import * as THREE from '/lib/three/three.module.js';
import { loadWorldFromFile } from '/PanelInstances/ViewPanels/GameViewDependencies/worldLoading.mjs';
import { serializeMesh, saveCurrentWorldFile } from '/PanelInstances/ViewPanels/GameViewDependencies/worldSave.mjs';
import { getActiveMetaWorldLayerBridge } from '/MetaWorld/MetaWorldLayerState.mjs';
import { installTerrainGroundAbility } from '/PanelInstances/ViewPanels/GameViewDependencies/Abilities/MovementAbilities/TerrainGroundAbility.mjs';
import { applyDirectionalMovement, applyGroundMovement } from '/PanelInstances/ViewPanels/GameViewDependencies/movementSteps.mjs';
import { createCollisionChecker } from '/PanelInstances/ViewPanels/GameViewDependencies/collisionCheck.mjs';
import { checkVoxelMaterialRendering } from './voxel-material-render-browser.mjs';
const ok=(v,m)=>{if(!v)throw Error(m);};
try {
  window.NodevisionState={currentMode:'Virtual World Editing'};
  window.alert=m=>{throw Error(m);};
  const panel=document.getElementById('editor'), scene=new THREE.Scene(), camera=new THREE.PerspectiveCamera(75,1.6,0.1,1000);
  const state={currentWorldPath:'page.html'}, movementState={playerMode:'creative',playerHeight:1.75,environment:{},isGrounded:true};
  const context=window.VRWorldContext={THREE,scene,camera,panel,state,movementState,objects:[],colliders:[],lights:[],portals:[],collisionActions:[],useTargets:[],spawnPoints:[],waterVolumes:[],measurementVisuals:[],controls:{getObject:()=>camera}};
  const terrain={id:'terrain',type:'procedural-voxel-world',position:[-500,0,-500],size:[1000,128,1000],voxelSize:0.25,generator:{id:'nodevision-terrain-v1',version:1,seed:123456},chunks:{voxelsPerAxis:32,loadRadius:8}};
  const box={id:'authored-box',type:'box',position:[2,30,2],size:[1,1,1],color:'#ff0000',isSolid:true};
  let definition={name:'Procedural terrain',type:'world',worldType:'NodevisionMetaWorld',spawnPosition:{x:0,y:1.75,z:0},metadata:{objectGroundOnly:true},objects:[terrain,box]}, savedHtml='';
  const originalFetch=window.fetch;
  window.fetch=async(url,options)=>{
    if(url==='/api/load-world')return {ok:true,json:async()=>({worldDefinition:structuredClone(definition)})};
    if(url==='/Notebook/page.html')return {ok:true,text:async()=>'<html><body><h1>Keep me</h1></body></html>'};
    if(url==='/api/save'){savedHtml=JSON.parse(options.body).content;return {ok:true,json:async()=>({success:true})};}
    return originalFetch(url,options);
  };
  const loadStart=performance.now();
  await loadWorldFromFile('page.html',state,THREE);
  let root=context.objects.find(o=>o.userData.proceduralVoxelRuntime);
  ok(root,'loader creates procedural terrain');
  let runtime=root.userData.proceduralVoxelRuntime;
  ok(await runtime.ready,"canonical terrain materials loaded");
  ok(camera.position.y>10,'spawn lifted onto terrain');
  const start=performance.now(),initialReadyMs=start-loadStart;
  while(runtime.stats.queued)runtime.update(camera.position);
  const report={...runtime.stats,initialReadyMs,completeLoadMs:performance.now()-loadStart,totalLoadMs:performance.now()-start,meshes:root.children.length,objects:context.objects.length,colliders:context.colliders.length};
  report.materialGroups=root.children.reduce((sum,m)=>sum+m.geometry.groups.length,0);
  report.maxChunkGroups=Math.max(...root.children.map(m=>m.geometry.groups.length));report.pooledMaterials=runtime.materials.length;
  report.geometryBytes=root.children.reduce((sum,mesh)=>sum+Object.values(mesh.geometry.attributes).reduce((n,a)=>n+a.array.byteLength,0)+(mesh.geometry.index?.array.byteLength||0),0);
  ok(runtime.stats.loaded>0&&runtime.stats.loaded<=289*Math.ceil(runtime.generator.maxSolidHeight/32),'local vertical ranges stay bounded');
  ok(context.objects.some(o=>o.userData.metaWorldLayerId==='authored-box'),'ordinary object coexists');
  const collider=root.userData.colliderRef;
  const groundCtx={api:{},colliders:context.colliders,movementState,groundLevel:0,playerRadius:0.35,stepHeight:0.5};
  installTerrainGroundAbility(groundCtx);
  const collision=createCollisionChecker({colliders:context.colliders,movementState,playerRadius:0.35});
  movementState.activeExpressionTerrainColliderId='terrain';
  context.controls.getDirection=direction=>direction.set(1,0,0);
  movementState.velocityY=0;
  const walkStart=camera.position.x,walkTarget=walkStart+150;
  let detourSign=1;
  for(let i=0;i<1800&&camera.position.x<walkTarget;i++){
    // Walk around solid trunks instead of assuming the seeded landscape is an empty corridor.
    const blocked=collision(camera.position.clone().add(new THREE.Vector3(.25,0,0)));
    if(blocked&&collision(camera.position.clone().add(new THREE.Vector3(0,0,.25*detourSign))))detourSign=-detourSign;
    context.controls.getDirection=direction=>direction.set(blocked?0:1,0,blocked?detourSign:0);
    applyDirectionalMovement({THREE,controls:context.controls,movementState,inputState:{moveForward:true},
      forward:new THREE.Vector3(),right:new THREE.Vector3(),up:new THREE.Vector3(0,1,0),speed:0.25,
      crawling:false,crouching:false,wouldCollide:collision,stepHeight:0.5});
    const groundLevel=groundCtx.api.sampleExpressionTerrainGroundLevel(camera.position);
    applyGroundMovement({controls:context.controls,inputState:{},movementState,gravity:0.01,jumpSpeed:0.2,
      crouching:false,groundLevel,wouldCollide:collision});
    ok(Number.isFinite(camera.position.y)&&movementState.isGrounded,'movement stays grounded');runtime.update(camera.position);
  }
  ok(Math.abs(camera.position.x-walkTarget)<0.01,'actual movement traverses 150 meters: '+camera.position.toArray().join(','));
  ok(!runtime.manager.loaded.has('62,2,62'),'distant original chunk unloaded');
  ok(collision(new THREE.Vector3(501,30,0)),'finite boundary blocks escape');
  const fingerprint=Array.from(runtime.generator.generateChunk(62,2,62)).join('');
  camera.position.x=0;camera.position.z=0;runtime.update(camera.position);while(runtime.stats.queued)runtime.update(camera.position);
  ok(Array.from(runtime.generator.generateChunk(62,2,62)).join('')===fingerprint,'return reproduces terrain');
  scene.add(new THREE.HemisphereLight(0xffffff,0x666666,2));
  const renderer=new THREE.WebGLRenderer();renderer.setSize(640,400);panel.appendChild(renderer.domElement);
  camera.position.y=35;camera.lookAt(0,15,-15);renderer.render(scene,camera);
  ok(renderer.info.render.triangles>0,'terrain renders real triangles');report.renderTriangles=renderer.info.render.triangles;
  const ray=new THREE.Raycaster(new THREE.Vector3(0,100,0),new THREE.Vector3(0,-1,0));
  const hits=ray.intersectObject(root,false);ok(hits.length&&hits[0].object.userData.proceduralTerrainId==='terrain','nonrecursive picking identifies terrain chunk');
  ok(serializeMesh(root.children[0])===null,'runtime chunks cannot serialize');
  await saveCurrentWorldFile({state,movementState,objects:context.objects,lights:[]});
  const saved=JSON.parse(new DOMParser().parseFromString(savedHtml,'text/html').querySelector('script').textContent);
  ok(savedHtml.includes('Keep me'),'save preserves page content');
  ok(saved.objects.filter(o=>o.type==='procedural-voxel-world').length===1,'save retains one terrain');
  ok(saved.objects.length<5,'save excludes all chunks');ok(saved.objects.find(o=>o.id==='authored-box').position.join(',')==='2,30,2','ordinary authored position survives save');ok(saved.objects.find(o=>o.id==='terrain').generator.seed===123456,'save preserves seed');
  const bridge=getActiveMetaWorldLayerBridge();bridge.removeObjectLayer('terrain');
  ok(runtime.stats.loaded===0&&!context.colliders.includes(collider),'layer deletion releases chunks and collider');
  bridge.undo();root=context.objects.find(o=>o.userData.proceduralVoxelRuntime);ok(root,'undo recreates terrain');
  bridge.redo();ok(!context.objects.some(o=>o.userData.proceduralVoxelRuntime),'redo deletes terrain');bridge.undo();
  definition=saved;await loadWorldFromFile('page.html',state,THREE);
  root=context.objects.find(o=>o.userData.proceduralVoxelRuntime);runtime=root.userData.proceduralVoxelRuntime;
  ok(Array.from(runtime.generator.generateChunk(62,2,62)).join('')===fingerprint,'saved world reload is deterministic');
  definition={name:'Ordinary',type:'world',objects:[box,{type:'voxel-pattern',id:'voxel-pattern-test',position:[0,0,0],pattern:{counts:[2,1,2]},voxel:{type:'box',size:[0.25,0.25,0.25]}}]};
  await loadWorldFromFile('page.html',state,THREE);ok(runtime.stats.loaded===0,'world replacement disposes runtime');
  ok(context.objects.filter(o=>o.userData.isVoxel).length===4,'authored pattern still expands');
  await saveCurrentWorldFile({state,movementState,objects:context.objects,lights:[]});
  const ordinary=JSON.parse(new DOMParser().parseFromString(savedHtml,'text/html').querySelector('script').textContent);
  ok(ordinary.objects.some(o=>o.type==='voxel-pattern'),'authored voxels still compact');
  ok(!ordinary.objects.some(o=>o.type==='procedural-voxel-world'),'ordinary save has no procedural state');
  await checkVoxelMaterialRendering(THREE,renderer);
  renderer.dispose();window.proceduralReport=report;
  document.getElementById('result').textContent='PASS: procedural loader, render, ground movement, boundaries, streaming, raycasting, save, history, disposal, ordinary worlds and voxel patterns\n'+JSON.stringify(report,null,2);
}catch(error){document.getElementById('result').textContent='FAIL: '+error.stack;}
