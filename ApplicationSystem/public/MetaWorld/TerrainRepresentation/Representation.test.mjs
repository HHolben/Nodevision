// Nodevision/ApplicationSystem/public/MetaWorld/TerrainRepresentation/Representation.test.mjs
// Exercises shared occupancy seams, triangle collision, atomic replacement, resource disposal, legacy grid roundtrips and explicit terrain ownership with real Three.js objects.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../../lib/three/three.module.js';
import {surfaceNetSteps} from './SurfaceNets.mjs';
import {drainSteps} from '../ProceduralVoxelWorld/ProgressiveTerrain.mjs';
import {voxelIndex} from '../ProceduralVoxelWorld/VoxelCoordinates.mjs';
import {createProceduralVoxelWorld} from '../ProceduralVoxelWorld/ProceduralVoxelWorldRuntime.mjs';
import {voxelMaterialOptions} from '../ProceduralVoxelWorld/VoxelMaterialTestFixtures.mjs';
import {createTerrainSurfaceMesh,createTerrainSurfaceDefinition,createTerrainSurfaceColliderRef} from '../../PanelInstances/ViewPanels/GameViewDependencies/TerrainTool/terrainSurfaceMesh.mjs';
import {installTerrainRepresentation} from './Authoring.mjs';
const definition={type:'procedural-voxel-world',id:'terrain',position:[0,0,0],size:[16,16,16],voxelSize:.25,generator:{id:'nodevision-terrain-v1',version:1,seed:42},chunks:{voxelsPerAxis:32,loadRadius:1},generation:{vegetation:false,water:false,caves:false}};
function extract(cell,sample){const data=new Uint8Array(32768);for(let z=0;z<32;z++)for(let y=0;y<32;y++)for(let x=0;x<32;x++)data[voxelIndex(x,y,z)]=sample(x+cell[0]*32,y+cell[1]*32,z+cell[2]*32);return drainSteps(surfaceNetSteps(data,cell,sample));}
test('surface net shares exact positions and normals at chunk seams and retains cavities and liquids',()=>{
  const sample=(x,y,z)=>y>=0&&y<8+Math.floor(x/8)&&z>=0&&z<64&&x>=0&&x<64?((y>2&&y<5&&z>12&&z<18)?0:1):0;
  const a=extract([0,0,0],sample),b=extract([1,0,0],sample),seam=r=>new Map(Array.from({length:r.positions.length/3},(_,i)=>[r.positions.slice(i*3,i*3+3),r.normals.slice(i*3,i*3+3)]).filter(([p])=>p[0]>=7.875&&p[0]<=8.125).map(([p,n])=>[p.join(','),n]));
  const left=seam(a),right=seam({...b,positions:b.positions.map((v,i)=>i%3===0?v+8:v)});assert.ok(left.size>30);assert.deepEqual(left,right);
  assert.ok(a.positions.some((v,i)=>i%3===1&&v>0.5&&v<1.5),'cavity surfaces retained');
  const water=extract([0,0,0],(x,y,z)=>x>=0&&x<32&&z>=0&&z<32&&y>=0&&y<6?(y<3?1:5):0);
  assert.ok(water.groups.some(g=>g.materialIndex===4));assert.ok(water.groups.some(g=>g.materialIndex===0));
  assert.ok(a.positions.some(v=>v%0.25!==0),'surface is not cubic voxel faces');
});
test('runtime swaps only owned geometry atomically, shares data/materials, and disposes every replaced buffer',async()=>{
  const colliders=[],root=createProceduralVoxelWorld(THREE,definition,colliders,voxelMaterialOptions),r=root.userData.terrainRuntime;await r.ready;
  for(let i=0;i<35;i++)r.update(new THREE.Vector3(4,12,4));
  const generator=r.generator,materials=r.materials,collider=colliders[0],old=[...root.children];let released=0;
  for(const mesh of old)mesh.geometry.addEventListener('dispose',()=>released++);
  const first=r.setRepresentation('polygonal');assert.ok(old.every(m=>m.parent===root&&m.visible));await first;
  assert.equal(released,old.length);assert.equal(r.generator,generator);assert.equal(r.materials,materials);assert.equal(colliders[0],collider);
  const ray=new THREE.Raycaster(new THREE.Vector3(4,30,4),new THREE.Vector3(0,-1,0)),hits=[];root.raycast(ray,hits);hits.sort((a,b)=>a.distance-b.distance);
  assert.ok(hits.length);assert.ok(Math.abs(collider.sampleGroundY(4,4)-hits[0].point.y)<1e-6);
  assert.equal(r.serialize().representation,'polygonal');assert.deepEqual(r.serialize().generator,definition.generator);
  for(let i=0;i<4;i++){await r.setRepresentation(i%2?'polygonal':'voxel');assert.equal(colliders.length,1);assert.equal(root.children.length,[...r.manager.loaded.values()].filter(e=>e.mesh).length);}
  r.dispose();assert.equal(root.children.length,0);assert.equal(colliders.length,0);
});
test('legacy grid keeps its original geometry/colors and coordinates through save and switching',async()=>{
  const mesh=createTerrainSurfaceMesh(THREE,{columns:2,rows:2,tileSize:1,heights:[0,1,2,1,2,3,2,3,4],isSolid:true,position:{x:10,y:2,z:20}}),r=mesh.userData.terrainRuntime,original=mesh.geometry;
  await r.ready;assert.equal(r.representation,'polygonal');const collider=createTerrainSurfaceColliderRef(THREE,mesh);
  assert.equal(collider.sampleGroundY(10,20),4);await r.setRepresentation('voxel');assert.equal(collider.sampleGroundY(10.25,20.25),4.75);
  const def=createTerrainSurfaceDefinition(mesh);assert.equal(def.representation,'voxel');assert.deepEqual(def.position,[10,2,20]);assert.deepEqual(def.heights,[0,1,2,1,2,3,2,3,4]);
  await r.setRepresentation('polygonal');assert.equal(mesh.geometry,original);assert.equal(collider.sampleGroundY(10,20),4);r.dispose();mesh.geometry.dispose();mesh.material.dispose();
});
test('bridge rejects linked objects and records history before terrain commit without changing neighbors',async()=>{
  const root=createProceduralVoxelWorld(THREE,definition,[],voxelMaterialOptions),r=root.userData.terrainRuntime;await r.ready;
  const linked=new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshBasicMaterial());linked.position.set(7,8,9);linked.userData.modelRuntime={source:'/Notebook/model.stl'};
  const entries=[{id:'terrain',def:structuredClone(definition),object3d:root},{id:'linked',def:{type:'model',id:'linked'},object3d:linked}],history=[],changed=[];
  const bridge={recordHistory:()=>history.push(r.serialize().representation??'voxel')};installTerrainRepresentation(bridge,{layerEntries:entries,changed:id=>changed.push(id)});
  assert.equal(bridge.getTerrainRepresentations().length,1);await assert.rejects(()=>bridge.setTerrainRepresentation('linked','polygonal'));
  await bridge.setTerrainRepresentation('terrain','polygonal');assert.deepEqual(history,['voxel']);assert.deepEqual(changed,['terrain']);assert.equal(entries[1].object3d,linked);assert.deepEqual(linked.position.toArray(),[7,8,9]);
  assert.equal(entries[0].def.representation,'polygonal');r.dispose();linked.geometry.dispose();linked.material.dispose();
});

test('rapid requests and disposal cannot publish stale replacement geometry',async()=>{
  const root=createProceduralVoxelWorld(THREE,definition,[],voxelMaterialOptions),r=root.userData.terrainRuntime;await r.ready;
  for(let i=0;i<20;i++)r.update(new THREE.Vector3(4,12,4));
  const first=r.setRepresentation('polygonal'),second=r.setRepresentation('voxel');await Promise.all([first,second]);
  assert.equal(r.representation,'voxel');assert.ok(root.children.every(c=>c.visible));
  const pending=r.setRepresentation('polygonal');await new Promise(resolve=>setTimeout(resolve,0));r.dispose();assert.equal(await pending,false);assert.equal(root.children.length,0);
});

test('a feature beginning exactly on a chunk edge includes its negative boundary faces',()=>{
  const r=extract([1,0,0],(x,y,z)=>x>=32&&x<36&&y>=10&&y<14&&z>=10&&z<14?6:0);
  let negative=0;for(let i=0;i<r.indices.length;i+=3){const points=r.indices.slice(i,i+3).map(j=>new THREE.Vector3(...r.positions.slice(j*3,j*3+3)));const normal=points[1].clone().sub(points[0]).cross(points[2].clone().sub(points[0]));if(normal.x<0)negative++;}
  assert.ok(negative>0,'negative face belongs to the occupied chunk even when its neighbor is not streamed');
});

test('closed surfaces crossing a chunk boundary have exactly two triangles per shared edge',()=>{
  const sample=(x,y,z)=>x>=30&&x<36&&y>=10&&y<14&&z>=10&&z<14?1:0,edges=new Map();
  for(const cx of [0,1]){const r=extract([cx,0,0],sample),point=i=>r.positions.slice(i*3,i*3+3).map((v,a)=>a===0?v+cx*8:v).join(',');
    for(let i=0;i<r.indices.length;i+=3)for(const [a,b] of [[0,1],[1,2],[2,0]]){const key=[point(r.indices[i+a]),point(r.indices[i+b])].sort().join('|');edges.set(key,(edges.get(key)||0)+1);}
  }
  assert.ok(edges.size>100);assert.ok([...edges.values()].every(n=>n===2));
});
