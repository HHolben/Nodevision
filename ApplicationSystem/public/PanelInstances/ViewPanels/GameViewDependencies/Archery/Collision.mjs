// Authoritative source occupancy for unloaded cells; detailed polygonal triangles when resident. Never raycast distance tiles or vegetation proxies.
import {raycastCells} from '/MetaWorld/SessionVoxels/Raycast.mjs';
import {excluded,surfaceHits} from '../RaycastingTeleporter/Target.mjs';
export function createArrowSweep(ctx){
 const {THREE}=ctx,ray=new THREE.Raycaster(),from=new THREE.Vector3(),to=new THREE.Vector3();let queries=0;const colliderIndex=new Map(),references=new Set();
 function sweep(a,b){
  queries++;colliderIndex.clear();references.clear();for(const c of ctx.colliders){references.add(c);for(const root of [c?.target,c?.object3d])if(root&&!colliderIndex.has(root))colliderIndex.set(root,c);}
  from.fromArray(a);to.fromArray(b);const length=from.distanceTo(to);if(length<1e-10)return null;
  ray.set(from,to.sub(from).normalize());ray.near=0;ray.far=length;let best=null;
  const take=hit=>{if(hit&&hit.distance<=length&&(!best||hit.distance<best.distance))best=hit;};
  for(const root of ctx.objects){
   if(excluded(root))continue;const collider=references.has(root.userData?.colliderRef)?root.userData.colliderRef:colliderIndex.get(root);if(!collider||collider.solid===false||collider.enabled===false)continue;
   if(typeof collider.arrowSweep==='function'){take(collider.arrowSweep(a,b,{allowFallback:ctx.exactAnatomy!==true}));continue;}
   const runtime=root.userData?.terrainRuntime;
   if(runtime?.getVoxelMaterial){
    const origin=runtime.sessionOrigin(),uncertain={};
    const hit=raycastCells(a,ray.ray.direction.toArray(),cell=>{
     const p=cell.map((n,i)=>origin[i]+(n+.5)*.25);
     const d=runtime.definition;if(d?.worldExtent?.mode!=='infinite'&&!runtime.generator?.dimensions?.infinite&&d?.size&&(p[0]<root.position.x||p[2]<root.position.z||p[0]>=root.position.x+d.size[0]||p[2]>=root.position.z+d.size[2]))return 0;
     if(!runtime.materials?.length||!runtime.mapSampleReady(p)){uncertain.value=true;return 1;}
     // Polygonal resident chunks supply their true extracted triangles. Empty columns still use the authoritative source.
     const entry=runtime.manager.loaded.get(cell.map(n=>Math.floor(n/32)).join(','));
     if(runtime.representation==='polygonal'&&entry?.mesh?.visible&&!runtime.manager.invalidated.has(cell.map(n=>Math.floor(n/32)).join(',')))return 0;
     const material=runtime.getVoxelMaterial(...cell);return material?.collider?.solid===true?1:0;
    },{maxDistance:length,gridOrigin:origin});
    if(hit)take({distance:hit.distance,point:ray.ray.at(hit.distance,new THREE.Vector3()).toArray(),normal:hit.normal,root,object:root,terrain:true,uncertain:!!uncertain.value});
    if(runtime.representation==='polygonal'){
     root.updateWorldMatrix(true,false);const min=a.map((n,i)=>Math.floor((Math.min(n,b[i])-origin[i]-.25)/8)),max=a.map((n,i)=>Math.floor((Math.max(n,b[i])-origin[i]+.25)/8));
     for(let x=min[0];x<=max[0];x++)for(let y=min[1];y<=max[1];y++)for(let z=min[2];z<=max[2];z++){
      const key=[x,y,z].join(','),mesh=runtime.manager.loaded.get(key)?.mesh;if(!mesh?.visible||runtime.manager.invalidated.has(key))continue;mesh.updateWorldMatrix(true,false);const hits=[];THREE.Mesh.prototype.raycast.call(mesh,ray,hits);
      for(const h of hits){if(excluded(h.object)||!runtime.isSolidMaterial(h.face?.materialIndex??0))continue;take(convert(h,root,true));}
     }
    }
   }else for(const h of surfaceHits(THREE,ray,root))take(convert(h,root,false));
  }
  return best;
 }
 function convert(h,root,terrain){return {...h,point:h.point.toArray(),normal:h.face?.normal?.clone().applyMatrix3(new THREE.Matrix3().getNormalMatrix(h.object.matrixWorld)).normalize().toArray()||[0,0,0],root,terrain,uncertain:false};}
 return {sweep,get queries(){return queries;}};
}
