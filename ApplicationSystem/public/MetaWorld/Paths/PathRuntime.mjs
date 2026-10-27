// Nodevision/ApplicationSystem/public/MetaWorld/Paths/PathRuntime.mjs
// This module renders physical paths using canonical terrain materials and the existing heightfield collision contract; editor handles and centerlines are transient and never serialized.
import {pathSurface} from './PathSurface.mjs';
import {pathMaterialId} from './PathClearance.mjs';
import {clearanceEnvelope} from './PathEnvelope.mjs';
import { validatePath } from './PathDefinition.mjs';
import { samplePath, ribbonForPath } from './PathGeometry.mjs';
import { resolveWorldObjectMaterial } from '../Materials/WorldObjectMaterialResolver.mjs';
import { createTerrainMaterial } from '../../PanelInstances/ViewPanels/GameViewDependencies/TerrainTool/terrainMaterial.mjs';
export function createPathObject(THREE, source, colliders, terrainHeight) {
  const def=validatePath(source), geometry=new THREE.BufferGeometry();
  const mesh=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color:'#80786b',side:THREE.DoubleSide}));
  mesh.position.fromArray(def.position);mesh.visible=def.visible;mesh.receiveShadow=true;
  let ribbon=null, surface=null, disposed=false, selected=false, helper=null,heightSampler=terrainHeight,support=null,supportOrigin=[0,0,0],showEnvelope=false;
  const proxy=new THREE.Mesh(new THREE.BufferGeometry(),mesh.material);
  function serialize(){return {...structuredClone(def),position:mesh.position.toArray(),visible:mesh.visible};}
  function helpers() {
    if(helper){mesh.remove(helper);helper.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});helper=null;}
    if(disposed||(!selected&&!showEnvelope)||!ribbon)return;
    helper=new THREE.Group();
    if(showEnvelope)helper.add(clearanceEnvelope(THREE,def,ribbon.samples,mesh.position.toArray()));
    const material=new THREE.LineBasicMaterial({color:0x10cadd,depthTest:false});
    const points=ribbon.samples.map(p=>new THREE.Vector3(p[0]-mesh.position.x,p[1]-mesh.position.y+.06,p[2]-mesh.position.z));
    helper.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),material));
    if(selected)def.controlPoints.forEach((p,i)=>{
      const handle=new THREE.Mesh(new THREE.SphereGeometry(.12,8,6),new THREE.MeshBasicMaterial({color:0xffdd44,depthTest:false}));
      handle.position.fromArray(p);
      if(def.elevationMode==='follow-terrain') {
        const y=heightSampler?.(p[0]+mesh.position.x,p[2]+mesh.position.z);
        if(Number.isFinite(y))handle.position.y=y-mesh.position.y;
      }
      handle.userData.pathPointIndex=i;handle.renderOrder=10;helper.add(handle);
    });
    helper.traverse(o=>{o.userData.runtimeGenerated=true;o.renderOrder=10;});mesh.add(helper);
  }
  function rebuild(sample=terrainHeight) {
    heightSampler=sample;
    const next=serialize();ribbon=ribbonForPath(next,samplePath(THREE,next,sample));
    proxy.geometry.dispose();proxy.geometry=new THREE.BufferGeometry();
    proxy.geometry.setAttribute('position',new THREE.Float32BufferAttribute(ribbon.vertices.flatMap(p=>p.map((n,i)=>n-mesh.position.toArray()[i])),3));proxy.geometry.setIndex(ribbon.triangles.flatMap(([a,b,c])=>[a,c,b]));
    updateSurface();
    helpers();return ribbon;
  }
  function updateSurface(){
    surface=pathSurface(ribbon,support,supportOrigin);const lift=def.terrainInteraction==='excavate'?0:.025;
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(surface.vertices.flatMap(p=>[p[0]-mesh.position.x,p[1]-mesh.position.y+lift,p[2]-mesh.position.z]),3));
    geometry.setAttribute('uv',new THREE.Float32BufferAttribute(surface.vertices.flatMap(p=>[p[0],p[2]]),2));
    geometry.setIndex(surface.triangles.flatMap(([a,b,c])=>[a,c,b]));geometry.computeVertexNormals();geometry.computeBoundingSphere();geometry.computeBoundingBox();
  }
  mesh.raycast=(ray,hits)=>{if(disposed||!mesh.visible)return;mesh.updateWorldMatrix(true,false);proxy.matrixWorld.copy(mesh.matrixWorld);proxy.material=mesh.material;const picked=[];proxy.raycast(ray,picked);for(const hit of picked)if(!support?.(hit.point.x,hit.point.z)?.suppressed)hits.push({...hit,object:mesh});};
  const materialId=def.terrainInteraction==='excavate'?pathMaterialId(def.surfaceMaterial):({dirt:'soil',paved:'stone'})[def.surfaceMaterial]||def.surfaceMaterial;
  const collider={type:'expression-heightfield',target:mesh,layerId:def.id,materialId,physicsMaterialId:materialId,
    sampleGroundY(x,z){return !disposed&&mesh.visible&&def.collision ? surface?.heightAt(x,z)+(def.terrainInteraction==='excavate'?0:.025) : NaN;}};
  const runtime={get ribbon(){return ribbon;},get surface(){return surface;},serialize,rebuild,
    setTerrainSupport(sample,origin){support=sample;supportOrigin=origin||[0,0,0];if(ribbon)updateSurface();},
    setClearancePreview(value){showEnvelope=!!value;helpers();},get showClearanceEnvelope(){return showEnvelope;},
    retainGeometry(){
      if(!ribbon)return;
      const next=serialize(),delta=next.position.map((n,i)=>n-ribbon.def.position[i]);
      ribbon=ribbonForPath(next,ribbon.samples.map(p=>p.map((n,i)=>n+delta[i])));updateSurface();helpers();
    },
    setSelected(value){selected=value&&!disposed;helpers();},get handles(){return helper?.children.filter(o=>Number.isInteger(o.userData.pathPointIndex))||[];},
    dispose(){if(disposed)return;disposed=true;selected=false;helpers();proxy.geometry.dispose();geometry.dispose();mesh.material.map?.dispose();mesh.material.dispose();const i=colliders.indexOf(collider);if(i>=0)colliders.splice(i,1);mesh.removeFromParent();}};
  Object.assign(mesh.userData,{nvType:'physical-path',metaWorldLayerId:def.id,pathRuntime:runtime,colliderRef:collider,isSolid:def.collision,breakable:true,placedByPlayer:true});
  // A temporary authored-elevation fallback also keeps orphaned follow-terrain paths selectable.
  if(def.elevationMode!=='follow-terrain'||terrainHeight)rebuild();
  else {
    const mode=def.elevationMode;def.elevationMode='authored';rebuild();def.elevationMode=mode;
    runtime.warning='Follow terrain is waiting for an underlying heightfield.';
  }
  colliders.push(collider);
  runtime.ready=resolveWorldObjectMaterial(materialId).then(entry=>{
    if(disposed)return false;
    const material=createTerrainMaterial(THREE,{...entry.rendering,kind:entry.rendering.terrainKind,...(def.surfaceMaterial==='paved'?{texture:'none',roughness:.8}:{})});material.side=THREE.DoubleSide;
    mesh.material.dispose();mesh.material=material;Object.assign(mesh.userData,{physicsMaterialId:entry.physicsMaterialId,physicsMaterialFile:entry.materialFile});return true;
  }).catch(error=>{runtime.materialError=error;return false;});
  return mesh;
}
