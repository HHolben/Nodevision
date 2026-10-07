// Nodevision/scripts/astronomy-render-browser.mjs
// This fixture measures the real offline star batch and astronomical frame updates through the local WebGL renderer.
import * as THREE from '/lib/three/three.module.js';
import {createAstronomyRuntime} from '/MetaWorld/Astronomy/AstronomyRuntime.mjs';
import {earthSandboxAstronomy} from '/MetaWorld/Astronomy/AstronomyConfig.mjs';
try{
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(75,1.25,.1,1000);
 camera.lookAt(0,1,-1);const renderer=new THREE.WebGLRenderer();renderer.setSize(800,640);document.body.append(renderer.domElement);
 let elapsedSeconds=0;const temporal={getTimeSeconds:()=>elapsedSeconds,getSettings:()=>({elapsedSeconds,staticTimeEnabled:false,staticTimeSeconds:0,timeScale:1}),applySettings:s=>elapsedSeconds=s.elapsedSeconds};
 const config=earthSandboxAstronomy();config.clock={mode:'fixed',initialTime:'2026-10-08T05:00:00Z'};
 const start=performance.now(),runtime=createAstronomyRuntime(THREE,scene,temporal,config);await runtime.ready;
 const readyMs=performance.now()-start;runtime.update(camera);renderer.render(scene,camera);
 runtime.bodies.root.visible=false;renderer.render(scene,camera);
 if(renderer.info.render.calls!==1||renderer.info.render.points!==5070)throw Error('Stars must draw as one real-catalog point batch');
 const starDrawCalls=renderer.info.render.calls;runtime.bodies.root.visible=true;
 for(const entry of runtime.bodies.entries){
   let rendered=false;
   for(let hour=0;hour<48;hour++){
     elapsedSeconds=hour*3600;runtime.update(camera);
     if(runtime.sky[entry.body.type].altitude<=0)continue;
     camera.lookAt(entry.mesh.position);renderer.render(scene,camera);
     if(renderer.info.render.triangles>0){rendered=true;break;}
   }
   if(!rendered)throw Error('Declared '+entry.body.type+' did not render');
 }
 elapsedSeconds=0;camera.lookAt(0,1,-1);runtime.update(camera);
 const frameStart=performance.now();for(let i=0;i<120;i++){elapsedSeconds+=1/60;runtime.update(camera);renderer.render(scene,camera);}
 const frameSubmitMs=(performance.now()-frameStart)/120;
 if(renderer.getContext().getError()!==0)throw Error('WebGL astronomy error');
 window.astronomyRenderReport={readyMs,frameSubmitMs,starDrawCalls,starCount:5070,geometryCount:renderer.info.memory.geometries};
 runtime.dispose();renderer.render(scene,camera);if(renderer.info.memory.geometries!==0)throw Error('Astronomy geometry leak');renderer.dispose();
 document.getElementById('result').textContent='PASS: real catalog single draw, Sun/Moon render, frame submission and GPU resource cleanup\n'+JSON.stringify(window.astronomyRenderReport);
}catch(error){document.getElementById('result').textContent='FAIL: '+error.stack;}
