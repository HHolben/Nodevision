// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/GameViewDependencies/RaycastingTeleporter/Teleporter.test.mjs
// These regressions exercise real triangle targeting, existing collision checks, authoritative terrain preparation, and synchronized player travel. They reject intervening walls and unverified destinations without modifying world data.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '/lib/three/three.module.js';
import {acquireTarget} from './Target.mjs';
import {prepareDestination,resolveDestination,commitDestination} from './Destination.mjs';
import {createProceduralVoxelWorld} from '/MetaWorld/ProceduralVoxelWorld/ProceduralVoxelWorldRuntime.mjs';
import {voxelMaterialOptions} from '/MetaWorld/ProceduralVoxelWorld/VoxelMaterialTestFixtures.mjs';
function fixture(){const objects=[],colliders=[],player=new THREE.PerspectiveCamera(),state={playerHeight:1.75,velocityY:-3,isGrounded:false};return {THREE,objects,colliders,controls:{getObject:()=>player},movementState:state,playerRadius:.35,stepHeight:.5,api:{getWaterVolumeAtPosition:()=>null},vectorGravityVelocity:new THREE.Vector3(1,2,3)};}
function box(ctx,size,position,solid=true){const mesh=new THREE.Mesh(new THREE.BoxGeometry(...size),new THREE.MeshBasicMaterial());mesh.position.fromArray(position);mesh.updateMatrixWorld(true);ctx.objects.push(mesh);if(solid){const c={type:'box',box:new THREE.Box3().setFromObject(mesh)};ctx.colliders.push(c);mesh.userData.colliderRef=c;}return mesh;}
const ray=(point,direction)=>new THREE.Raycaster(new THREE.Vector3(...point),new THREE.Vector3(...direction).normalize(),0,500);
const aim=(ctx,r)=>acquireTarget(THREE,r,ctx.objects,ctx.colliders);
function cleanup(ctx){for(const o of ctx.objects){o.userData.terrainRuntime?.dispose();o.geometry?.dispose();o.material?.dispose();}}
test('nearest solid triangles block targets behind walls while decorations and helpers are ignored',()=>{
 const c=fixture(),floor=box(c,[10,1,10],[0,-.5,0]),decoration=box(c,[2,1,2],[0,3,0],false),helper=box(c,[2,1,2],[0,6,0]);helper.userData.isEditorHelper=true;
 assert.equal(aim(c,ray([0,10,0],[0,-1,0])).root,floor);
 const wall=box(c,[5,6,1],[0,2,4]),hit=aim(c,ray([0,2,10],[0,-.05,-1]));assert.equal(hit.root,wall);assert.equal(resolveDestination(c,hit).valid,false);
 assert.ok(decoration);cleanup(c);
});
test('standing offset uses avatar height and rejects ceilings, edges and water',()=>{
 const c=fixture();box(c,[10,1,10],[0,-.5,0]);let h=aim(c,ray([0,10,0],[0,-1,0]));const d=resolveDestination(c,h);assert.ok(d.valid);assert.equal(d.position.y,1.78);
 c.movementState.playerHeight=1.2;assert.equal(resolveDestination(c,h).position.y,1.23);
 c.api.getWaterVolumeAtPosition=()=>({});assert.equal(resolveDestination(c,h).valid,false);c.api.getWaterVolumeAtPosition=()=>null;
 const ceiling=box(c,[4,.3,4],[0,1,0]);assert.equal(resolveDestination(c,h).valid,false);c.colliders.pop();c.objects.pop();ceiling.geometry.dispose();ceiling.material.dispose();
 h=aim(c,ray([4.9,10,0],[0,-1,0]));assert.equal(resolveDestination(c,h).valid,false);cleanup(c);
});
test('cave floor support is queried below its ceiling and whole-body collision is enforced',()=>{
 const c=fixture(),floor=box(c,[10,1,10],[0,-.5,0]);box(c,[10,1,10],[0,3.5,0]);const hit=aim(c,ray([0,2,0],[0,-1,0]));assert.equal(hit.root,floor);assert.ok(resolveDestination(c,hit).valid);
 box(c,[1,1,1],[.4,.5,0]);assert.equal(resolveDestination(c,hit).valid,false);cleanup(c);
});
test('sloped collision surfaces remain bounded and steep normals are rejected',()=>{
 const c=fixture(),floor=box(c,[10,1,10],[0,-.5,0]);floor.rotation.z=.2;floor.updateMatrixWorld(true);c.colliders[0]={type:'expression-heightfield',target:floor,sampleGroundY:(x)=>Math.tan(.2)*x};
 const hit=aim(c,ray([0,8,0],[0,-1,0]));assert.ok(resolveDestination(c,hit).valid);hit.normal.set(1,.1,0).normalize();assert.equal(resolveDestination(c,hit).valid,false);cleanup(c);
});
test('coarse terrain resolves authoritative ground and world boundaries without requiring visual occupancy',async()=>{
 const c=fixture(),def={id:'terrain',type:'procedural-voxel-world',size:[256,64,256],position:[10,2,20],voxelSize:.25,generator:{id:'nodevision-terrain-v1',version:1,seed:42},chunks:{voxelsPerAxis:32,loadRadius:1},generation:{vegetation:false,caves:false,water:false}};
 const root=createProceduralVoxelWorld(THREE,def,c.colliders,voxelMaterialOptions),r=root.userData.terrainRuntime;c.objects.push(root);assert.ok(await r.ready);
 const end=performance.now()+5000;while(!r.lod.snapshot().tiles&&performance.now()<end)r.lod.update(new THREE.Vector3(90,40,100));assert.equal(r.manager.loaded.size,0);
 let hit,result;for(let z=65;z<96&&!result?.valid;z+=2)for(let x=65;x<96&&!result?.valid;x+=2){hit=aim(c,ray([x+10,100,z+20],[0,-1,0]));if(hit)result=resolveDestination(c,hit);}
 assert.ok(hit?.coarse);assert.ok(result.valid);await prepareDestination(c,hit,new AbortController().signal);const before=JSON.stringify(r.serialize());
 const orientation=c.controls.getObject().quaternion.clone();commitDestination(c,result);assert.deepEqual(c.controls.getObject().position,result.position);assert.ok(c.controls.getObject().quaternion.equals(orientation));assert.equal(c.movementState.velocityY,0);assert.equal(c.vectorGravityVelocity.length(),0);assert.equal(JSON.stringify(r.serialize()),before);
 hit.point.x=10.1;assert.equal(resolveDestination(c,hit).valid,false);cleanup(c);
});
test('map preparation waits for the shared source and observes cancellation or failure',async()=>{
 const c=fixture(),root=new THREE.Group();let resolve,requested;
 root.userData.terrainRuntime={manager:{},definition:{size:[100,40,100]},ready:Promise.resolve(true),map:{},generator:{pathFeatureReach:16},prepareMapRegion:b=>{requested=b;return new Promise(r=>resolve=r);}};c.objects.push(root);
 const signal=new AbortController(),work=prepareDestination(c,{point:new THREE.Vector3(20,10,20)},signal.signal);await new Promise(setImmediate);assert.ok(requested);signal.abort();await assert.rejects(work,{name:'AbortError'});resolve();
 root.userData.terrainRuntime.prepareMapRegion=async()=>{throw Error('Unavailable map');};await assert.rejects(prepareDestination(c,{point:new THREE.Vector3(20,10,20)},new AbortController().signal),/Unavailable map/);
});
test('triangle collision placement includes the existing capsule radius below nominal feet',()=>{
 const c=fixture(),floor=box(c,[10,1,10],[0,-.5,0]);
 const v=(x,z)=>new THREE.Vector3(x,0,z),collider={type:'compound',target:floor,worldTriangles:[[v(-5,-5),v(-5,5),v(5,5)],[v(-5,-5),v(5,5),v(5,-5)]]};
 c.colliders=[collider];floor.userData.colliderRef=collider;
 const result=resolveDestination(c,aim(c,ray([0,10,0],[0,-1,0])));
 assert.ok(result.valid);assert.equal(result.position.y,1.75+.35+.03);assert.equal(result.groundY,0);cleanup(c);
});
