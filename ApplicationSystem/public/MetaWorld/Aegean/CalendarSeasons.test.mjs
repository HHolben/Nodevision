// Nodevision/ApplicationSystem/public/MetaWorld/Aegean/CalendarSeasons.test.mjs
// These tests verify existing-clock seasonal updates, timezone boundaries, hemisphere changes, stable protected terrain and streamed resource replacement without editing saved definitions.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../../lib/three/three.module.js';
import { createCalendarSeasonBinding } from './CalendarSeasons.mjs';
import { AEGEAN_DEFAULTS } from './AegeanDefinition.mjs';
import { createWorldCalendar } from '../Astronomy/WorldCalendar.mjs';
import { createVoxelGenerator } from '../ProceduralVoxelWorld/VoxelTerrainGenerator.mjs';
import { createProceduralVoxelWorld } from '../ProceduralVoxelWorld/ProceduralVoxelWorldRuntime.mjs';
import { voxelMaterialOptions } from '../ProceduralVoxelWorld/VoxelMaterialTestFixtures.mjs';
import { definitionFromVoxelForm,voxelWorldForm } from '../ProceduralVoxelWorld/VoxelAuthoringDefinition.mjs';
const def={id:'season-test',type:'procedural-voxel-world',position:[0,0,0],size:[128,80,128],heightLimits:{min:-16,max:64},voxelSize:.25,generator:{id:'nodevision-terrain-v1',version:1,seed:123456},chunks:{voxelsPerAxis:32,loadRadius:1},environment:{...AEGEAN_DEFAULTS,seasonMode:'calendar'},generation:{vegetation:true,water:true,caves:true}};
function calendar(initial='2026-02-28T21:59:59Z'){
  let seconds=0;const temporal={getTimeSeconds:()=>seconds,getSettings:()=>({elapsedSeconds:seconds}),applySettings:s=>{seconds=s.elapsedSeconds??seconds;}};
  const clock=createWorldCalendar(temporal,{mode:'saved',initialTime:initial,timezone:'Europe/Athens'},{now:()=>{throw Error('unexpected host clock');}});
  return {clock,config:{observer:{latitude:37.5}},advance:s=>{seconds+=s;}};
}
test('existing calendar controls exact timezone/hemisphere season boundaries and fallback',()=>{
  const astro=calendar(),applied=[],environment=structuredClone(def.environment),binding=createCalendarSeasonBinding(environment,s=>applied.push(s));
  binding.update(astro);assert.equal(binding.state.season,'winter');binding.update(astro);assert.equal(applied.length,1);
  astro.advance(1);binding.update(astro);assert.equal(binding.state.season,'spring');
  astro.config.observer.latitude=-37.5;binding.update(astro);assert.equal(binding.state.season,'autumn');
  binding.update(null);assert.equal(binding.state.season,'summer');assert.match(binding.state.source,/fallback/);
  assert.deepEqual(environment,def.environment);
  environment.seasonMode='manual';binding.update(astro);assert.equal(binding.state.season,'summer');
});
test('calendar mode and manual fallback survive form serialization and old worlds remain manual',()=>{
  assert.deepEqual(definitionFromVoxelForm(voxelWorldForm(def),def).environment,def.environment);
  const old=structuredClone(def);delete old.environment.seasonMode;
  assert.equal(voxelWorldForm(old).seasonMode,'manual');
  assert.throws(()=>definitionFromVoxelForm({...voxelWorldForm(def),seasonMode:'unknown'},def),/season source/);
});
test('season transitions preserve terrain, evergreen identity, paths and protected recipes',()=>{
  const source=structuredClone(def);source.protectedRegions=[{id:'landmark',min:[100,100],max:[140,140],seed:source.generator.seed,environment:{...source.environment,season:'summer'}}];
  const g=createVoxelGenerator(source),before=JSON.stringify(source),heights=[],protectedVoxels=[];
  for(let z=0;z<512;z+=19)for(let x=0;x<512;x+=19)heights.push(g.getTerrainHeight(x,z));
  for(let y=0;y<160;y++)protectedVoxels.push(g.getVoxel(120,y,120));
  const evergreens=()=>g.features.query([0,0,0],[512,320,512]).filter(f=>['Olive','TurkishPine','AleppoPine','Cypress','Juniper','HolmOak','Carob','KermesOak','BayLaurel','StrawberryTree'].includes(f.species)).map(f=>[f.id,f.species,f.origin,f.seed]);
  const trees=evergreens();assert.ok(trees.length>0);
  let stream=null,grass=null;
  for(let z=0;z<512&&!stream;z+=2)for(let x=0;x<512;x+=2){if(x>=100&&x<140&&z>=100&&z<140)continue;const e=g.getEnvironment(x,z);if(e.stream){stream=[x,z,e.height];break;}}
  for(let z=0;z<512&&!grass;z+=5)for(let x=0;x<512;x+=5){const e=g.getEnvironment(x,z);if(e.surface==='DryMediterraneanSoil'&&e.moisture>.4){grass=[x,z,e.height];break;}}
  assert.ok(stream&&grass);assert.ok(g.getWaterTop(stream[0],stream[1])<=stream[2]);
  assert.equal(g.setSeason('winter'),true);assert.equal(g.setSeason('winter'),false);
  assert.equal(g.getWaterTop(stream[0],stream[1]),stream[2]+2);
  assert.equal(g.getVoxelMaterialId(grass[0],grass[2]-1,grass[1]),'LivingMediterraneanGrass');
  const after=[];for(let z=0;z<512;z+=19)for(let x=0;x<512;x+=19)after.push(g.getTerrainHeight(x,z));assert.deepEqual(after,heights);
  assert.deepEqual(evergreens(),trees);assert.deepEqual(Array.from({length:160},(_,y)=>g.getVoxel(120,y,120)),protectedVoxels);
  assert.equal(JSON.stringify(source),before);
  g.setSeason('summer');assert.ok(g.getWaterTop(stream[0],stream[1])<=stream[2]);
});
test('runtime marks resident chunks stale once, keeps roots/materials and saves only authored settings',async()=>{
  const colliders=[],root=createProceduralVoxelWorld(THREE,def,colliders,voxelMaterialOptions),r=root.userData.proceduralVoxelRuntime;await r.ready;
  const astro=calendar('2026-07-01T12:00:00Z'),position=new THREE.Vector3(64,20,64);
  for(let i=0;i<40;i++)r.update(position,astro);
  const materials=r.materials,saved=r.serialize(),count=r.stats.generated,oldMeshes=root.children.slice();assert.ok(oldMeshes.length>0);
  assert.equal(r.updateCalendar(astro),false);assert.equal(r.manager.invalidated.size,0);
  astro.clock.jumpTo(Date.parse('2026-12-01T12:00:00Z'));assert.equal(r.updateCalendar(astro),true);
  const dirty=r.manager.invalidated.size;assert.ok(dirty>0);assert.equal(r.updateCalendar(astro),false);assert.equal(r.manager.invalidated.size,dirty);
  assert.deepEqual(root.children,oldMeshes);assert.equal(r.materials,materials);assert.deepEqual(r.serialize(),saved);
  r.update(position);assert.equal(r.seasonState.season,'winter');assert.equal(r.stats.generated,count+1);
  r.dispose();assert.equal(r.updateCalendar(astro),false);assert.equal(colliders.length,0);
});

test('season cache refresh retains existing path constraints',()=>{
  const g=createVoxelGenerator(def),path={def:{id:'authored-road',visible:true,terrainInteraction:'grade',proceduralExclusion:true,width:2,transitionWidth:1},bounds:{minX:60,maxX:68,minZ:60,maxZ:68},heightAt:()=>20,nearest:()=>({distance:0,height:20})};
  g.setPathConstraints([path]);const height=g.getTerrainHeight(256,256),voxel=g.getVoxel(256,height-1,256);
  g.setSeason('winter');assert.equal(g.getTerrainHeight(256,256),height);assert.equal(g.getVoxel(256,height-1,256),voxel);
});
