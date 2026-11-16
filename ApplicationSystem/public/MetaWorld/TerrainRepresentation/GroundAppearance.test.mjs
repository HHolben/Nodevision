// Nodevision/ApplicationSystem/public/MetaWorld/TerrainRepresentation/GroundAppearance.test.mjs
// Verify legacy defaults, atomic style commits, style-aware cache reuse, history, cancellation, permissions, disposal and unchanged voxel rendering through the actual terrain runtime.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../../lib/three/three.module.js';
import {createProceduralVoxelWorld} from '../ProceduralVoxelWorld/ProceduralVoxelWorldRuntime.mjs';
import {validateVoxelWorld} from '../ProceduralVoxelWorld/VoxelWorldDefinition.mjs';
import {voxelMaterialOptions} from '../ProceduralVoxelWorld/VoxelMaterialTestFixtures.mjs';
import {installTerrainRepresentation} from './Authoring.mjs';
import {surfaceNetSteps} from './SurfaceNets.mjs';
import {drainSteps} from '../ProceduralVoxelWorld/ProgressiveTerrain.mjs';
const definition={id:'terrain',type:'procedural-voxel-world',size:[16,64,16],position:[0,0,0],voxelSize:.25,generator:{id:'nodevision-terrain-v1',version:1,seed:42},chunks:{voxelsPerAxis:32,loadRadius:1},generation:{vegetation:false,caves:false,water:false},streaming:{enabled:false,vegetationEnabled:false},representation:'polygonal'};
async function world(extra={}){
 const root=createProceduralVoxelWorld(THREE,{...definition,...extra},[],voxelMaterialOptions),r=root.userData.terrainRuntime;assert.equal(await r.ready,true);
 for(let i=0;i<500;i++){r.update(new THREE.Vector3(4,20,4));if(i>1&&!r.manager.queue.length&&!r.manager.pending)break;if(i%20===0)await new Promise(resolve=>setTimeout(resolve,0));}
 assert.equal(r.manager.queue.length,0);assert.equal(r.manager.pending,null);return {root,r};
}
function buffers(r,normals=true){return [...r.manager.loaded.values()].filter(e=>e.mesh).sort((a,b)=>a.cell.join(',').localeCompare(b.cell.join(','))).map(e=>{
 const g=e.mesh.geometry;return {cell:e.cell,positions:Array.from(g.attributes.position.array),uvs:Array.from(g.attributes.uv.array),indices:Array.from(g.index.array),groups:g.groups,...(normals?{normals:Array.from(g.attributes.normal.array)}:{})};
});}
test('legacy documents remain standard without adding a persisted field, and invalid styles reject',async()=>{
 for(const value of ['bogus',true,0,{}])assert.throws(()=>validateVoxelWorld({...definition,polygonalGroundStyle:value}),/ground style/);
 const {r}=await world();assert.equal(r.polygonalGroundStyle,'standard');assert.equal(r.serialize().polygonalGroundStyle,undefined);
 for(const entry of r.manager.loaded.values())if(entry.mesh){const original=drainSteps(surfaceNetSteps(entry.data,entry.cell,r.generator.getRenderVoxel));assert.deepEqual(Array.from(entry.mesh.geometry.attributes.normal.array),original.normals.map(Math.fround));}
 r.dispose();
});
test('style changes commit atomically, preserve occupancy/geometry and reuse separate bounded cache entries',async()=>{
 const {root,r}=await world(),raw=buffers(r),geometry=buffers(r,false),old=[...root.children],generation=r.stats.generationMs;let history=0;
 const pending=r.setPolygonalGroundStyle('smooth-natural',()=>{history++;assert.equal(r.polygonalGroundStyle,'standard');assert.equal(r.serialize().polygonalGroundStyle,undefined);assert.ok(old.every(m=>m.parent===root&&m.visible));});
 assert.ok(old.every(m=>m.parent===root&&m.visible));assert.equal(await pending,true);assert.equal(history,1);assert.equal(r.polygonalGroundStyle,'smooth-natural');
 assert.deepEqual(buffers(r,false),geometry);assert.notDeepEqual(buffers(r),raw);assert.equal(r.stats.generationMs,generation);
 const hits=r.meshCache.snapshot().hits;await r.setPolygonalGroundStyle('standard');assert.deepEqual(buffers(r),raw);assert.ok(r.meshCache.snapshot().hits>hits);
 const cache=r.meshCache.snapshot();assert.ok(cache.entries<=128&&cache.bytes<=32*1048576);assert.equal(r.serialize().polygonalGroundStyle,'standard');r.dispose();
});
test('history records the previous style and unsupported/read-only targets remain unchanged',async()=>{
 const {root,r}=await world(),entries=[{id:'terrain',def:structuredClone(definition),object3d:root}],history=[],changed=[],bridge={recordHistory:()=>history.push(r.serialize())};installTerrainRepresentation(bridge,{layerEntries:entries,changed:id=>changed.push(id)});
 await bridge.setPolygonalGroundStyle('terrain','smooth-natural');assert.equal(history.length,1);assert.equal(history[0].polygonalGroundStyle,undefined);assert.equal(entries[0].def.polygonalGroundStyle,'smooth-natural');assert.deepEqual(changed,['terrain']);
 assert.equal(bridge.getTerrainRepresentations()[0].groundStyle,'smooth-natural');await assert.rejects(()=>bridge.setPolygonalGroundStyle('linked','standard'));
 const previous=globalThis.window;globalThis.window={VRWorldContext:{movementState:{viewPermissions:{authoring:false}}}};
 try{await assert.rejects(()=>bridge.setPolygonalGroundStyle('terrain','standard'),/editable/);assert.equal(r.polygonalGroundStyle,'smooth-natural');}finally{globalThis.window=previous;r.dispose();}
});
test('rapid style and mode changes cannot commit mixed buffers, and voxel shading stays unchanged',async()=>{
 const {r}=await world();await r.setPolygonalGroundStyle('smooth-natural');const smooth=buffers(r);
 const first=r.setPolygonalGroundStyle('standard'),second=r.setRepresentation('voxel');await Promise.all([first,second]);assert.equal(r.polygonalGroundStyle,'smooth-natural');assert.equal(r.representation,'voxel');
 await r.setRepresentation('polygonal');assert.deepEqual(buffers(r),smooth);
 await r.setRepresentation('voxel');const voxel=buffers(r);await r.setPolygonalGroundStyle('standard');assert.deepEqual(buffers(r),voxel);r.dispose();
});
test('failed history commits and disposal leave style metadata unchanged and release pending meshes',async()=>{
 const {root,r}=await world(),old=buffers(r);await assert.rejects(()=>r.setPolygonalGroundStyle('smooth-natural',()=>{throw Error('history rejected');}),/history rejected/);assert.equal(r.polygonalGroundStyle,'standard');assert.deepEqual(buffers(r),old);
 const pending=r.setPolygonalGroundStyle('smooth-natural');await Promise.resolve();r.dispose();assert.equal(await pending,false);assert.equal(root.children.length,0);assert.equal(r.definition.polygonalGroundStyle,undefined);
});
test('invalid mode requests do not cancel a valid pending style transaction',async()=>{
 const {r}=await world(),pending=r.setPolygonalGroundStyle('smooth-natural');await assert.rejects(()=>r.setRepresentation('invalid'));assert.equal(await pending,true);assert.equal(r.polygonalGroundStyle,'smooth-natural');r.dispose();
});
