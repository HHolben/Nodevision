// Existing insertion bridge/camera workflow, with bounded authoritative footprint checks and no terrain generation outside source coverage.
import {ensureEditableMetaWorldBridge,readCameraPlacement} from '../../ToolbarJSONfiles/worldShapeWidget.mjs';
import {worldAuthoringAllowed} from '../WorldAuthoringPermissions.mjs';
import {terrainPointCovered} from '../ProceduralVoxelWorld/TerrainCoverage.mjs';
import {acquireTarget,surfaceHits} from '../../PanelInstances/ViewPanels/GameViewDependencies/RaycastingTeleporter/Target.mjs';
export function targetPlacement(ctx){
 const {THREE}=ctx,camera=ctx.panel?._vrViewController?.getActiveCamera?.()||ctx.camera,ray=new THREE.Raycaster();camera.updateWorldMatrix(true,false);ray.setFromCamera({x:0,y:0},camera);ray.far=30;
 let hit=acquireTarget(THREE,ray,ctx.objects.filter(o=>!o.userData.archeryTargetRuntime),ctx.colliders),fallback=new THREE.Vector3(...readCameraPlacement());
 const groundHit=()=>{const h=ctx.ground&&surfaceHits(THREE,ray,ctx.ground)[0];return h?{...h,root:ctx.ground,normal:h.face.normal.clone().applyMatrix3(new THREE.Matrix3().getNormalMatrix(h.object.matrixWorld)).normalize()}:null;};
 if(!hit)hit=groundHit();
 if(!hit){
  for(const root of ctx.objects){const r=root.userData.terrainRuntime,c=root.userData.colliderRef;if(!r)continue;const x=fallback.x,z=fallback.z;if(!r.generator.dimensions.infinite&&(x<root.position.x||z<root.position.z||x>=root.position.x+r.definition.size[0]||z>=root.position.z+r.definition.size[2]))continue;
   if(!terrainPointCovered(r,x,z)||!r.mapSampleReady([x,0,z]))throw Error('Choose terrain with valid, loaded source coverage.');const y=c.sampleGroundY(x,z);if(Number.isFinite(y)){hit={point:new THREE.Vector3(x,y,z),normal:new THREE.Vector3(0,1,0),root,collider:c,terrain:r};break;}
  }
  if(!hit){ray.set(new THREE.Vector3(fallback.x,fallback.y+16,fallback.z),new THREE.Vector3(0,-1,0));ray.far=116;hit=acquireTarget(THREE,ray,ctx.objects,ctx.colliders)||groundHit();}
 }
 if(!hit)throw Error('No supported surface for the target. Aim at the ground.');if(hit.normal.y<.65)throw Error('Choose a reasonably level ground surface.');
 const point=hit.point.clone(),normal=hit.normal.clone(),r=hit.root.userData.terrainRuntime,collider=hit.collider||hit.root.userData.colliderRef;
 const height=(x,z)=>{if(r&&(!terrainPointCovered(r,x,z)||!r.mapSampleReady([x,point.y,z])))return NaN;if(collider?.sampleGroundY)return collider.sampleGroundY(x,z,point.y+(hit.coarse?8:.55));const down=new THREE.Raycaster(new THREE.Vector3(x,point.y+1,z),new THREE.Vector3(0,-1,0),0,2);return surfaceHits(THREE,down,hit.root)[0]?.point.y;};
 const y=height(point.x,point.z);if(!Number.isFinite(y))throw Error('Authoritative ground is unavailable here.');point.y=y;
 const facing=camera.getWorldPosition(new THREE.Vector3()).sub(point).addScaledVector(normal,-camera.getWorldPosition(new THREE.Vector3()).sub(point).dot(normal));if(facing.lengthSq()<1e-8)facing.set(0,0,1).addScaledVector(normal,-normal.z);facing.normalize();const right=new THREE.Vector3().crossVectors(normal,facing).normalize(),matrix=new THREE.Matrix4().makeBasis(right,normal,facing),quaternion=new THREE.Quaternion().setFromRotationMatrix(matrix);
 for(const foot of [[-.42,0,.3],[.42,0,.3],[0,0,-.55]]){const p=new THREE.Vector3(...foot).applyQuaternion(quaternion).add(point),ground=height(p.x,p.z);if(!Number.isFinite(ground)||Math.abs(ground-p.y)>.15)throw Error('Target feet need continuous, reasonably level ground.');}
 return {position:point.toArray(),rotation:new THREE.Euler().setFromQuaternion(quaternion).toArray().slice(0,3)};
}
export async function insertArcheryTarget(){const ctx=window.VRWorldContext;if(!ctx||!worldAuthoringAllowed(ctx.movementState))return false;const bridge=await ensureEditableMetaWorldBridge();if(!bridge?.updateArcheryTarget)return false;const placement=targetPlacement(ctx),def=bridge.updateArcheryTarget(null,placement);ctx.objectInspector?.inspectTarget(ctx.objects.find(o=>o.userData.metaWorldLayerId===def.id));return def;}
