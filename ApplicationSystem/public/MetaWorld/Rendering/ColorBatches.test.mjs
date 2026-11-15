// Nodevision/ApplicationSystem/public/MetaWorld/Rendering/ColorBatches.test.mjs
// These tests verify exact rendering-property compatibility, linear-color preservation and owned-resource disposal. They also exercise actual terrain section masks and vegetation instance colors without changing source identities or geometry.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../../lib/three/three.module.js';
import {colorBatches} from './ColorBatches.mjs';
import {createTileMesh} from '../TerrainLOD/TileMesh.mjs';
import {vegetationInstances} from '../VegetationLOD/Instances.mjs';
test('only base-color differences combine; roughness, transparency, textures and custom shaders remain separate',()=>{
 const a=new THREE.MeshStandardMaterial({color:0x123456}),b=a.clone();b.color.set(0xabcdef);
 const c=a.clone();c.roughness=.2;const d=a.clone();d.transparent=true;const e=a.clone();e.map=new THREE.Texture();const f=a.clone();f.onBeforeCompile=()=>{};
 const palette=colorBatches([a,b,c,d,e,f],[0,1,2,3,4,5],true);
 assert.equal(palette.batches.length,5);assert.equal(palette.mapping.get(0),palette.mapping.get(1));assert.equal(palette.mapping.get(0).material.color.getHex(),0xffffff);
 assert.equal(palette.mapping.get(0).material.roughness,a.roughness);assert.equal(palette.mapping.get(0).material.vertexColors,true);
 let owned=0,shared=0;palette.mapping.get(0).material.addEventListener('dispose',()=>owned++);a.addEventListener('dispose',()=>shared++);palette.dispose();assert.equal(owned,1);assert.equal(shared,0);
});
test('terrain batches preserve section geometry, source colors and exact handoff',()=>{
 const mats=[new THREE.MeshStandardMaterial({color:0x123456}),new THREE.MeshStandardMaterial({color:0xabcdef})];
 const vertices=x=>[[x,0,0],[x,0,8],[x+8,0,8],[x+8,0,0]].map(p=>({p,n:[0,1,0]}));
 const t=createTileMesh(THREE,{level:2,sections:[{x:-1,z:0,faces:[{material:1,vertices:vertices(-8)}]},{x:0,z:0,faces:[{material:2,vertices:vertices(0)}]}]},mats);
 assert.equal(t.mesh.geometry.groups.length,1);assert.equal(t.mesh.geometry.index.count,12);
 const color=t.mesh.geometry.attributes.color;assert.ok(Math.abs(color.getX(0)-mats[0].color.r)<1e-7);assert.ok(Math.abs(color.getZ(4)-mats[1].color.b)<1e-7);
 t.mask(x=>x<0);assert.equal(t.mesh.geometry.index.count,6);assert.equal(t.mesh.geometry.index.array[0],4);const version=t.mesh.geometry.index.version;t.mask(x=>x<0);assert.equal(t.mesh.geometry.index.version,version);
 t.mask(()=>true);assert.equal(t.mesh.visible,false);t.mask(()=>false);assert.equal(t.mesh.geometry.index.count,12);t.dispose();
});
test('packed instances retain material colors after independent chunk handoffs',()=>{
 const mats=[new THREE.MeshStandardMaterial({color:0x123456}),new THREE.MeshStandardMaterial({color:0xabcdef})],geometry=new THREE.BoxGeometry();
 const cells=[{p:[-2,0,0],id:'a',chunk:'a',material:1},{p:[2,0,0],id:'b',chunk:'b',material:2}];
 const tile=vegetationInstances(THREE,{cells,step:2},geometry,mats,0),mesh=tile.group.children[0],color=new THREE.Color();assert.equal(tile.group.children.length,1);assert.equal(mesh.count,2);
 tile.mask(k=>k==='a');assert.equal(mesh.count,1);mesh.getColorAt(0,color);assert.ok(Math.abs(color.g-mats[1].color.g)<1e-7);
 const version=mesh.instanceMatrix.version;tile.mask(k=>k==='a');assert.equal(mesh.instanceMatrix.version,version);assert.equal(tile.mask(()=>false).ids.size,2);tile.dispose();geometry.dispose();
});
