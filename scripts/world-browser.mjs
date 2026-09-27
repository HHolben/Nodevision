// Nodevision/scripts/world-browser.mjs
// Runs the real world loader, layer bridge, math-plane renderer, collision sampler, and save path with an in-memory HTML backend.
import * as THREE from '/lib/three/three.module.js';
import { createDefaultHtmlWorld } from '/MetaWorld/DefaultHtmlWorld.mjs';
import { getActiveMetaWorldLayerBridge } from '/MetaWorld/MetaWorldLayerState.mjs';
import { loadWorldFromFile, updateIframeObjectOverlays } from '/PanelInstances/ViewPanels/GameViewDependencies/worldLoading.mjs';
import { saveCurrentWorldFile } from '/PanelInstances/ViewPanels/GameViewDependencies/worldSave.mjs';
import { installTerrainGroundAbility } from '/PanelInstances/ViewPanels/GameViewDependencies/Abilities/MovementAbilities/TerrainGroundAbility.mjs';
import { createCollisionChecker } from '/PanelInstances/ViewPanels/GameViewDependencies/collisionCheck.mjs';
import { checkWorldPause } from './world-pause-browser.mjs';
const ok = (v,m) => { if (!v) throw Error(m); };
const equal = (a,b,m) => ok(a === b, `${m}: ${a} !== ${b}`);
const tick = () => new Promise(r => setTimeout(r, 50));
window.addEventListener('unhandledrejection', e => document.getElementById('result').textContent = `FAIL: ${e.reason?.stack || e.reason}`);
try {
 window.NodevisionState = {currentMode:'Virtual World Editing'};
 window.alert = message => { throw Error(message); };
 const panel = document.getElementById('editor'), canvas = document.createElement('canvas'); panel.appendChild(canvas);
 const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(75, 1.6, .1, 1000);
 camera.rotation.set(.3,1.2,.2);
 const state = {currentWorldPath:'page.html'}, movementState = {playerMode:'creative', playerHeight:1.75, environment:{}, isGrounded:true};
 const context = window.VRWorldContext = {THREE, scene, camera, panel, canvas, state, movementState, ground:new THREE.Mesh(new THREE.PlaneGeometry(50,50),new THREE.MeshBasicMaterial()),
   objects:[], colliders:[], lights:[], portals:[], collisionActions:[], useTargets:[], spawnPoints:[], waterVolumes:[], measurementVisuals:[],
   controls:{getObject:()=>camera}, objectInspector:{inspectTarget: target => context.selected=target}};
 scene.add(context.ground);
 let definition = createDefaultHtmlWorld('page.html'), savedHtml = '';
 const originalFetch = window.fetch;
 window.fetch = async (url, options) => {
   if(url === '/api/load-world') return {ok:true,json:async()=>({worldDefinition:structuredClone(definition)})};
   if(url === '/Notebook/page.html') return {ok:true,text:async()=>'<html><body><h1>My page</h1></body></html>'};
   if(url === '/api/save') { savedHtml=JSON.parse(options.body).content; return {ok:true,json:async()=>({success:true})}; }
   return originalFetch(url,options);
 };
 await loadWorldFromFile('page.html',state,THREE); await tick();
 ok(!context.ground.parent,'legacy gray square removed from scene');
 equal(context.objects.length,2,'two ordinary objects'); equal(context.ground.visible,false,'old gray ground hidden');
 let plane=context.objects.find(o=>o.userData.equationCollider), page=context.objects.find(o=>o.userData.nvType==='iframe');
 ok(plane && page,'loader builds math plane and webpage');
 equal(plane.geometry.attributes.position.count,4,'infinite rendering uses only four vertices');
 equal(plane.position.y,0,'plane at y=0'); equal(page.position.z,-1,'page one meter forward');
 equal(camera.position.z,0,'player at origin'); equal(camera.position.y,1.75,'eye height');equal(camera.rotation.y,0,'new world resets prior yaw');equal(camera.rotation.x,0,'new world faces page level');
 equal(page.rotation.y,0,'page front faces +Z toward player');
 let bridge=getActiveMetaWorldLayerBridge();
 ok(bridge.selectObject('page-ground'),'plane selectable'); equal(context.selected,plane,'normal selection receives mesh');
 ok(bridge.selectObject('page-frame'),'iframe selectable'); equal(context.selected,page,'iframe shares selection path');
 updateIframeObjectOverlays({panel,THREE,objects:context.objects,camera});
 ok(page.userData.iframeOverlay.element.style.transform.startsWith('matrix3d('),'webpage uses perspective projection');
 equal(page.userData.iframeOverlay.frame.getAttribute('src'),'/Notebook/page.html','iframe loads webpage, not application or world runtime');
 const ray = new THREE.Raycaster(new THREE.Vector3(50000,5,50000),new THREE.Vector3(0,-1,0));
 ok(ray.intersectObject(plane).length,'plane selectable far beyond any finite geometry');
 const groundCtx={api:{},colliders:context.colliders,movementState,groundLevel:0,playerRadius:.35,stepHeight:.5};
 installTerrainGroundAbility(groundCtx);
 equal(groundCtx.api.sampleExpressionTerrainGroundLevel(camera.position),0,'analytic ground sample');
 const collision=createCollisionChecker({colliders:context.colliders,movementState,playerRadius:.35});
 ok(!collision(new THREE.Vector3(1,1.75,0)),'ground allows horizontal walking');
 bridge.recordObjectTransform(plane); plane.position.y=-2;
 equal(plane.userData.colliderRef.equation.d,2,'math collider follows translation');
 bridge.undo(); plane=context.objects.find(o=>o.userData.equationCollider); equal(plane.position.y,0,'undo plane move');
 bridge.redo(); plane=context.objects.find(o=>o.userData.equationCollider); equal(plane.position.y,-2,'redo plane move');
 page=context.objects.find(o=>o.userData.nvType==='iframe');
 bridge.recordObjectTransform(page); page.rotation.y=.4; page.position.x=2; page.scale.set(2,1,1);
 ok(await saveCurrentWorldFile({state,movementState,objects:context.objects,lights:[]}), 'real save succeeds');
 definition=JSON.parse(new DOMParser().parseFromString(savedHtml,'text/html').querySelector('script[type="application/json"]').textContent);
 ok(savedHtml.includes('My page'),'save preserves HTML webpage');
 await loadWorldFromFile('page.html',state,THREE); await tick();
 plane=context.objects.find(o=>o.userData.equationCollider);page=context.objects.find(o=>o.userData.nvType==='iframe');
 equal(plane.position.y,-2,'plane translation persists');equal(page.position.x,2,'iframe move persists');equal(page.rotation.y,.4,'iframe rotation persists');
 equal(page.geometry.parameters.width,4.8,'iframe resize persists');
 // Compile and draw the shader using the installed r128 renderer; no geometry rebuild between frames.
 const renderer=new THREE.WebGLRenderer({canvas}); renderer.setSize(320,200); camera.position.set(0,1.75,0);camera.lookAt(0,0,-2);
 renderer.render(scene,camera);renderer.render(scene,camera);
 ok(renderer.info.programs.every(p=>p.diagnostics?.runnable!==false),'infinite shader compiles');
 equal(plane.geometry.attributes.position.count,4,'render retains fixed geometry');
 const renderTarget = new THREE.WebGLRenderTarget(64,64), pixel = new Uint8Array(4);
 renderer.setRenderTarget(renderTarget);renderer.render(scene,camera);renderer.readRenderTargetPixels(renderTarget,32,4,1,1,pixel);
 ok(pixel[0]>150 && pixel[3]===255,'infinite shader actually draws ground pixels');
 renderer.setRenderTarget(null);renderTarget.dispose();renderer.dispose();
 bridge=getActiveMetaWorldLayerBridge();bridge.removeObjectLayer('page-ground');
 equal(context.colliders.length,0,'plane deletion removes collider');equal(groundCtx.api.sampleExpressionTerrainGroundLevel(camera.position),-Infinity,'no immortal ground after deletion');
 bridge.undo();ok(context.objects.some(o=>o.userData.equationCollider),'undo restores deleted plane');bridge.redo();
 bridge.removeObjectLayer('page-frame');equal(context.objects.length,0,'delete both ordinary objects');
 bridge.undo();ok(context.objects.some(o=>o.userData.nvType==='iframe'),'undo restores iframe');bridge.redo();
 await saveCurrentWorldFile({state,movementState,objects:context.objects,lights:[]});
 definition=JSON.parse(new DOMParser().parseFromString(savedHtml,'text/html').querySelector('script[type="application/json"]').textContent);
 await loadWorldFromFile('page.html',state,THREE);equal(context.objects.length,0,'deleted defaults never regenerate');equal(context.ground.visible,false,'gray ground stays absent');
 definition={objects:[]};await loadWorldFromFile('page.html',state,THREE);
 equal(context.objects.length,0,'legacy empty world gets no new default objects');equal(context.ground.parent,scene,'legacy floor restored on world switch');
 window.fetch=originalFetch;
 await checkWorldPause(panel,canvas);
 document.getElementById('result').textContent='PASS: real world load/select/move/rotate/resize/delete/undo/redo/save/reload, analytic infinite plane rendering/picking/collision, webpage source, deletion persistence, and scoped Escape/menu/input integration.';
} catch(error) {document.getElementById('result').textContent=`FAIL: ${error.stack}`;}
