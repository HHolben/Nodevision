// Nodevision/scripts/weather-world-browser.mjs
// This fixture checks normal Game View weather through its real render loop, declared lights, shared clock and teardown.
import * as THREE from '/lib/three/three.module.js';
import { createSceneBase } from '/PanelInstances/ViewPanels/GameViewDependencies/sceneBase.mjs';
import { startRenderLoop } from '/PanelInstances/ViewPanels/GameViewDependencies/renderLoop.mjs';
const ok=(value,message)=>{if(!value)throw Error(message);};
const wait=async predicate=>{for(let i=0;i<200;i++){if(predicate())return;await new Promise(resolve=>setTimeout(resolve,25));}throw Error('Weather load timeout');};
try {
  const panel=document.getElementById('editor'),canvas=document.createElement('canvas');panel.append(canvas);
  const base=createSceneBase({THREE,panel,canvas});
  ok(base.scene.children.every(o=>!o.isLight),'scene initialization creates no implicit light');
  let time=10;
  const ctx=window.VRWorldContext={...base,THREE,panel,movementState:{paused:false,environment:{gasMaterialId:'EarthTroposphere',gasMaterialFile:'/MetaWorld/Materials/Gasses/EarthTroposphere.json'}},
    currentWorldDefinition:{metadata:{weather:{seed:991,cloudCoverage:1}}},temporalController:{getTimeSeconds:()=>time}};
  base.camera.position.set(0,90,0);base.camera.lookAt(0,95,-100);
  const stop=startRenderLoop(base.renderer,base.scene,base.camera,()=>{});
  await wait(()=>ctx.weatherController?.runtime?.renderer.regions.size>0);
  const runtime=ctx.weatherController.runtime;
  ok(base.scene.children.filter(o=>o.isLight).length===0,'cloud initialization creates no light');
  const lights=[new THREE.PointLight('#ffffff',2),new THREE.DirectionalLight('#ffffff',1)];base.scene.add(...lights);
  await wait(()=>base.renderer.info.render.triangles>0);
  base.scene.remove(...lights);time=20;await wait(()=>runtime.time===20);
  ok(ctx.weatherController.runtime===runtime,'removing declared illumination preserves weather');
  ctx.movementState.paused=true;time=30;await new Promise(resolve=>setTimeout(resolve,80));ok(runtime.time===20,'paused clock input does not advance clouds');
  ctx.movementState.paused=false;
  ctx.movementState.environment={gasMaterialId:'vacuum',gasMaterialFile:'/MetaWorld/Materials/Gasses/vacuum.json'};
  await wait(()=>!ctx.weatherController.runtime);ok(!runtime.renderer.root.parent,'atmosphere switch releases clouds');
  stop();ok(!ctx.weatherController,'loop teardown releases weather ownership');base.renderer.dispose();
  document.getElementById('result').textContent='PASS: normal Game View clouds, declared lighting independence, pause, atmosphere switching and cleanup';
} catch(error){document.getElementById('result').textContent='FAIL: '+error.stack;}
