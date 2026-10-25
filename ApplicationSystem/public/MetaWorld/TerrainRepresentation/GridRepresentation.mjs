// Nodevision/ApplicationSystem/public/MetaWorld/TerrainRepresentation/GridRepresentation.mjs
// Adapts a legacy polygonal terrain instance without changing its centered height grid, material, object identity or imported neighbors.
import {terrainData,gridHeight} from './TerrainData.mjs';
import {terrainRepresentation,prepareSteps} from './Representation.mjs';
import {gridVoxelSteps} from './GridVoxels.mjs';
import {meshTerrainCollision} from './MeshCollision.mjs';
export function installGridRepresentation(THREE,mesh){
  const original=mesh.geometry;let active='polygonal',revision=0,disposed=false;
  const collision=meshTerrainCollision(THREE,mesh,()=>[mesh]);
  const t=mesh.userData.terrain;let low=Infinity,high=-Infinity;for(const h of t.heights){low=Math.min(low,h);high=Math.max(high,h);}
  const runtime={
    data:terrainData(mesh,{kind:'height-grid',parameters:()=>mesh.userData.terrain,dimensions:[t.width,high-low,t.depth],seed:t.generator?.seed,sampleHeight:(x,z)=>gridHeight(mesh.userData.terrain,x,z),materials:()=>[mesh.material]}),
    get representation(){return active;},get sourceGeometry(){return original;},
    async setRepresentation(value,beforeCommit=()=>{},force=false){
      const next=terrainRepresentation(value,'polygonal'),job=++revision;if(disposed)return false;if(next===active&&!force)return true;
      const geometry=next==='polygonal'?original:await prepareSteps(gridVoxelSteps(THREE,mesh.userData.terrain),()=>!disposed&&job===revision);
      if(!geometry)return false;if(disposed||job!==revision){if(geometry!==original)geometry.dispose();return false;}
      try{beforeCommit();}catch(error){if(geometry!==original)geometry.dispose();throw error;}
      const old=mesh.geometry;mesh.geometry=geometry;active=next;mesh.userData.terrain.representation=next;
      if(old!==original)old.dispose();return true;
    },
    refresh(){revision++;if(active==='voxel')void runtime.setRepresentation('voxel',undefined,true).catch(error=>{runtime.representationError=error;});},
    dispose(){if(disposed)return;disposed=true;revision++;if(mesh.geometry!==original)original.dispose();},
    ...collision
  };
  mesh.userData.terrainRuntime=runtime;
  runtime.ready=runtime.setRepresentation(mesh.userData.terrain.representation??'polygonal').catch(error=>{runtime.representationError=error;console.error('Terrain representation failed:',error);return false;});
  return runtime;
}
