import * as THREE from '/lib/three/three.module.js';
import {createMob} from '/MetaWorld/Mobs/Runtime.mjs';
import {createSensorySignals} from '/MetaWorld/Mobs/SensorySignals.mjs';
import {createPlayerModifiers,actorPerceptible} from '/PanelInstances/ViewPanels/GameViewDependencies/PlayerModifiers.mjs';
import {createSwordCombat} from '/PanelInstances/ViewPanels/GameViewDependencies/Sword/Combat.mjs';
import {createSwordVisuals} from '/PanelInstances/ViewPanels/GameViewDependencies/Sword/Visuals.mjs';
import {swordPose} from '/PanelInstances/ViewPanels/GameViewDependencies/Sword/Pose.mjs';
import {createArrowSweep} from '/PanelInstances/ViewPanels/GameViewDependencies/Archery/Collision.mjs';
const renderer=new THREE.WebGLRenderer({antialias:false});renderer.setSize(640,480);document.body.append(renderer.domElement);
const view=new THREE.PerspectiveCamera(60,4/3,.1,300);view.position.set(0,20,35);view.lookAt(0,0,0);
const summary=a=>{const b=[...a].sort((x,y)=>x-y);return {mean:a.reduce((n,x)=>n+x,0)/a.length,p95:b[Math.min(b.length-1,Math.floor(b.length*.95))],max:b.at(-1)};};const results=[];
try{
 for(let trial=0;trial<2;trial++)for(const count of trial?[50,20,5,1]:[1,5,20,50])for(const concealed of trial?[true,false]:[false,true]){
 console.log('NV_TEST_PROGRESS',`M1.4 trial ${trial}, ${count} mobs, concealed ${concealed}`);
 const scene=new THREE.Scene();scene.add(new THREE.HemisphereLight(0xffffff,0x495745,2));const objects=[],colliders=[],player=new THREE.Object3D(),camera=new THREE.PerspectiveCamera(60,1,.1,100),modifiers=createPlayerModifiers();if(concealed)modifiers.toggle('total-concealment');
 const ctx={THREE,scene,objects,colliders,movementState:{playerModifiers:modifiers,paused:false},controls:{getObject:()=>player}};ctx.sensorySignals=createSensorySignals({canSense:(s,a)=>actorPerceptible(ctx,s,a)});
 const floor=new THREE.Group();colliders.push({type:'expression-heightfield',target:floor,sampleGroundY:()=>0,intersectsPlayer:()=>false});
 for(let i=0;i<count;i++){const root=createMob(THREE,{id:'sword-bench-'+i,position:[(i%10-4.5)*1.5,0,-Math.floor(i/10)*1.5],behavior:{wander:true}},colliders);objects.push(root);scene.add(root);}await Promise.all(objects.map(o=>o.userData.mobRuntime.ready));
 const sweep=createArrowSweep({...ctx,exactAnatomy:true}),combat=createSwordCombat({THREE,sweep:sweep.sweep}),visual=createSwordVisuals(THREE,scene);const frames=[],updates=[],renders=[],melee=[];let previous=performance.now(),lastQueryMs=0;
 for(let i=-60;i<300;i++){
  await new Promise(requestAnimationFrame);const now=performance.now(),t=(i+61)/30;ctx.sensorySignals.advance(t);const start=performance.now();
  for(const o of objects){const p=o.userData.mobRuntime.position;player.position.set(p[0],p[1]+.4,p[2]+1.5);if(i%6===0)ctx.sensorySignals.emit({type:'sound',sourceId:'session-player',category:'running',position:player.position.toArray(),intensity:1},t);o.userData.mobRuntime.tick(10000+(i+61)*1000/30,ctx);}const update=performance.now()-start;
  const p=objects[0].userData.mobRuntime.position;camera.position.set(p[0]+.2,p[1]+.22,p[2]-.9);camera.lookAt(p[0]+.2,p[1]+.22,p[2]+1);if(i%30===0)combat.begin();const meleeStart=performance.now();visual.pose(combat.update(1/30,camera)||swordPose(THREE,camera));const meleeMs=performance.now()-meleeStart;
  const renderStart=performance.now();renderer.render(scene,view);const renderMs=performance.now()-renderStart;
  if(i>=0){frames.push(now-previous);updates.push(update);renders.push(renderMs);melee.push(meleeMs);}previous=now;
 }
 const snaps=objects.map(o=>o.userData.mobRuntime.snapshot());results.push({trial,count,concealed,warmFrames:60,measuredFrames:300,simulationSeconds:10,frameMs:summary(frames),mobUpdateMs:summary(updates),renderSubmissionMs:summary(renders),swordUpdateMs:summary(melee),melee:combat.snapshot(),perceptionMs:snaps.reduce((n,s)=>n+s.perception.ms,0),perceptionUpdates:snaps.reduce((n,s)=>n+s.perception.updates,0),processedSignals:snaps.reduce((n,s)=>n+s.perception.signals,0),losQueries:snaps.reduce((n,s)=>n+s.perception.losQueries,0),anatomyIntersectionMs:snaps.reduce((n,s)=>n+s.anatomyCollision.hitTestMs,0),anatomyQueries:snaps.reduce((n,s)=>n+s.anatomyCollision.queries,0),modifiers:modifiers.snapshot(),signalQueue:ctx.sensorySignals.snapshot(),drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,resources:{...renderer.info.memory},swordResources:visual.snapshot(),estimatedAnatomyBytes:snaps.reduce((n,s)=>n+s.anatomy.estimatedStateBytes,0)});
 visual.dispose();combat.cancel();objects.forEach(o=>o.userData.mobRuntime.dispose());ctx.sensorySignals.dispose();modifiers.dispose();await Promise.resolve();renderer.render(scene,view);results.at(-1).cleanup={...renderer.info.memory,trackedTargets:combat.snapshot().trackedTargets};if(renderer.info.memory.geometries||renderer.info.memory.textures)throw Error('GPU resource leak');
 }
 await fetch('/test/metrics',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({complete:true,environment:'Chromium SwiftShader 640x480. Two reversed-order trials. Each case 60 warm + 300 measured RAF, 30Hz simulation, 10 measured simulation seconds. Real Rabbit GLB, moving mobs, repeated sword swings at first moving mob, synthetic per-mob player probe and attributed running signals. Flat support, terrain/vegetation rendering excluded. CPU wall-clock timings, no GPU timer or native hardware FPS claim. Diagnostic totals include warmup; frame summaries exclude warmup. Resource counts are renderer allocations; anatomy bytes are estimates, not JS heap measurement.',results})});document.getElementById('result').textContent='PASS: M1.4 paired concealment 1/5/20/50 moving mobs, repeated sword sweeps, perception/melee/anatomy timings, rendering and cleanup';
}catch(e){document.getElementById('result').textContent='FAIL: '+e.stack;}finally{renderer.dispose();}
