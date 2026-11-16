// Ordinary authored mesh with analytic arrow/picking collision and transient target-local hit interpretation. The existing bow owns all flight and arrow residency.
import {targetDefinition,scoreLocal} from './Definition.mjs';
import {targetGeometry} from './Geometry.mjs';
import {boardIntersection} from './Intersection.mjs';
import {createTextObject} from '../Text/TextRuntime.mjs';
import {meshTerrainCollision} from '../TerrainRepresentation/MeshCollision.mjs';
export function createArcheryTarget(THREE,source,colliders=[],options={}){
 let def=targetDefinition(source),lease=targetGeometry(THREE,def),disposed=false,label=null,feedback=null,timer=null;
 const root=new THREE.Mesh(lease.geometry,lease.material),ray=new THREE.Raycaster(),a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3(),p=new THREE.Vector3();
 const previousMatrix=new Float64Array(16).fill(NaN),bounds=new THREE.Box3();let previousGeometry=null;
 function intersect(query){
  if(disposed||!root.visible)return null;root.updateWorldMatrix(true,false);let changed=previousGeometry!==root.geometry;for(let i=0;i<16;i++){changed ||=previousMatrix[i]!==root.matrixWorld.elements[i];previousMatrix[i]=root.matrixWorld.elements[i];}if(changed){bounds.copy(root.geometry.boundingBox).applyMatrix4(root.matrixWorld);previousGeometry=root.geometry;}if(bounds.distanceToPoint(query.ray.origin)>query.far||!query.ray.intersectsBox(bounds))return null;let hit=boardIntersection(THREE,root,def,query);
  if(def.showStand){const local=query.ray.clone().applyMatrix4(root.matrixWorld.clone().invert()),positions=root.geometry.attributes.position;
   for(let i=lease.standStart;i<positions.count;i+=3){a.fromBufferAttribute(positions,i);b.fromBufferAttribute(positions,i+1);c.fromBufferAttribute(positions,i+2);if(!local.intersectTriangle(a,b,c,false,p))continue;const world=p.clone().applyMatrix4(root.matrixWorld),distance=world.distanceTo(query.ray.origin);if(distance<query.near||distance>query.far||hit&&distance>=hit.distance)continue;const normal=THREE.Triangle.getNormal(a,b,c,new THREE.Vector3());hit={distance,point:world,localPoint:p.toArray(),object:root,root,part:'stand',face:{normal},normal:normal.clone().applyMatrix3(new THREE.Matrix3().getNormalMatrix(root.matrixWorld)).normalize()};}
  }return hit;
 }
 root.raycast=(query,hits)=>{const hit=intersect(query);if(hit)hits.push(hit);};
 const collider={type:'expression-heightfield',target:root,...meshTerrainCollision(THREE,root,()=>[root]),arrowSweep(start,end){const origin=new THREE.Vector3(...start),direction=new THREE.Vector3(...end).sub(origin),length=direction.length();if(!length)return null;ray.set(origin,direction.divideScalar(length));ray.near=0;ray.far=length;const hit=intersect(ray);return hit?{...hit,point:hit.point.toArray(),normal:hit.normal.toArray()}:null;}};
 root.userData={nvType:'archery-target',metaWorldLayerId:def.id,id:def.id,isSolid:true,breakable:true,placedByPlayer:true,preserveLocalTransform:true,colliderRef:collider};colliders.push(collider);
 function text(content,y,existing){const data={id:def.id+'-annotation',kind:'free-standing',content,position:[0,y,def.thickness/2+.01],rotation:[0,0,0],width:Math.max(def.diameter,1),height:.3,fontSize:.22,depth:0,color:'#29231d',background:'#f2ead8'};const mesh=existing||createTextObject(THREE,data);if(existing)mesh.userData.textRuntime.update(data);else{Object.assign(mesh.userData,{runtimeGenerated:true,excludeFromRaycast:true,noninteractive:true});root.add(mesh);}return mesh;}
 function update(source){
  const next=targetDefinition(source),newLease=targetGeometry(THREE,next);lease.release();lease=newLease;def=next;root.geometry=lease.geometry;root.material=lease.material;root.name=def.name;root.position.fromArray(def.position);root.rotation.set(...def.rotation);root.scale.fromArray(def.scale);root.visible=def.visible;
  if(def.label)label=text(def.label,def.faceHeight+def.diameter/2+.23,label);else if(label){label.userData.textRuntime.dispose();label=null;}if(feedback)feedback.visible=false;
 }
 const runtime={serialize(){return targetDefinition({...def,position:root.position.toArray(),rotation:root.rotation.toArray().slice(0,3),scale:root.scale.toArray(),visible:root.visible,hidden:!root.visible});},update,intersect,
  hit(impact){if(disposed||!def.enabled||impact.part!=='face')return null;const local=root.worldToLocal(new THREE.Vector3(...impact.point)).toArray();if(Math.abs(local[2]-def.thickness/2)>1e-5)return null;const normal=new THREE.Vector3(0,0,1).applyMatrix3(new THREE.Matrix3().getNormalMatrix(root.matrixWorld)).normalize();if(new THREE.Vector3(...impact.incomingVelocity).dot(normal)>=0)return null;const scored=scoreLocal(def,local);if(!scored)return null;
   const detail={...impact,...scored,targetId:def.id,targetLabel:def.label,greekLetter:def.greekLetter,point:[...impact.point],timestamp:Date.now()};const panel=options.panel||globalThis.window?.VRWorldContext?.panel;panel?.dispatchEvent(new CustomEvent('archery-target-hit',{detail}));
   if(def.feedback&&globalThis.document){feedback=text(`${scored.score} points`,def.faceHeight-def.diameter/2-.22,feedback);feedback.visible=true;clearTimeout(timer);timer=setTimeout(()=>{if(feedback){feedback.userData.textRuntime.dispose();feedback=null;}},1000);}return detail;
  },dispose(){if(disposed)return;disposed=true;globalThis.window?.VRWorldContext?.archeryBow?.flight.removeTarget(root);clearTimeout(timer);label?.userData.textRuntime.dispose();feedback?.userData.textRuntime.dispose();const i=colliders.indexOf(collider);if(i>=0)colliders.splice(i,1);lease.release();root.removeFromParent();},get ready(){return label?.userData.textRuntime.ready||Promise.resolve();},get disposed(){return disposed;}};
 root.userData.archeryTargetRuntime=runtime;update(def);return root;
}
