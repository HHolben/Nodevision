// Nodevision/scripts/terrain-representation-browser.mjs
// Exercises live terrain switching alongside actual GOX, STL, glTF and GLB imports, editor history, linked-resource identity and HTML persistence in Chromium.
import * as THREE from '/lib/three/three.module.js';
import {loadWorldFromFile} from '/PanelInstances/ViewPanels/GameViewDependencies/worldLoading.mjs';
import {saveCurrentWorldFile} from '/PanelInstances/ViewPanels/GameViewDependencies/worldSave.mjs';
import {getActiveMetaWorldLayerBridge} from '/MetaWorld/MetaWorldLayerState.mjs';
import {encodeGox} from '/Voxels/GoxCodec.mjs';
import {newModel,setVoxel} from '/Voxels/VoxelModel.mjs';
import {terrainRepresentationCommand} from '/MetaWorld/TerrainRepresentation/Command.mjs';
import {initToolbarWidget} from '/ToolbarJSONfiles/terrainRepresentationWidget.mjs';
const check=(v,m)=>{if(!v)throw Error(m);};
try{
  window.NodevisionState={currentMode:'Virtual World Editing'};window.alert=m=>{throw Error(m);};
  const panel=document.getElementById('editor'),scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(60,4/3,.1,1000),state={currentWorldPath:'terrain.html'},movementState={playerMode:'creative',playerHeight:1.75,environment:{time:1234}};
  const context=window.VRWorldContext={THREE,scene,camera,panel,state,movementState,objects:[],colliders:[],lights:[],portals:[],collisionActions:[],useTargets:[],spawnPoints:[],waterVolumes:[],measurementVisuals:[],controls:{getObject:()=>camera}};
  let definition={worldType:'NodevisionMetaWorld',type:'world',objects:[{type:'procedural-voxel-world',id:'terrain',position:[0,0,0],size:[16,16,16],voxelSize:.25,generator:{id:'nodevision-terrain-v1',version:1,seed:42},chunks:{voxelsPerAxis:32,loadRadius:1},generation:{vegetation:false,water:false,caves:false}},{type:'terrain-surface',id:'grid',position:[30,0,0],columns:2,rows:2,tileSize:1,heights:[0,1,2,1,2,3,2,3,4],isSolid:true}]},saved='';
  const model=newModel();setVoxel(model.layers[0],[0,0,0],[200,40,80,255]);
  const gltf={asset:{version:'2.0'},scene:0,scenes:[{nodes:[0]}],nodes:[{mesh:0}],meshes:[{primitives:[{attributes:{POSITION:0}}]}],buffers:[{byteLength:36,uri:'data:application/octet-stream;base64,'+btoa(String.fromCharCode(...new Uint8Array(new Float32Array([0,0,0,1,0,0,0,1,0]).buffer)))}],bufferViews:[{buffer:0,byteOffset:0,byteLength:36}],accessors:[{bufferView:0,componentType:5126,count:3,type:'VEC3',min:[0,0,0],max:[1,1,0]}]};
  const json=new TextEncoder().encode(JSON.stringify(gltf)),length=Math.ceil(json.length/4)*4,glb=new Uint8Array(20+length),view=new DataView(glb.buffer);view.setUint32(0,0x46546c67,true);view.setUint32(4,2,true);view.setUint32(8,glb.length,true);view.setUint32(12,length,true);view.setUint32(16,0x4e4f534a,true);glb.fill(32,20);glb.set(json,20);
  const files=new Map([['art.gox',await encodeGox(model)],['art.stl','solid test\nfacet normal 0 0 1\nouter loop\nvertex 0 0 0\nvertex 1 0 0\nvertex 0 1 0\nendloop\nendfacet\nendsolid test'],['art.gltf',JSON.stringify(gltf)],['art.glb',glb]]),reads=new Map(),originalFetch=fetch;
  window.fetch=async(url,options)=>{
    if(url instanceof Request&&new URL(url.url).origin===location.origin)url=new URL(url.url).pathname;
    if(url==='/api/load-world')return {ok:true,json:async()=>({worldDefinition:structuredClone(definition)})};
    if(url==='/Notebook/terrain.html')return {ok:true,text:async()=>'<html><body>Keep the page</body></html>'};
    if(url==='/api/save'){saved=JSON.parse(options.body).content;return {ok:true,json:async()=>({success:true})};}
    const name=String(url).replace('/Notebook/','');if(files.has(name)){reads.set(name,(reads.get(name)||0)+1);return new Response(files.get(name));}return originalFetch(url,options);
  };
  await loadWorldFromFile('terrain.html',state,THREE);let bridge=getActiveMetaWorldLayerBridge();
  for(const name of [...files.keys()].filter(n=>!n.endsWith('.stl')))await bridge.insertModelAsset({modelFile:name,position:[1,18,2],scale:[.5,.5,.5]});
  const stl=bridge.addObjectFileLayer({objectFile:'art.stl',position:[3,18,2],size:[1,1,1],collider:true});
  const stlMesh=context.objects.find(o=>o.userData.metaWorldLayerId===stl.id);
  for(let i=0;i<200&&!stlMesh.userData.objectFileExtension;i++)await new Promise(r=>setTimeout(r,20));check(stlMesh.userData.objectFileExtension==='stl','native STL loader ready');
  const root=context.objects.find(o=>o.userData.terrainRuntime&&o.userData.nvType==='procedural-voxel-world'),runtime=root.userData.terrainRuntime;await runtime.ready;
  camera.position.set(8,24,28);camera.lookAt(8,0,8);const cameraState=[...camera.position.toArray(),...camera.quaternion.toArray()],environment=JSON.stringify(movementState.environment);
  for(let i=0;i<35;i++)runtime.update(new THREE.Vector3(8,12,8));
  check(runtime.manager.loaded.size>0&&root.children.length>0,'terrain chunks actually rendered');
  const imports=context.objects.filter(o=>o.userData.modelRuntime||o===stlMesh),identities=imports.map(o=>{const geometry=[];o.traverse(c=>{if(c.geometry)geometry.push(c.geometry.uuid);});return {object:o,position:o.position.toArray(),geometry};}),readCounts=JSON.stringify([...reads]),colliderCount=context.colliders.length;
  const renderer=new THREE.WebGLRenderer();renderer.setSize(640,480);panel.append(renderer.domElement);scene.add(new THREE.HemisphereLight(0xffffff,0x999999,3));
  const samples=[];for(const mode of ['polygonal','voxel','polygonal','voxel','polygonal']){
    const start=performance.now();await terrainRepresentationCommand([mode,'terrain']);renderer.render(scene,camera);samples.push({mode,ms:performance.now()-start,geometries:renderer.info.memory.geometries,chunks:runtime.manager.loaded.size});
    check(runtime.representation===mode,'selected mode active');check(context.colliders.length===colliderCount,'no duplicate colliders');check(JSON.stringify([...reads])===readCounts,'linked sources never reloaded');
    for(const item of identities){check(context.objects.includes(item.object),'same linked object');check(JSON.stringify(item.object.position.toArray())===JSON.stringify(item.position),'linked transform retained');const geometry=[];item.object.traverse(c=>{if(c.geometry)geometry.push(c.geometry.uuid);});check(JSON.stringify(geometry)===JSON.stringify(item.geometry),'native linked geometry unchanged');}
    check(JSON.stringify([...camera.position.toArray(),...camera.quaternion.toArray()])===JSON.stringify(cameraState),'camera/player retained');check(JSON.stringify(movementState.environment)===environment,'environment retained');
  }
  await terrainRepresentationCommand(['voxel','grid']);const grid=context.objects.find(o=>o.userData.metaWorldLayerId==='grid');check(grid.userData.terrainRuntime.representation==='voxel','legacy polygonal to voxel');
  bridge.undo();let restoredGrid=context.objects.find(o=>o.userData.metaWorldLayerId==='grid');await restoredGrid.userData.terrainRuntime.ready;check(restoredGrid.userData.terrainRuntime.representation==='polygonal','grid undo');bridge.redo();restoredGrid=context.objects.find(o=>o.userData.metaWorldLayerId==='grid');await restoredGrid.userData.terrainRuntime.ready;check(restoredGrid.userData.terrainRuntime.representation==='voxel','grid redo');
  const host=document.createElement('div');panel.append(host);initToolbarWidget(host);await new Promise(r=>setTimeout(r,0));check(host.querySelector('[aria-label="Terrain representation"]').value==='polygonal','View control reflects selected terrain');
  await saveCurrentWorldFile({state,movementState,objects:context.objects,lights:[]});check(saved.includes('Keep the page'),'host HTML preserved');definition=JSON.parse(new DOMParser().parseFromString(saved,'text/html').querySelector('script').textContent);
  check(definition.objects.find(o=>o.id==='terrain').representation==='polygonal','procedural mode saved');check(definition.objects.find(o=>o.id==='grid').representation==='voxel','grid mode saved');
  await loadWorldFromFile('terrain.html',state,THREE);bridge=getActiveMetaWorldLayerBridge();for(const o of context.objects)await o.userData.terrainRuntime?.ready;
  check(bridge.getTerrainRepresentations().find(t=>t.id==='terrain').representation==='polygonal','procedural mode reopened');check(bridge.getTerrainRepresentations().find(t=>t.id==='grid').representation==='voxel','grid mode reopened');
  await bridge.setTerrainRepresentation('terrain','voxel');bridge.undo();check(getActiveMetaWorldLayerBridge().getTerrainRepresentations().find(t=>t.id==='terrain').representation==='polygonal','undo restores representation');getActiveMetaWorldLayerBridge().redo();check(getActiveMetaWorldLayerBridge().getTerrainRepresentations().find(t=>t.id==='terrain').representation==='voxel','redo restores representation');
  document.getElementById('result').textContent='PASS: native GOX/STL/glTF/GLB independence, atomic terrain switching, camera/environment, View control, HTML save/reopen, legacy grid, undo/redo\n'+JSON.stringify(samples,null,2);
}catch(error){document.getElementById('result').textContent='FAIL: '+error.stack;}
