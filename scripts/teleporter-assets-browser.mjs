// Nodevision/scripts/teleporter-assets-browser.mjs
// Checks real GOX, glTF, GLB, STL and linked construction loaders against the teleporter's collision ownership and triangle targeting rules.
import * as THREE from '/lib/three/three.module.js';
import {createModelWorldObject} from '/Models/ModelWorldAsset.mjs';
import {createConstruction} from '/MetaWorld/Constructions/ConstructionRuntime.mjs';
import {applyObjectFileGeometry} from '/PanelInstances/ViewPanels/GameViewDependencies/objectFileLoader.mjs';
import {newModel,setVoxel} from '/Voxels/VoxelModel.mjs';
import {encodeGox} from '/Voxels/GoxCodec.mjs';
import {acquireTarget,surfaceHits} from '/PanelInstances/ViewPanels/GameViewDependencies/RaycastingTeleporter/Target.mjs';
import {resolveDestination} from '/PanelInstances/ViewPanels/GameViewDependencies/RaycastingTeleporter/Destination.mjs';
export async function checkTeleporterAssets(check){
 const model=newModel();for(let x=0;x<16;x++)for(let z=0;z<16;z++)setVoxel(model.layers[0],[x,-z-1,0],[200,80,40,255]);
 const vertices=new Float32Array([-2,0,-2,-2,0,2,2,0,2]),gltf={asset:{version:'2.0'},scene:0,scenes:[{nodes:[0]}],nodes:[{mesh:0}],meshes:[{primitives:[{attributes:{POSITION:0}}]}],buffers:[{uri:'data:application/octet-stream;base64,'+btoa(String.fromCharCode(...new Uint8Array(vertices.buffer))),byteLength:36}],bufferViews:[{buffer:0,byteLength:36}],accessors:[{bufferView:0,componentType:5126,count:3,type:'VEC3',min:[-2,0,-2],max:[2,0,2]}]};
 const json=new TextEncoder().encode(JSON.stringify(gltf)),length=Math.ceil(json.length/4)*4,glb=new Uint8Array(20+length),header=new DataView(glb.buffer);header.setUint32(0,0x46546c67,true);header.setUint32(4,2,true);header.setUint32(8,glb.length,true);header.setUint32(12,length,true);header.setUint32(16,0x4e4f534a,true);glb.fill(32,20);glb.set(json,20);
 const construction={schema:'nodevision-construction',version:2,id:'platform',voxelSize:.25,position:[0,0,0],terrainVolumes:[],geometry:{source:'teleporter.gox',position:[0,0,0]}};
 const files=new Map([['teleporter.gox',await encodeGox(model)],['teleporter.gltf',JSON.stringify(gltf)],['teleporter.glb',glb],['teleporter.construction.json',JSON.stringify(construction)]]),originalFetch=window.fetch;
 window.fetch=(url,options)=>{const path=typeof url==='string'?url:url.url,name=path.split('/').pop();return files.has(name)?Promise.resolve(new Response(files.get(name))):originalFetch(url,options);};
 const ray=new THREE.Raycaster(new THREE.Vector3(.5,10,1),new THREE.Vector3(0,-1,0),0,500),ctx={THREE,objects:[],colliders:[],movementState:{playerHeight:1.75},playerRadius:.35,stepHeight:.5,api:{}};
 try{
  for(const extension of ['gox','gltf','glb']){const root=createModelWorldObject({id:extension,modelFile:'teleporter.'+extension});await root.userData.modelRuntime.ready;check(surfaceHits(THREE,ray,root).length>0,extension+' actual geometry intersects');check(!acquireTarget(THREE,ray,[root],[]),extension+' decorative asset stays noncollidable');root.userData.modelRuntime.dispose();}
  const root=createConstruction(THREE,{id:'linked-platform',constructionFile:'teleporter.construction.json'},'world.html',ctx.colliders);await root.userData.constructionRuntime.ready;root.userData.constructionRuntime.setComposed(true);ctx.objects=[root];ray.ray.origin.set(2,10,2);
  const hit=acquireTarget(THREE,ray,ctx.objects,ctx.colliders);check(hit?.root===root&&resolveDestination(ctx,hit).valid,'GOX construction supports safe standing');
  root.children[0].visible=true;check(acquireTarget(THREE,ray,ctx.objects,ctx.colliders).object!==root.children[0],'Selected construction outline is ignored');root.userData.constructionRuntime.dispose();
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshBasicMaterial());mesh.userData.colliderRef={};mesh.userData.placeholderHalfHeight=0;mesh.userData.objectFileFormat='stl';mesh.userData.objectFileText='solid platform\nfacet normal 0 1 0\nouter loop\nvertex -2 0 -2\nvertex -2 0 2\nvertex 2 0 2\nendloop\nendfacet\nfacet normal 0 1 0\nouter loop\nvertex -2 0 -2\nvertex 2 0 2\nvertex 2 0 -2\nendloop\nendfacet\nendsolid platform';
  check(await applyObjectFileGeometry(mesh),'Native STL loader succeeds');ctx.objects=[mesh];ctx.colliders=[mesh.userData.colliderRef];ray.ray.origin.set(0,10,0);const stl=acquireTarget(THREE,ray,ctx.objects,ctx.colliders);check(stl&&resolveDestination(ctx,stl).valid,'Solid STL supports safe standing');mesh.geometry.dispose();mesh.material.dispose();
 }finally{window.fetch=originalFetch;}
}
