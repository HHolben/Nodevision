// Nodevision/ApplicationSystem/public/MetaWorld/ProceduralVoxelWorld/VoxelGreedyMesher.test.mjs
// These regressions expand merged quads back into oriented unit faces to prove equivalence with the original mesher across solids, liquids, materials, caves and neighboring chunks.
import test from 'node:test';
import assert from 'node:assert/strict';
import { meshVoxelChunk } from './VoxelChunkMesher.mjs';
import { meshGreedyVoxelChunk } from './VoxelGreedyMesher.mjs';
import { VOXEL_MATERIAL_IDS } from './VoxelMaterialIds.mjs';
import { createVoxelGenerator } from './VoxelTerrainGenerator.mjs';
import { AEGEAN_DEFAULTS } from '../Aegean/AegeanDefinition.mjs';
function unitFaces(mesh){
  const faces=[];
  assert.equal(mesh.uvs.length, mesh.positions.length / 3 * 2);
  for (let vertex=0;vertex<mesh.positions.length/3;vertex+=4) {
    const uv=Array.from({length:4},(_,i)=>mesh.uvs.slice((vertex+i)*2,(vertex+i)*2+2));
    const width=Math.max(...uv.map(p=>p[0]))-Math.min(...uv.map(p=>p[0]));
    const height=Math.max(...uv.map(p=>p[1]))-Math.min(...uv.map(p=>p[1]));
    const a=mesh.positions.slice(vertex*3,vertex*3+3), b=mesh.positions.slice((vertex+1)*3,(vertex+1)*3+3), d=mesh.positions.slice((vertex+3)*3,(vertex+3)*3+3);
    const area=Math.hypot(...b.map((n,i)=>n-a[i]))*Math.hypot(...d.map((n,i)=>n-a[i]));
    assert.ok(Math.abs(width*height*.25**2-area)<1e-8, 'texture scale remains constant across merged faces');
  }
  for(let vertex=0;vertex<mesh.positions.length/3;vertex+=4){
    const normal=mesh.normals.slice(vertex*3,vertex*3+3),axis=normal.findIndex(n=>n!==0),u=(axis+1)%3,v=(axis+2)%3;
    const points=Array.from({length:4},(_,i)=>mesh.positions.slice((vertex+i)*3,(vertex+i)*3+3).map(n=>n*4));
    const minU=Math.min(...points.map(p=>p[u])),maxU=Math.max(...points.map(p=>p[u])),minV=Math.min(...points.map(p=>p[v])),maxV=Math.max(...points.map(p=>p[v]));
    for(let j=minV;j<maxV;j++)for(let i=minU;i<maxU;i++)faces.push([axis,normal[axis],points[0][axis],i,j,mesh.materials[vertex]].join(','));
  }
  for(let i=0;i<mesh.indices.length;i+=3){
    const [a,b,c]=mesh.indices.slice(i,i+3).map(v=>mesh.positions.slice(v*3,v*3+3));
    const ab=b.map((n,j)=>n-a[j]),ac=c.map((n,j)=>n-a[j]),cross=[ab[1]*ac[2]-ab[2]*ac[1],ab[2]*ac[0]-ab[0]*ac[2],ab[0]*ac[1]-ab[1]*ac[0]];
    const n=mesh.normals.slice(mesh.indices[i]*3,mesh.indices[i]*3+3);assert.ok(cross.reduce((sum,value,j)=>sum+value*n[j],0)>0,'outward winding');
  }
  return faces.sort();
}
function equivalent(data,chunk,sample){
  const old=meshVoxelChunk(data,chunk,sample),merged=meshGreedyVoxelChunk(data,chunk,sample);
  assert.deepEqual(unitFaces(merged),unitFaces(old));assert.equal(merged.solidVoxels,old.solidVoxels);
  assert.equal(merged.surfaceFaceCount,old.faceCount);assert.ok(merged.faceCount<=old.faceCount);
  for(const group of merged.groups)for(const index of merged.indices.slice(group.start,group.start+group.count))assert.equal(merged.materials[index],group.materialIndex+1);
  return merged;
}
test('a full chunk merges 6144 faces into six outward quads; internal chunk seams disappear',()=>{
  const data=new Uint8Array(32**3).fill(3);assert.equal(equivalent(data,[0,0,0],()=>0).faceCount,6);
  assert.equal(equivalent(data,[0,0,0],()=>3).faceCount,0);
});
test('mixed canonical liquids, material boundaries and holes retain all visibility rules',()=>{
  const data=new Uint8Array(32**3),shallow=VOXEL_MATERIAL_IDS.indexOf('AegeanShallowWater'),deep=VOXEL_MATERIAL_IDS.indexOf('AegeanDeepWater');
  for(let y=0;y<32;y++)for(let z=0;z<32;z++)for(let x=0;x<32;x++)data[x+32*z+1024*y]=y<5?3:y===5?(x<16?shallow:deep):y===6&&z<5?10:(x%7===0&&z%9===0?8:0);
  equivalent(data,[-2,1,4],(x,y,z)=>(x+y+z)%3===0?5:0);
});
test('actual Aegean chunks preserve surfaces and cross-chunk sampling',()=>{
  const g=createVoxelGenerator({size:[128,80,128],position:[0,0,0],heightLimits:{min:-16,max:64},generator:{seed:123456},environment:{...AEGEAN_DEFAULTS},generation:{caves:true,water:true,vegetation:true}});
  for(const cell of [[0,1,0],[7,2,7],[8,3,7],[9,3,8]])equivalent(g.generateChunk(...cell),cell,g.getVoxel);
});
