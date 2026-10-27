// Nodevision/ApplicationSystem/public/MetaWorld/ConstructionEditing/Phase5.test.mjs
// These regressions cover independent volume history, sparse geometry, terrain conflicts, and multi-volume composition across signed chunk boundaries.
import test from 'node:test';
import assert from 'node:assert/strict';
import {validateConstruction,terrainBounds,constructionBounds,scenePrimitives,volumesOverlap} from '../Constructions/Definition.mjs';
import {composeConstructions} from '../Constructions/TerrainComposition.mjs';
import {createConstructionEditLayer} from './Layer.mjs';
import {collectGeometry,geometryConflicts} from './Geometry.mjs';
import {encodeRegion,verifyGeometry} from '../ConstructionCapture/Geometry.mjs';
import {decodeGox} from '../../Voxels/GoxCodec.mjs';
import {excavationPreview} from './Preview.mjs';
import {ChunkRegionIndex} from '../ProceduralVoxelWorld/ChunkRegionIndex.mjs';
const cut=(id,position,size=[4,4,4],active=true)=>({id,type:'TerrainCut',shape:'box',operation:'subtract',active,position,size});
const def=volumes=>validateConstruction({schema:'nodevision-construction',version:2,id:'house',voxelSize:.25,position:[0,0,0],terrainVolumes:volumes,geometry:{source:'House.gox',position:[0,0,0]}});
const stone={materialId:'stone',solid:true,rgba:[10,20,30,255]};
test('union handles overlapping, inactive, separated and negative cuts without excavating their bounds',()=>{
 const d=def([cut('a',[-33,-1,-33]),cut('b',[-31,-1,-31]),cut('c',[32,0,32]),cut('inactive',[0,0,0],[4,4,4],false)]);
 const base={getVoxel:()=>3,getVoxelMaterialId:()=> 'stone',getFeatureVoxel:()=>3,generateChunk:()=>new Uint8Array(32768).fill(3)};
 const f=composeConstructions(base,{position:[0,0,0]});f.setConstructions([{bounds:constructionBounds(d),cuts:terrainBounds(d),sample:()=>null}]);
 for(const p of [[-33,0,-33],[-31,0,-31],[32,0,32]])assert.equal(f.getVoxel(...p),0);
 for(const p of [[0,0,0],[10,0,10],[-34,0,-33],[36,0,32]])assert.equal(f.getVoxel(...p),3);
 assert.equal(f.generateChunk(-1,0,-1)[0],0);f.setConstructions([]);assert.equal(f.getVoxel(-31,0,-31),3);
});
test('stable identities reject duplicates, obsolete schemas and overflowing volume endpoints',()=>{
 const d=def([cut('a',[0,0,0])]);assert.throws(()=>def([cut('a',[0,0,0]),cut('a',[1,1,1])]));assert.throws(()=>validateConstruction({...d,version:1}));assert.throws(()=>def([cut('big',[4000000,0,0])]));
 const p=scenePrimitives({id:'instance'},d);assert.equal(p[2].path,'/World/Constructions/c_instance/TerrainVolumes/cut_a');assert.equal(p[2].active,true);
 assert.equal(volumesOverlap(d,def([cut('touch',[4,0,0])])),false);assert.equal(volumesOverlap(d,def([cut('touch',[3,0,0])])),true);
});
test('add, resize, move, duplicate, deactivate and delete are individually undoable with geometry',()=>{
 const edit=createConstructionEditLayer({baseline:new Map()});const snapshots=[[]];
 for(const next of [[cut('a',[0,0,0])],[cut('a',[0,0,0],[8,4,4])],[cut('a',[-33,0,0],[8,4,4])],[cut('a',[-33,0,0]),cut('b',[-33,0,0])],[cut('a',[-33,0,0]),cut('b',[-33,0,0],[4,4,4],false)],[]]){edit.volumes(next);snapshots.push(next);}
 for(let i=snapshots.length-2;i>=0;i--){assert.equal(edit.undo(),true);assert.deepEqual(edit.terrainVolumes,snapshots[i]);}
 for(const next of snapshots.slice(1)){edit.redo();assert.deepEqual(edit.terrainVolumes,next);}
 edit.edit('add',[[0,500,0]],stone);edit.undo();assert.equal(edit.layer.effective([0,500,0]),null);edit.redo();assert.deepEqual(edit.terrainVolumes,[]);assert.deepEqual(edit.layer.effective([0,500,0]),stone);
 edit.reset();assert.equal(edit.dirty,0);
});
test('sparse geometry round trips outside cuts and conflicts resolve only through intentional excavation',async()=>{
 const baseline=new Map([['-40,0,0',stone]]),edit=createConstructionEditLayer({baseline});edit.edit('add',[[0,500,0],[30,0,0]],stone);
 const region=collectGeometry(baseline,edit.layer);assert.equal(region.cells.length,3);const terrain=p=>p[1]<1;
 assert.equal(geometryConflicts(region,[0,0,0],[0,0,0],[],terrain).length,2);
 assert.equal(geometryConflicts(region,[0,0,0],[0,0,0],[cut('a',[-40,0,0]),cut('b',[30,0,0])],terrain).length,0);
 const bytes=await encodeRegion(region);assert.equal(verifyGeometry(region,await decodeGox(bytes)),true);
});
test('indexed invalidation includes negative chunks without traversing resident entries',()=>{
 const index=new ChunkRegionIndex();for(const cell of [[-2,0,-2],[-1,0,-1],[0,0,0],[10,10,10]])index.set(cell.join(','),{cell});
 index[Symbol.iterator]=()=>{throw Error('Full resident scan');};assert.deepEqual([...index.region({min:[-33,-1,-33],max:[1,1,1]})],['-2,0,-2','-1,0,-1','0,0,0']);index.delete('-1,0,-1');assert.equal([...index.region({min:[-32,0,-32],max:[0,32,0]})].length,0);
});

test('material and coordinate limits reject a whole edit before mutating focused history',()=>{
 const baseline=new Map(Array.from({length:128},(_,i)=>[`${i},0,0`,{...stone,materialId:'material-'+i}])),edit=createConstructionEditLayer({baseline});
 assert.throws(()=>edit.batch([{at:[0,1,0],value:{...stone,materialId:'new'}}]),/128 material/);assert.equal(edit.layer.count,0);assert.equal(edit.undo(),false);
 assert.throws(()=>edit.edit('brush',[[0,1,0],[1000001,0,0]],stone));assert.equal(edit.layer.count,0);
});

test('unchanged excavation boxes do not exhaust the highlight budget for a new volume',()=>{
 const existing=cut('existing',[0,0,0],[512,512,512]),added=cut('new',[-10,0,0],[1,1,1]);let samples=0;
 const result=excavationPreview({terrainVolumes:[existing],position:[0,0,0],terrainAt(){samples++;return true;}},[existing,added],1);
 assert.deepEqual(result.points,[[-10,0,0]]);assert.equal(result.truncated,false);assert.equal(samples,1);
});
