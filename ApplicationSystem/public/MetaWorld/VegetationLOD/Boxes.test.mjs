// Nodevision/ApplicationSystem/public/MetaWorld/VegetationLOD/Boxes.test.mjs
// These tests prove that opaque proxy merging preserves exact sampled occupancy and identity while keeping transparent surfaces and chunk handoff boundaries separate.
import test from 'node:test';
import assert from 'node:assert/strict';
import {mergeProxyBoxes} from './Boxes.mjs';
const cell=(x,y,z,id='tree',chunk='0,0,0',material=1)=>({p:[x,y,z],id,chunk,material});
const opaque={transparent:false,opacity:1},transparent={transparent:true,opacity:.5};
const expand=boxes=>boxes.flatMap(c=>{
 const size=c.size||[2,2,2],out=[];
 for(let y=0;y<size[1];y+=2)for(let z=0;z<size[2];z+=2)for(let x=0;x<size[0];x+=2)out.push([c.p[0]+x,c.p[1]+y,c.p[2]+z,c.id,c.chunk,c.material].join(':'));
 return out;
}).sort();
test('solid blocks and irregular negative-coordinate crowns keep exact occupancy',()=>{
 const cells=[];for(let x=-8;x<8;x+=2)for(let y=0;y<12;y+=2)for(let z=-8;z<8;z+=2)if(x!==0||z!==0||y<4)cells.push(cell(x,y,z));
 const boxes=mergeProxyBoxes(cells,2,[opaque]);assert.ok(boxes.length<cells.length/4);
 assert.deepEqual(expand(boxes),expand(cells));assert.equal(boxes.reduce((n,b)=>n+b.sourceCount,0),cells.length);
 assert.deepEqual(mergeProxyBoxes(cells,2,[opaque]),boxes,'deterministic for stable source order');
});
test('material, tree identity, chunk ownership and transparent cells cannot merge together',()=>{
 const cells=[cell(0,0,0),cell(2,0,0,'other'),cell(4,0,0,'other','1,0,0'),cell(6,0,0,'other','1,0,0',2),cell(8,0,0,'other','1,0,0',2)];
 const boxes=mergeProxyBoxes(cells,2,[opaque,transparent]);assert.equal(boxes.length,cells.length);assert.deepEqual(expand(boxes),expand(cells));
 assert.equal(boxes.filter(c=>c.material===2).every(c=>!c.size),true,'transparent draw surfaces unchanged');
});

test('textured and wireframe materials retain per-cell UVs and edges',()=>{
 const cells=[cell(0,0,0),cell(2,0,0)];
 for(const material of [{...opaque,map:{isTexture:true}},{...opaque,normalMap:{isTexture:true}},{...opaque,wireframe:true}])assert.deepEqual(mergeProxyBoxes(cells,2,[material]),cells);
});
