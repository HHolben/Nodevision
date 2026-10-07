// Nodevision/ApplicationSystem/public/MetaWorld/Astronomy/Astronomy.test.mjs
// These regressions verify explicit astronomy, host-clock isolation, real catalog coordinates, solar-event jumps, observer transforms and resource ownership.
import { installWorldAstronomy } from '../../PanelInstances/ViewPanels/GameViewDependencies/worldAstronomy.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as THREE from '../../lib/three/three.module.js';
import { earthSandboxAstronomy, normalizeAstronomy, MIDWEST_OBSERVER } from './AstronomyConfig.mjs';
import { createWorldCalendar, seasonAt } from './WorldCalendar.mjs';
import { skyAt, nextSolarEvent, celestialMatrix, horizontalDirection, RAD } from './CelestialCoordinates.mjs';
import { createAstronomyRuntime } from './AstronomyRuntime.mjs';
import { createStarRenderer } from './StarRenderer.mjs';
import { planSandboxWorld } from '../SandboxWorldPlanner.mjs';
import { validateMetaWorldDefinition } from '../MetaWorldLoader.mjs';
const catalog=JSON.parse(await readFile(new URL('../../vendor/hyg/bright-stars.json',import.meta.url)));
const noon=Date.parse('2026-10-07T18:00:00Z');
function temporal(){let s={elapsedSeconds:0,staticTimeEnabled:false,staticTimeSeconds:0,timeScale:1};return {
 getSettings:()=>({...s}),getTimeSeconds:()=>s.staticTimeEnabled?s.staticTimeSeconds:s.elapsedSeconds,
 applySettings:v=>{s={...s,...v};},advance(seconds,paused=false){if(!paused&&!s.staticTimeEnabled)s.elapsedSeconds+=seconds*s.timeScale;}};}
test('only explicit astronomy enables bodies and default observer is geographic',()=>{
 assert.equal(normalizeAstronomy(undefined),null);assert.equal(normalizeAstronomy({model:'unknown'}),null);
 const world=planSandboxWorld(null,'test.html',()=>42).definition;
 assert.deepEqual(world.metadata.astronomy.observer,{latitude:40,longitude:-90});
 assert.equal(world.environment.gasMaterialId,'EarthTroposphere');
 const custom={name:'Custom',type:'world',environment:world.environment,objects:[]};
 assert.equal(planSandboxWorld(custom,'test.html').definition,custom);assert.equal(custom.metadata,undefined);
 assert.deepEqual(validateMetaWorldDefinition(world).metadata.astronomy,world.metadata.astronomy);
});
test('system clock is read once and temporal pause, scale, jumps and timezone remain independent',()=>{
 const t=temporal();let reads=0,host=noon;
 const c=createWorldCalendar(t,{mode:'system-local',timeScale:2},{now:()=>{reads++;return host;},timezone:()=> 'America/Chicago'});
 assert.equal(reads,1);assert.equal(c.timezone,'America/Chicago');host+=86400000;
 t.advance(10);assert.equal(c.instant,noon+20000);t.advance(60,true);assert.equal(c.instant,noon+20000);
 assert.equal(c.jumpTo(noon+3600000),true);t.advance(10);assert.equal(c.instant,noon+3620000);
 assert.equal(reads,1);assert.equal(host,noon+86400000);assert.equal(c.jumpTo(noon),false);
});
test('fixed, saved and static-time policies preserve explicit calendar instants',()=>{
 for(const mode of ['fixed','saved']){
 const t=temporal(),config={mode,initialTime:'2026-10-07T18:00:00Z',savedTime:'2026-10-08T18:00:00Z'};
 const c=createWorldCalendar(t,config,{now:()=>{throw Error('must not read host');},timezone:()=> 'UTC'});
 const start=c.instant;t.applySettings({...t.getSettings(),staticTimeEnabled:true});
 c.jumpTo(start+60000);assert.equal(c.instant,start+60000);
 assert.equal(mode==='saved'?Date.parse(c.snapshot().savedTime):Date.parse(c.snapshot().initialTime),mode==='saved'?start+60000:start);
 }
 assert.throws(()=>createWorldCalendar(temporal(),{mode:'fixed',initialTime:'2026-10-07T12:00:00'}));
});
test('meteorological seasons follow date and hemisphere rather than a global season',()=>{
 assert.equal(seasonAt(noon,40,'America/Chicago'),'autumn');assert.equal(seasonAt(noon,-40),'spring');
 assert.equal(seasonAt(Date.parse('2026-01-10T12:00Z'),40),'winter');
 assert.equal(seasonAt(Date.parse('2026-07-10T12:00Z'),40),'summer');
});
test('Sun and Moon ephemerides depend deterministically on instant and location',()=>{
 const a=skyAt(noon,MIDWEST_OBSERVER),night=skyAt(noon+43200000,MIDWEST_OBSERVER);
 assert.ok(a.sun.altitude>0);assert.ok(night.sun.altitude<0);assert.deepEqual(a,skyAt(noon,MIDWEST_OBSERVER));
 assert.notEqual(a.sun.altitude,skyAt(noon,{latitude:-40,longitude:90}).sun.altitude);
 assert.notEqual(a.moon.azimuth,night.moon.azimuth);assert.ok(a.phase.fraction>=0&&a.phase.fraction<=1);
 assert.ok(Math.abs(a.moon.altitude+a.sun.altitude)>.01);
});
test('sleep selects the next future solar crossing and polar absence is bounded',()=>{
 for(const kind of ['nightfall','daybreak']){
 const event=nextSolarEvent(noon,MIDWEST_OBSERVER,kind);assert.ok(event>noon);
 const altitude=skyAt(event,MIDWEST_OBSERVER).sun.altitude/RAD;
 assert.ok(Math.abs(altitude-(kind==='daybreak'?-.833:-6))<.001);
 assert.ok(nextSolarEvent(event+10000,MIDWEST_OBSERVER,kind)>event+20*3600000);
 }
 assert.equal(nextSolarEvent(Date.parse('2026-06-21T12:00Z'),{latitude:90,longitude:0},'nightfall'),null);
});
test('real HYG catalog retains Sirius and Polaris and transforms without rebuilding vertices',()=>{
 assert.equal(catalog.source,'HYG 4.1');assert.equal(catalog.license,'CC-BY-SA-4.0');assert.ok(catalog.stars.length>5000);
 const sirius=catalog.stars.find(s=>s[1]==='Sirius');assert.ok(Math.abs(sirius[2]-6.75248)<.001);assert.ok(Math.abs(sirius[3]+16.7161)<.001);
 const polaris=catalog.stars.find(s=>s[1]==='Polaris');assert.ok(polaris[3]>89);
 const stars=createStarRenderer(THREE,catalog),buffer=stars.points.geometry.attributes.position;
 stars.update(noon,MIDWEST_OBSERVER,1);const matrix=stars.points.matrix.clone();stars.update(noon+3600000,MIDWEST_OBSERVER,0);
 assert.notDeepEqual(stars.points.matrix.elements,matrix.elements);assert.equal(stars.points.geometry.attributes.position,buffer);
 assert.notDeepEqual(celestialMatrix(THREE,noon,{latitude:0,longitude:0}).elements,matrix.elements);
 assert.notDeepEqual(celestialMatrix(THREE,noon+90*86400000,MIDWEST_OBSERVER).elements,matrix.elements);
 assert.equal(stars.points.material.uniforms.visibility.value,0);assert.equal(stars.points.isPoints,true);stars.dispose();
});
test('declared bodies own their lights and sleep advances the same temporal clock',async()=>{
 const scene=new THREE.Scene(),t=temporal(),config=earthSandboxAstronomy();config.clock={mode:'fixed',initialTime:'2026-10-07T18:00:00Z'};
 const r=createAstronomyRuntime(THREE,scene,t,config,{catalog}),camera=new THREE.PerspectiveCamera();await r.ready;r.update(camera);
 const sun=r.bodies.entries.find(e=>e.body.type==='sun');assert.equal(sun.mesh.geometry.type,'SphereGeometry');assert.ok(sun.light.intensity>0);
 const expected=new THREE.Vector3(...horizontalDirection(r.sky.sun));assert.ok(sun.light.position.clone().sub(sun.light.target.position).normalize().distanceTo(expected)<1e-8);
 assert.equal(r.stars.points.material.uniforms.visibility.value,0);
 assert.equal(r.sleep('nightfall').ok,true);r.update(camera);assert.equal(sun.light.intensity,0);assert.ok(r.stars.points.material.uniforms.visibility.value>.99);
 const instant=r.clock.instant;t.advance(10);assert.equal(r.clock.instant,instant+10000);
 assert.ok(r.snapshot().bodies.every(b=>!b.mesh));r.dispose();assert.equal(scene.children.length,0);
});
test('Moon-only and stars-only worlds have no implicit Sun light or sleep action',async()=>{
 const scene=new THREE.Scene(),config=earthSandboxAstronomy();config.bodies=[{id:'moon',type:'moon'}];config.stars.enabled=false;
 const r=createAstronomyRuntime(THREE,scene,temporal(),config,{now:()=>noon,timezone:()=> 'UTC'});await r.ready;
 const lights=[];scene.traverse(o=>{if(o.isLight)lights.push(o);});assert.equal(lights.length,0);assert.equal(r.sleep('daybreak').ok,false);r.dispose();
});
test('saved calendar persists in validated metadata and legacy lighting ownership is restored',async()=>{
 const previous=globalThis.window,scene=new THREE.Scene(),t=temporal(),config=earthSandboxAstronomy();
 config.clock={mode:'saved',initialTime:'2026-10-07T18:00:00Z'};config.stars.enabled=false;
 const world={name:'Saved',type:'world',metadata:{astronomy:config},objects:[]},legacy=()=>.5;
 const ctx={THREE,scene,temporalController:t,currentWorldDefinition:world,state:{currentWorldDefinition:structuredClone(world)},consolePanels:{updateEnvironmentLighting:legacy}};
 globalThis.window={VRWorldContext:ctx};const adapter=installWorldAstronomy(scene);
 try{
  adapter.prepare();assert.notEqual(ctx.consolePanels.updateEnvironmentLighting,legacy);
  const runtime=ctx.astronomy;t.advance(120);adapter.update(new THREE.PerspectiveCamera());adapter.prepare();assert.equal(ctx.astronomy,runtime);
  const saved=validateMetaWorldDefinition(ctx.state.currentWorldDefinition);
  assert.equal(saved.metadata.astronomy.clock.savedTime,'2026-10-07T18:02:00.000Z');assert.equal(saved.objects.length,0);
  const resumed=createWorldCalendar(temporal(),saved.metadata.astronomy.clock);assert.equal(resumed.instant,noon+120000);
  adapter.dispose();assert.equal(ctx.consolePanels.updateEnvironmentLighting,legacy);assert.equal(scene.children.length,0);
 }finally{adapter.dispose();globalThis.window=previous;}
});
