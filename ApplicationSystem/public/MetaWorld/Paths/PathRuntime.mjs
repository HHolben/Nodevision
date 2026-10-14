// Nodevision/ApplicationSystem/public/MetaWorld/Paths/PathRuntime.mjs
// This module renders physical paths using canonical terrain materials and the existing heightfield collision contract; editor handles and centerlines are transient and never serialized.
import { validatePath } from './PathDefinition.mjs';
import { samplePath, ribbonForPath } from './PathGeometry.mjs';
import { resolveWorldObjectMaterial } from '../Materials/WorldObjectMaterialResolver.mjs';
import { createTerrainMaterial } from '../../PanelInstances/ViewPanels/GameViewDependencies/TerrainTool/terrainMaterial.mjs';
export function createPathObject(THREE, source, colliders, terrainHeight) {
  const def=validatePath(source), geometry=new THREE.BufferGeometry();
  const mesh=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color:'#80786b',side:THREE.DoubleSide}));
  mesh.position.fromArray(def.position);mesh.visible=def.visible;mesh.receiveShadow=true;
  let ribbon=null, disposed=false, selected=false, helper=null,heightSampler=terrainHeight;
  function serialize(){return {...structuredClone(def),position:mesh.position.toArray(),visible:mesh.visible};}
  function helpers() {
    if(helper){mesh.remove(helper);helper.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});helper=null;}
    if(!selected||!ribbon)return;
    helper=new THREE.Group();
    const material=new THREE.LineBasicMaterial({color:0x10cadd,depthTest:false});
    const points=ribbon.samples.map(p=>new THREE.Vector3(p[0]-mesh.position.x,p[1]-mesh.position.y+.06,p[2]-mesh.position.z));
    helper.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),material));
    def.controlPoints.forEach((p,i)=>{
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
    const positions=ribbon.vertices.flatMap(p=>[p[0]-mesh.position.x,p[1]-mesh.position.y+.025,p[2]-mesh.position.z]);
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
    geometry.setAttribute('uv',new THREE.Float32BufferAttribute(ribbon.vertices.flatMap(p=>[p[0],p[2]]),2));
    geometry.setIndex(ribbon.triangles.flatMap(([a,b,c])=>[a,c,b]));geometry.computeVertexNormals();geometry.computeBoundingSphere();geometry.computeBoundingBox();
    helpers();return ribbon;
  }
  const collider={type:'expression-heightfield',target:mesh,layerId:def.id,materialId:def.surfaceMaterial,physicsMaterialId:def.surfaceMaterial,
    sampleGroundY(x,z){return !disposed&&mesh.visible&&def.collision ? ribbon?.heightAt(x,z)+.025 : NaN;}};
  const runtime={get ribbon(){return ribbon;},serialize,rebuild,
    retainGeometry(){
      if(!ribbon)return;
      const next=serialize(),delta=next.position.map((n,i)=>n-ribbon.def.position[i]);
      ribbon=ribbonForPath(next,ribbon.samples.map(p=>p.map((n,i)=>n+delta[i])));helpers();
    },
    setSelected(value){selected=value&&!disposed;helpers();},get handles(){return helper?.children.filter(o=>o.isMesh)||[];},
    dispose(){if(disposed)return;disposed=true;selected=false;helpers();geometry.dispose();mesh.material.map?.dispose();mesh.material.dispose();const i=colliders.indexOf(collider);if(i>=0)colliders.splice(i,1);mesh.removeFromParent();}};
  Object.assign(mesh.userData,{nvType:'physical-path',metaWorldLayerId:def.id,pathRuntime:runtime,colliderRef:collider,isSolid:def.collision,breakable:true,placedByPlayer:true});
  // A temporary authored-elevation fallback also keeps orphaned follow-terrain paths selectable.
  if(def.elevationMode==='authored'||terrainHeight)rebuild();
  else {
    const mode=def.elevationMode;def.elevationMode='authored';rebuild();def.elevationMode=mode;
    runtime.warning='Follow terrain is waiting for an underlying heightfield.';
  }
  colliders.push(collider);
  runtime.ready=resolveWorldObjectMaterial(def.surfaceMaterial).then(entry=>{
    if(disposed)return false;
    const material=createTerrainMaterial(THREE,{...entry.rendering,kind:entry.rendering.terrainKind});material.side=THREE.DoubleSide;
    mesh.material.dispose();mesh.material=material;Object.assign(mesh.userData,{physicsMaterialId:entry.physicsMaterialId,physicsMaterialFile:entry.materialFile});return true;
  }).catch(error=>{runtime.materialError=error;return false;});
  return mesh;
}
