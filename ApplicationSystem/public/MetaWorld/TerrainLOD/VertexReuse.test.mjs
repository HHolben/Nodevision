// Nodevision/ApplicationSystem/public/MetaWorld/TerrainLOD/VertexReuse.test.mjs
// Verify the profiling-only candidate: expand indexed coarse geometry back into its original ordered attribute stream to verify exact triangles, skirts, coverage, colors and independent section handoff after vertex reuse. Custom shaders retain original vertex identity.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../../lib/three/three.module.js';
import {createTileMesh} from '../../../../scripts/terrain-e1-vertex-tile.mjs';
import {heightfieldSteps} from './Heightfield.mjs';
import {drainSteps} from '../ProceduralVoxelWorld/ProgressiveTerrain.mjs';
import {colorBatches} from '../Rendering/ColorBatches.mjs';
const definition={size:[128,32,128],generation:{caves:false,water:true}};
const generator={terrainSampler:{kind:'procedural',sample:(x,z)=>({covered:!(x>20&&x<24&&z>20&&z<24),elevation:4+x*.02+Math.sin(z*.1)})},getWaterTop:()=>24,getRenderVoxel:(x,y,z)=>x<64?1:2};
function expected(tile,materials,ready){
 const palette=colorBatches(materials,new Set(tile.sections.flatMap(s=>s.faces.map(f=>f.material-1))),true),groups=new Map();
 for(const section of tile.sections)if(!ready(section.x,section.z))for(const face of section.faces){
  const source=face.material-1,batch=palette.mapping.get(source),color=batch.colored?materials[source].color:null;
  if(!groups.has(batch.index))groups.set(batch.index,[]);
  for(const i of [0,1,2,0,2,3]){const v=face.vertices[i];groups.get(batch.index).push(...v.p,...v.n,v.p[0],v.p[2],color?.r??1,color?.g??1,color?.b??1);}
 }
 palette.dispose();return [...groups.values()].flat().map(Math.fround);
}
function expanded(geometry){
 const attrs=['position','normal','uv','color'];return Array.from(geometry.index.array).flatMap(i=>attrs.flatMap(name=>Array.from(geometry.attributes[name].array.slice(i*geometry.attributes[name].itemSize,(i+1)*geometry.attributes[name].itemSize))));
}
test('near and far coarse vertices preserve every ordered attribute through signed ownership changes',()=>{
 for(const level of [1,2])for(const signed of [false,true]){
  const def=signed?{...definition,worldExtent:{mode:'infinite'}}:definition;
  const tile=drainSteps(heightfieldSteps(generator,def,signed?-1:0,0,level));
  const materials=[new THREE.MeshStandardMaterial({color:0x123456}),new THREE.MeshStandardMaterial({color:0xabcdef})];
  const mesh=createTileMesh(THREE,tile,materials),originalVertices=tile.sections.reduce((sum,s)=>sum+s.faces.length*4,0);
  assert.ok(mesh.mesh.geometry.attributes.position.count<originalVertices*.75,'substantial attribute reuse');
  for(const ready of [()=>false,x=>x%2===0,()=>true,()=>false]){mesh.mask(ready);assert.deepEqual(expanded(mesh.mesh.geometry),expected(tile,materials,ready));assert.equal(mesh.mesh.visible,mesh.mesh.geometry.index.count>0);}
  const buffers=Object.values(mesh.mesh.geometry.attributes).reduce((sum,a)=>sum+a.array.byteLength,0);assert.ok(mesh.bytes>=buffers+mesh.mesh.geometry.index.array.byteLength,'budget remains conservative');
  mesh.dispose();materials.forEach(m=>m.dispose());
 }
});
test('custom shader hooks preserve per-face vertex identity and resource ownership',()=>{
 const material=new THREE.MeshStandardMaterial();material.onBeforeCompile=()=>{};
 const tile=drainSteps(heightfieldSteps(generator,definition,0,0,2)),mesh=createTileMesh(THREE,tile,[material,material]);
 assert.equal(mesh.mesh.geometry.attributes.position.count,tile.sections.reduce((sum,s)=>sum+s.faces.length*4,0));
 let disposed=0;material.addEventListener('dispose',()=>disposed++);mesh.dispose();assert.equal(disposed,0);material.dispose();
});
