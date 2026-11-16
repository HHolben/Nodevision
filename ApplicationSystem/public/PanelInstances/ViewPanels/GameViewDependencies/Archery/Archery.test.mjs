// Shared-model accuracy, source/triangle collision, bounded resources, moving attachments and world gravity regressions.
import test from 'node:test';import assert from 'node:assert/strict';
import * as THREE from '/lib/three/three.module.js';
import {STEP,ARROW,DEFAULTS,validSettings,drawForce,launchSpeed,initial,advance,simulate} from './Physics.mjs';
import {createFlights} from './Flight.mjs';import {createPrediction} from './Prediction.mjs';import {createArrowSweep} from './Collision.mjs';import {createArcheryVisuals} from './Visuals.mjs';import {arrowEnvironment} from './Gravity.mjs';
import {createProceduralVoxelWorld} from '/MetaWorld/ProceduralVoxelWorld/ProceduralVoxelWorldRuntime.mjs';import {voxelMaterialOptions} from '/MetaWorld/ProceduralVoxelWorld/VoxelMaterialTestFixtures.mjs';
const close=(a,b,t=1e-8)=>assert.ok(Math.abs(a-b)<t,`${a} ≈ ${b}`);
function fixture(){return {THREE,objects:[],colliders:[],scene:new THREE.Scene()};}
function box(c,y,solid=true){const o=new THREE.Mesh(new THREE.BoxGeometry(10,.02,10),new THREE.MeshBasicMaterial());o.position.y=y;c.scene.add(o);c.objects.push(o);if(solid){const ref={target:o};o.userData.colliderRef=ref;c.colliders.push(ref);}return o;}
const visual=()=>({updateArrows(){},trace:{visible:false},updateTrace(){return 96;}});
test('force bounds, cap, duration and SI energy conversion',()=>{
 for(const s of [{minForce:0},{maxForce:NaN},{minForce:200,maxForce:100},{drawTime:0},{maxForce:501},{drawTime:Infinity}])assert.equal(validSettings({...DEFAULTS,...s}),false);
 assert.ok(validSettings(DEFAULTS));close(drawForce(0,DEFAULTS),10);close(drawForce(.6,DEFAULTS),65);close(drawForce(20,DEFAULTS),120);close(.5*ARROW.mass*launchSpeed(120)**2,ARROW.efficiency*120*ARROW.drawDistance);
});
test('gravity and quadratic drag oppose motion and remain stable at maximum launch energy',()=>{
 const s=initial([0,10,0],[100,0,0]),n=advance(s,{gravity:[0,-9.81,0],drag:.02});assert.ok(n.v[0]<100&&n.v[1]<0);const slow=advance(initial([0,0,0],[10,0,0]),{gravity:[0,0,0],drag:.02});assert.ok(100-n.v[0]>10-slow.v[0]);
 const result=simulate(initial([0,0,0],[launchSpeed(500),50,0]),{gravity:[0,-14400,0]});assert.ok(result.states.every(s=>[...s.p,...s.v].every(Number.isFinite)));
});
test('shared prediction versus actual flight: strengths, elevations, gravity, drag and 30/60/144 FPS',()=>{
 let combinations=0;
 for(const force of [10,65,120])for(const angle of [-.2,.4,1])for(const gravity of [0,9.81,43.2])for(const drag of [0,.0003,.005]){
  const v=[launchSpeed(force)*Math.cos(angle),launchSpeed(force)*Math.sin(angle),0],env={gravity:[0,-gravity,0],drag},pred=simulate(initial([0,100,0],v),env,{steps:120,maxDistance:1000}).states.at(-1);
  for(const fps of [30,60,144]){const f=createFlights({THREE,sweep:()=>null,emit(){},visual:visual()}),r=f.launch([0,100,0],v,{force,speed:launchSpeed(force)});for(let i=0;i<fps;i++)f.tick(1/fps,env);r.state.p.forEach((n,i)=>close(n,pred.p[i],1e-9));r.state.v.forEach((n,i)=>close(n,pred.v[i],1e-9));combinations++;}
 }assert.equal(combinations,243);
});
test('swept first impact crosses thin construction/imported triangles, ignores decorative geometry and helpers',()=>{
 const c=fixture(),target=box(c,0),decoration=box(c,2,false),helper=box(c,3);helper.userData.isEditorHelper=true;const s=createArrowSweep(c),hit=s.sweep([0,10,0],[0,-10,0]);assert.equal(hit.root,target);close(hit.point[1],.01,1e-6);assert.deepEqual(hit.normal,[0,1,0]);assert.ok(decoration);c.colliders[0].enabled=false;assert.equal(s.sweep([0,10,0],[0,-10,0]),null);
});
test('arrow tip embeds, stops physics, follows moving collider coordinates and emits stable identity',()=>{
 const c=fixture(),target=box(c,0);target.userData.id='moving-platform';const events=[],s=createArrowSweep(c),f=createFlights({THREE,sweep:s.sweep,emit:(type,d)=>events.push({type,...d}),visual:visual()}),r=f.launch([0,2,0],[0,-200,0],{force:120,speed:200,shooterId:'player'});f.tick(1/30,{gravity:[0,-9.81,0]});assert.ok(r.hit);close(r.state.p[1],.01,1e-6);const t=r.state.time;f.tick(.1,{gravity:[0,-100,0]});close(r.state.time,t);target.position.y=4;f.tick(1/60,{gravity:[0,-100,0]});close(r.state.p[1],4.01,1e-6);assert.equal(events.find(e=>e.type==='arrow-hit-object').objectId,'moving-platform');assert.equal(events.filter(e=>e.type==='arrow-fired').length,1);target.removeFromParent();f.tick(1/60,{});assert.equal(f.records.length,0);
});
test('flying/embedded budgets and frame-stall work remain bounded; no scene document entries',()=>{
 const c=fixture(),target=box(c,0),f=createFlights({THREE,sweep:()=>null,emit(){},visual:visual()});for(let i=0;i<100;i++)f.launch([0,2,0],[0,0,-10],{force:10,speed:10});assert.equal(f.records.length,16);f.tick(10,{gravity:[0,0,0]});assert.ok(f.stats.steps<=48&&f.stats.discardedSeconds>9);f.clear();
 for(let i=0;i<100;i++){const r=f.launch([0,0,0],[0,-1,0],{force:10,speed:10});f.impact(r,{point:[0,0,0],normal:[0,1,0],root:target,object:target});}assert.equal(f.records.length,64);f.clear();assert.equal(f.records.length,0);assert.equal(c.objects.length,1);
});
test('prediction bounds, invalidation and stationary reuse; same first-impact point',()=>{
 const c=fixture();box(c,0);const s=createArrowSweep(c),vis=visual();let final;vis.updateTrace=(states,hit)=>{final={states,hit};return Math.min(96,states.length);};const p=createPrediction(s.sweep,vis),launch={p:[0,2,0],v:[0,-100,0]},env={key:'flat',gravity:[0,-9.81,0]};p.update(launch,env,'world',0);assert.ok(final.hit);const before=p.stats.recomputations;p.update(launch,env,'world',200);assert.equal(p.stats.recomputations,before);p.update({...launch,v:[1,-100,0]},env,'world',400);assert.equal(p.stats.recomputations,before+1);assert.ok(p.stats.steps<=120);p.hide();assert.equal(vis.trace.visible,false);
 const long=createPrediction(()=>null,vis);long.update({p:[0,0,0],v:[0,0,-10]},{key:'zero',gravity:[0,0,0]},'',0);for(let i=1;i<5;i++)long.update({p:[0,0,0],v:[0,0,-10]},{key:'zero',gravity:[0,0,0]},'',i*16);assert.ok(final.states.length<=481&&long.stats.dots<=96);
});
test('rendered triangular tip origin and instantaneous flight orientation; GPU buffers dispose once',()=>{
 const scene=new THREE.Scene(),vis=createArcheryVisuals(THREE,scene);vis.updateArrows([{state:{p:[1,2,3],v:[0,-1,0]}}]);const m=new THREE.Matrix4();vis.arrows.getMatrixAt(0,m);assert.deepEqual(new THREE.Vector3().applyMatrix4(m).toArray(),[1,2,3]);const dir=new THREE.Vector3(0,0,-1).transformDirection(m);close(dir.y,-1);assert.equal(vis.arrows.count,1);assert.ok(vis.arrows.geometry.index.count<=12);assert.equal(vis.trace.geometry.attributes.position.count,96);vis.dispose();assert.equal(scene.children.length,0);
});
test('legacy flat, none and position-dependent point-mass world gravity convert consistently',()=>{
 let model={mode:'flat',flatG:.012};const ctx={api:{readActiveGravityModel:()=>model,resolveGravityPointPosition:()=>new THREE.Vector3()}};close(arrowEnvironment(ctx).gravity([1,0,0])[1],-43.2);model={mode:'none'};assert.deepEqual(arrowEnvironment(ctx).gravity([0,0,0]),[0,0,0]);model={mode:'point-mass',bigG:.001,mass:1000};const env=arrowEnvironment(ctx);close(env.gravity([10,0,0])[0],-36);close(env.gravity([20,0,0])[0],-9);
});
test('real finite/infinite procedural source and polygonal triangles share authoritative collision without coarse tiles',async()=>{
 for(const infinite of [false,true]){
  const c=fixture(),definition={id:'terrain',type:'procedural-voxel-world',voxelSize:.25,representation:'voxel',size:[50,64,50],worldExtent:{mode:infinite?'infinite':'finite'},position:[0,0,0],generator:{id:'nodevision-terrain-v1',version:1,seed:42},chunks:{voxelsPerAxis:32,loadRadius:1},generation:{vegetation:false,caves:false,water:false}};
  const root=createProceduralVoxelWorld(THREE,definition,c.colliders,voxelMaterialOptions);c.scene.add(root);c.objects.push(root);const r=root.userData.terrainRuntime;assert.ok(await r.ready);const sweep=createArrowSweep(c),x=infinite?-4:20,source=JSON.stringify(r.serialize());let hit=sweep.sweep([x,60,20],[x,-10,20]);assert.ok(hit&&!hit.uncertain&&hit.terrain);assert.equal(r.manager.loaded.size,0);const ground=hit.point[1];
  for(let i=0;i<400;i++){r.update(new THREE.Vector3(x,ground+3,20));if(!r.manager.queue.length&&!r.manager.progressive)break;}await r.setRepresentation('polygonal');hit=sweep.sweep([x,60,20],[x,-10,20]);assert.ok(hit&&!hit.uncertain);assert.ok(Math.abs(hit.point[1]-ground)<1);await r.setRepresentation('voxel');assert.equal(JSON.stringify(r.serialize()),source);r.dispose();
 }
});
test('midpoint integration agrees with analytic gravity and a finer drag reference',()=>{
 let worst=0;for(const force of [10,120,500])for(const drag of [0,.0003,.005]){
  const env={gravity:[0,-43.2,0],drag},s=initial([0,100,0],[launchSpeed(force),20,0]);let coarse=s,fine=s;for(let i=0;i<240;i++)coarse=advance(coarse,env);for(let i=0;i<1920;i++)fine=advance(fine,env,STEP/8);worst=Math.max(worst,Math.hypot(...coarse.p.map((v,i)=>v-fine.p[i])));
  if(drag===0){close(coarse.p[0],launchSpeed(force)*2,1e-8);close(coarse.p[1],100+40-.5*43.2*4,1e-8);}
 }assert.ok(worst<.002,`Maximum 2-second error ${worst} m`);
});
test('release tip clears the player when aiming horizontally, upward and through own body downward',async()=>{
 const {releaseTip}=await import('./Aim.mjs'),origin=new THREE.Vector3(0,2,0);for(const dir of [[0,0,-1],[0,1,0],[0,-1,0]]){const p=releaseTip(THREE,origin,new THREE.Vector3(...dir),origin,1.75);assert.ok(p.y<.25||p.y>2.1||Math.hypot(p.x,p.z)>.35);}
});
test('authored-map/hybrid source collision, missing-source uncertainty and construction cuts do not require terrain generation',async()=>{
 const {encodeSmallMap}=await import('/MetaWorld/TerrainMaps/Format.mjs');const metadata={format:'nodevision-terrain-map',version:1,name:'Archery map',size:[32,32],origin:[0,0,0],grid:{width:33,height:33,spacing:[1,1],tileSize:16},elevation:{units:'meters',reference:'local'},biomes:['temperate'],materials:[null,'sand'],extensions:{}};
 const bytes=await encodeSmallMap(metadata,()=>({elevation:3,biome:0,material:1}));
 for(const terrainSource of ['map','hybrid']){const c=fixture(),definition={id:'map',position:[0,0,0],size:[32,32,32],heightLimits:{min:0,max:32},voxelSize:.25,generator:{id:'nodevision-terrain-v1',version:1,seed:42},chunks:{voxelsPerAxis:32,loadRadius:1},terrainSource,terrainMap:{version:1,path:'map.nvmap',detailStrength:0,detailScale:16,outside:'empty'},generation:{vegetation:false,caves:false,water:false}},root=createProceduralVoxelWorld(THREE,definition,c.colliders,{...voxelMaterialOptions,worldPath:'world.html',mapRead:async(o,n)=>bytes.slice(o,o+n)});c.scene.add(root);c.objects.push(root);const r=root.userData.terrainRuntime;assert.ok(await r.ready);const s=createArrowSweep(c);let hit=s.sweep([4,20,4],[4,-2,4]);assert.ok(hit&&!hit.uncertain);const old=r.mapSampleReady;r.mapSampleReady=()=>false;hit=s.sweep([4,20,4],[4,-2,4]);assert.ok(hit.uncertain);r.mapSampleReady=old;
  const cut={min:[3,0,3],max:[5,10,5]};r.setConstructions([{id:'cut',bounds:cut,cuts:[cut],sample:()=>null}]);assert.equal(s.sweep([4,20,4],[4,0,4]),null);r.dispose();
 }
});

test('trajectory uses small separated screen-space dots rather than an overlapping beam',()=>{
 const scene=new THREE.Scene(),visual=createArcheryVisuals(THREE,scene),camera=new THREE.PerspectiveCamera(60,1,.1,500);camera.updateMatrixWorld(true);visual.updateBow(camera,1,true,'dominant');
 const result=simulate(initial([0,0,-.5],[0,0,-50]),{gravity:[0,-9.81,0]},{steps:240,maxDistance:200});const count=visual.updateTrace(result.states,null);assert.ok(count>3&&count<=96);assert.equal(visual.trace.material.sizeAttenuation,false);assert.ok(visual.trace.material.size<=4);
 const positions=visual.trace.geometry.attributes.position;let last=null;for(let i=0;i<count;i++){const p=new THREE.Vector3().fromBufferAttribute(positions,i).project(camera);if(last)assert.ok(p.distanceTo(last)>=.021);last=p;}visual.dispose();
});
