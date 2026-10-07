// Nodevision/ApplicationSystem/public/MetaWorld/Weather/Weather.test.mjs
// These regressions verify semantic atmosphere support, independent cloud randomness, bounded streaming, pause, resource ownership and declarative persistence.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as THREE from '../../lib/three/three.module.js';
import { supportsEarthWeather } from './AtmosphereWeather.mjs';
import { normalizeWeather, deriveWeatherSeed, weatherDefinition } from './WeatherState.mjs';
import { cloudRegion, cloudOffset } from './CloudField.mjs';
import { createWorldWeatherController } from './WorldWeatherController.mjs';
import { createWeatherRuntime } from './WeatherRuntime.mjs';
import { validateMetaWorldDefinition } from '../MetaWorldLoader.mjs';
import { createVoxelGenerator } from '../ProceduralVoxelWorld/VoxelTerrainGenerator.mjs';
import { terrainDefinition } from '../ProceduralVoxelWorld/VoxelMaterialTestFixtures.mjs';
const earth=JSON.parse(await readFile(new URL('../Materials/Gasses/EarthTroposphere.json',import.meta.url)));
const fetchEarth=async()=>({ok:true,json:async()=>earth});
const atmosphere={gasMaterialFile:'/earth.json'};
const world={name:'Cloud test',type:'world',metadata:{weather:{seed:991,cloudCoverage:1}},objects:[]};

test('only semantic gas capabilities enable Earth weather',async()=>{
  assert.equal(supportsEarthWeather(earth),true);
  for(const name of ['WhiteOxygenatedAir','hydrogen','helium','vacuum']){
    const material=JSON.parse(await readFile(new URL(`../Materials/Gasses/${name}.json`,import.meta.url)));
    assert.equal(supportsEarthWeather(material),false);
  }
  assert.equal(supportsEarthWeather({id:'EarthTroposphere',MatterState:'gas',defaultColor:'#7fb7e8'}),false);
  assert.equal(supportsEarthWeather({...earth,MatterState:'solid'}),false);
});
test('weather works with zero, one or multiple declared lights without owning them',async()=>{
  const scene=new THREE.Scene(),controller=createWorldWeatherController(THREE,scene,{fetch:fetchEarth});
  const position=new THREE.Vector3();
  controller.update(world,atmosphere,position,0);await controller.ready;controller.update(world,atmosphere,position,0);
  assert.ok(controller.runtime);assert.ok(scene.children.every(child=>!child.isLight));
  const runtime=controller.runtime;
  const star=new THREE.Object3D();star.name='Explicit custom star';scene.add(star);
  const lights=[new THREE.PointLight(),new THREE.DirectionalLight()];scene.add(...lights);
  controller.update({...world,astronomicalBodies:[{id:'star'}]},atmosphere,position,10);
  assert.equal(controller.runtime,runtime);
  scene.remove(star,...lights);controller.update(world,atmosphere,position,20);
  assert.equal(controller.runtime,runtime);
  const types=[];scene.traverse(node=>types.push(node.type));
  assert.ok(types.every(type=>!type.includes('Light')));
  scene.add(star);controller.dispose();assert.deepEqual(scene.children,[star]);
});
test('unsupported atmospheres and disabled weather never allocate clouds',async()=>{
  const scene=new THREE.Scene(),controller=createWorldWeatherController(THREE,scene,{fetch:async()=>({ok:true,json:async()=>({MatterState:'gas'})})});
  controller.update(world,atmosphere,new THREE.Vector3(),0);await controller.ready;
  assert.equal(controller.runtime,null);assert.equal(scene.children.length,0);controller.dispose();
  assert.equal(cloudRegion(0,0,normalizeWeather({cloudCoverage:0})).length,0);
  assert.equal(cloudRegion(0,0,normalizeWeather({enabled:false})).length,0);
});
test('seeded fields and wind are deterministic and independent of terrain',()=>{
  const before=createVoxelGenerator(terrainDefinition).generateChunk(2,2,2);
  const state=normalizeWeather({cloudCoverage:1},123456);
  assert.equal(state.seed,deriveWeatherSeed(123456));assert.notEqual(state.seed,123456);
  assert.deepEqual(cloudRegion(-1,2,state),cloudRegion(-1,2,state));
  assert.notDeepEqual(cloudRegion(-1,2,state),cloudRegion(-1,2,normalizeWeather({cloudCoverage:1},42)));
  assert.deepEqual(cloudOffset(state,10),[20,5]);
  assert.deepEqual(createVoxelGenerator(terrainDefinition).generateChunk(2,2,2),before);
});
test('cloud altitudes are bounded and independent of mountain elevations',()=>{
  const state=normalizeWeather({cloudCoverage:1,cloudBaseAltitude:80,cloudTopAltitude:110});
  const lobes=cloudRegion(0,0,state);assert.ok(lobes.length);
  for(const lobe of lobes){assert.ok(lobe.position[1]-lobe.scale[1]>=80);assert.ok(lobe.position[1]+lobe.scale[1]<=110);}
  const peak=createVoxelGenerator(terrainDefinition).getTerrainHeight(1632,2816)*.25;
  assert.ok(peak>state.cloudBaseAltitude&&peak<state.cloudTopAltitude);
});
test('streaming stays bounded, drifts, freezes while paused and releases shared resources once',()=>{
  const scene=new THREE.Scene(),runtime=createWeatherRuntime(THREE,scene,normalizeWeather({cloudCoverage:1}));
  runtime.update(new THREE.Vector3(),0);assert.equal(runtime.renderer.regions.size,49);
  const mesh=runtime.renderer.regions.get('0,0').mesh,origin=mesh.position.clone();
  assert.equal(mesh.material.isMeshStandardMaterial,true);assert.equal(mesh.material.emissive.getHex(),0);
  assert.equal(mesh.userData.colliderRef,undefined);
  runtime.update(new THREE.Vector3(),10);assert.equal(mesh.position.x-origin.x,20);
  runtime.update(new THREE.Vector3(),100,true);assert.equal(runtime.time,10);
  let geometryDisposals=0;mesh.geometry.addEventListener('dispose',()=>geometryDisposals++);
  for(let x=0;x<5000;x+=500)runtime.update(new THREE.Vector3(x,100,0),10);
  assert.equal(runtime.renderer.regions.size,49);assert.ok(!mesh.parent);
  runtime.dispose();runtime.dispose();assert.equal(geometryDisposals,1);assert.equal(scene.children.length,0);
});
test('weather declarations survive world validation and contain no generated instances',()=>{
  const validated=validateMetaWorldDefinition(world);
  assert.deepEqual(validated.metadata.weather,world.metadata.weather);
  assert.deepEqual(weatherDefinition(validated),weatherDefinition(world));
  assert.equal(validated.objects.length,0);assert.equal(validated.metadata.weather.astronomicalBodies,undefined);
});
test('late atmosphere loads cannot recreate weather after teardown',async()=>{
  let resolve;const response=new Promise(done=>resolve=done),scene=new THREE.Scene();
  const controller=createWorldWeatherController(THREE,scene,{fetch:()=>response});
  controller.update(world,atmosphere,new THREE.Vector3(),0);controller.dispose();
  resolve({ok:true,json:async()=>earth});await controller.ready;assert.equal(scene.children.length,0);
});
