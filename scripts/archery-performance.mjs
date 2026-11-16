// Fixed scene, real clocks/WebGL, alternating scenario order. Measures bounded tool work independently of terrain streaming.
import * as THREE from '/lib/three/three.module.js';
import {createArcheryVisuals} from '/PanelInstances/ViewPanels/GameViewDependencies/Archery/Visuals.mjs';
import {createFlights} from '/PanelInstances/ViewPanels/GameViewDependencies/Archery/Flight.mjs';
import {createArrowSweep} from '/PanelInstances/ViewPanels/GameViewDependencies/Archery/Collision.mjs';
import {createPrediction} from '/PanelInstances/ViewPanels/GameViewDependencies/Archery/Prediction.mjs';
import {launchSpeed} from '/PanelInstances/ViewPanels/GameViewDependencies/Archery/Physics.mjs';
const results=[];const scene=new THREE.Scene();scene.background=new THREE.Color(0x28343d);const camera=new THREE.PerspectiveCamera(65,4/3,.05,500);camera.position.set(0,8,15);camera.lookAt(0,2,-20);
const renderer=new THREE.WebGLRenderer();renderer.setSize(640,480);document.body.append(renderer.domElement);
const objects=[],colliders=[],geometry=new THREE.BoxGeometry(1,1,1),material=new THREE.MeshBasicMaterial({color:0x67816d});
for(let i=0;i<81;i++){const o=new THREE.Mesh(geometry,material);o.position.set((i%9-4)*2,0,-Math.floor(i/9)*3);scene.add(o);objects.push(o);colliders.push({target:o});}
const summary=a=>{const b=[...a].sort((x,y)=>x-y);return {mean:a.reduce((n,v)=>n+v,0)/a.length,p95:b[Math.floor(b.length*.95)],p99:b[Math.floor(b.length*.99)]};};
const cases=[{name:'no-arrows'},{name:'one-flying',flying:1},{name:'sixteen-flying',flying:16},{name:'64-embedded',embedded:64},{name:'preview-disabled',preview:false},{name:'minimum-force-preview',preview:true,force:10},{name:'maximum-force-long-preview',preview:true,force:500,aim:0},{name:'moving-aim-dense-colliders',preview:true,force:120,moving:true}];
try{
 for(let trial=0;trial<2;trial++)for(const c of trial?[...cases].reverse():cases){
  console.log('NV_TEST_PROGRESS','archery benchmark',trial,c.name);const visual=createArcheryVisuals(THREE,scene),sweep=createArrowSweep({THREE,objects,colliders}),flight=createFlights({THREE,sweep:sweep.sweep,emit(){},visual}),prediction=createPrediction(sweep.sweep,visual),env={key:'flat-SI',gravity:[0,-9.81,0]},force=c.force||120,speed=launchSpeed(force);
  for(let i=0;i<(c.flying||0);i++)flight.launch([i*.05,15,-10],[0,0,-speed],{force,speed});
  for(let i=0;i<(c.embedded||0);i++){const r=flight.launch([0,0,0],[0,-1,0],{force,speed});flight.impact(r,{point:[(i%8)*.1,2,-Math.floor(i/8)*.1],normal:[0,1,0],root:objects[0],object:objects[0]});}
  const frame=[],cpu=[],physics=[],predict=[],queries=[],calls=[],triangles=[];let previous=performance.now();
  for(let i=-30;i<120;i++){
   await new Promise(requestAnimationFrame);const now=performance.now(),dt=(now-previous)/1000;previous=now;const start=performance.now(),before=sweep.queries;
   if(c.flying||c.embedded)flight.tick(dt,env);
   if(c.preview)prediction.update({p:[0,8,0],v:[c.moving?Math.sin(now*.001)*speed*.2:0,c.aim===0?0:-speed*.3,-speed]},env,'fixed-colliders',now);
   const elapsed=performance.now()-start;renderer.render(scene,camera);
   if(i>=0){frame.push(dt*1000);cpu.push(elapsed);physics.push(flight.stats.physicsMs);predict.push(prediction.stats.predictionMs);queries.push(sweep.queries-before);calls.push(renderer.info.render.calls);triangles.push(renderer.info.render.triangles);}
  }
  const before=renderer.info.memory.geometries,record={trial,scenario:c.name,frames:120,frameMs:summary(frame),cpuMs:summary(cpu),physicsMs:summary(physics),predictionMs:summary(predict),collisionQueries:summary(queries),drawCalls:summary(calls),triangles:summary(triangles),flying:flight.snapshot().flying,embedded:flight.snapshot().embedded,dots:prediction.stats.dots,geometryCount:before,bufferBytes:visual.bytes};
  prediction.hide();flight.clear();visual.dispose();renderer.render(scene,camera);record.afterCleanupGeometries=renderer.info.memory.geometries;record.afterCleanupDrawCalls=renderer.info.render.calls;if(record.afterCleanupGeometries!==1)throw Error('Geometry cleanup leak');results.push(record);
 }
 await fetch('/test/metrics',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({complete:true,environment:'Chromium SwiftShader, real RAF, fixed 81-collider scene, 30 warm + 120 measured frames, reverse second order',results})});document.getElementById('result').textContent='PASS: Archery real WebGL CPU, physics, prediction, draw calls, buffers and cleanup matrix';
}catch(e){document.getElementById('result').textContent='FAIL: '+e.stack;}finally{geometry.dispose();material.dispose();renderer.dispose();}
