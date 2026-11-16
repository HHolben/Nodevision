import {initToolbarWidget} from '/ToolbarJSONfiles/worldShapeWidget.mjs';
import {setupPanel} from '/PanelInstances/ViewPanels/GameView.mjs';
import {getActiveMetaWorldLayerBridge} from '/MetaWorld/MetaWorldLayerState.mjs';
import {installTranslateGizmoAbility} from '/PanelInstances/ViewPanels/GameViewDependencies/Abilities/InspectionModificationAbilities/TranslateGizmoAbility.mjs';
const check=(v,m)=>{if(!v)throw Error(m);},sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function wait(fn,label){const end=performance.now()+15000;while(!fn()){if(performance.now()>end)throw Error(label);await sleep(20);}}
try{
 window.NodevisionState={currentMode:'Virtual World Editing',virtualWorldMode:'creative'};
 const panel=document.getElementById('editor');Object.assign(panel.style,{width:'800px',height:'600px'});await setupPanel(panel,{filePath:'world.html'});check(await panel.worldReady,'World opens');const ctx=window.VRWorldContext,{THREE}=ctx,terrainRoot=ctx.objects.find(o=>o.userData.terrainRuntime),terrain=terrainRoot.userData.terrainRuntime;await terrain.ready;ctx.movementState.editorGravityEnabled=false;ctx.resume();
 const bridge=getActiveMetaWorldLayerBridge(),y=terrainRoot.userData.colliderRef.sampleGroundY(20,20);
 const camera=panel._vrViewController.getActiveCamera();ctx.controls.getObject().position.set(20,10,20);camera.lookAt(20,30,19);camera.updateWorldMatrix(true,false);
 const expected=camera.getWorldPosition(new THREE.Vector3()).add(camera.getWorldDirection(new THREE.Vector3()));
 const host=document.createElement('div');document.body.append(host);initToolbarWidget(host,{widgetKind:'gameObject'});[...host.querySelectorAll('button')].find(b=>b.textContent==='Brown Hare').click();await wait(()=>ctx.objects.some(o=>o.userData.mobRuntime),'Sky toolbar insertion');
 const skyHare=ctx.objects.find(o=>o.userData.mobRuntime);check(skyHare.position.distanceTo(expected)<.001,'Sky click places exactly one meter along view');ctx.objectInspector.hide();bridge.removeObjectLayer(skyHare.userData.id);host.remove();

 const def=bridge.updateMob(null,{position:[20,y,20],behavior:{enabled:false}}),root=ctx.objects.find(o=>o.userData.id===def.id),r=root.userData.mobRuntime;check(await r.ready,'GLB loads');ctx.controls.getObject().position.set(30,y+2,30);
 // Exercise the production translate pointer handlers. Picking/delta are deterministic adapters;
 // renderer, inspector holds, collider refresh, runtime ticks and terrain are production systems.
 const edit={THREE,camera:panel._vrViewController.getActiveCamera(),movementState:ctx.movementState,api:{createHandleSprite(group,handles,axis){const h=new THREE.Object3D();h.userData.axis=axis;group.add(h);handles.push(h);},ensureHoverListener(){},getPointerNdc:()=>new THREE.Vector2(),pointerDelta:()=>({dx:0,dy:-150}),updateColliderForTarget:()=>r.refresh()},raycaster:{setFromCamera(){},intersectObjects:handles=>[{object:handles[2]}]}};
 const tool=installTranslateGizmoAbility(edit);ctx.objectInspector.inspectTarget(root);tool.createTranslateGizmo(root);
 const event={button:0,clientX:0,clientY:0,preventDefault(){},stopPropagation(){}};tool.onTranslatePointerDown(event);tool.onTranslatePointerMove(event);tool.onTranslatePointerUp(event);await sleep(200);check(Math.abs(r.position[1]-(y+3))<.001,'Held at raised position');tool.disposeTranslateState();check(r.editing,'Inspector hold remains');ctx.objectInspector.hide();check(!r.editing,'Selection released');
 const released=r.position[1];await wait(()=>r.position[1]<released-.1,'Falls after release');await wait(()=>r.snapshot().grounded,'Lands on actual geographic terrain');const landed=r.position[1];check(Math.abs(landed-y)<.15,'Ground landing');check(Math.abs(root.userData.colliderRef.box.min.y-landed)<.001,'Collider follows landing');check(Math.abs(r.serialize().position[1]-(y+3))<.001,'Authored transform preserved');
 for(const mode of ['voxel','polygonal']){await terrain.setRepresentation(mode);root.position.y=y+4;r.refresh();await wait(()=>r.snapshot().grounded,'Lands in '+mode);check(Math.abs(r.position[1]-y)<.3,'Support in '+mode);}
 const metrics={passed:true,fixture:'Actual GameView geographic terrain and GLB; production translate handlers with deterministic picking/delta adapters',released,landed,authoredHome:r.serialize().position,representations:['voxel','polygonal'],skyToolbarInsertion:true,disabledBehaviorFalls:true,inspectorAndTranslateHolds:true};panel.cleanup();await fetch('/test/metrics',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(metrics)});document.getElementById('result').textContent='PASS: hare translate release gravity, inspector holds, actual terrain landing, collider, voxel/polygonal and authored pose';
}catch(e){document.getElementById('result').textContent='FAIL: '+e.stack;}
