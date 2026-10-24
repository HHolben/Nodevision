// Nodevision/ApplicationSystem/public/MetaWorld/Paths/PathTerrainField.mjs
// This module derives deterministic cut/fill columns and generated-feature exclusions from world-space path ribbons while retaining an unmodified terrain sampler for follow-terrain paths.
import { voxelIndex, chunkToVoxel, containsVoxel } from '../ProceduralVoxelWorld/VoxelCoordinates.mjs';
export function createPathTerrainField(base, definition) {
  let paths=[], cache=new Map(),nearby=new Map();
  const origin=definition.position.slice();origin[1]+=definition.heightLimits?.min || 0;
  function candidates(x,z,padding=0){
    const cx=Math.floor(x/64),cz=Math.floor(z/64),pad=Math.ceil(padding),key=`${cx},${cz},${pad}`;
    if(!nearby.has(key)){if(nearby.size>=128)nearby.delete(nearby.keys().next().value);
      nearby.set(key,paths.filter(p=>p.bounds.maxX>=cx*64-pad&&p.bounds.minX<=(cx+1)*64+pad&&p.bounds.maxZ>=cz*64-pad&&p.bounds.minZ<=(cz+1)*64+pad));}
    return nearby.get(key);
  }
  function column(x,z) {
    if(!paths.length)return null;
    const key=`${x},${z}`;if(cache.has(key))return cache.get(key);
    const wx=origin[0]+(x+.5)*.25,wz=origin[2]+(z+.5)*.25;
    let height=base.getTerrainHeight(x,z),changed=false;
    for(const path of candidates(wx,wz)) {
      const b=path.bounds;
      if(path.def.terrainInteraction!=='grade'||wx<b.minX||wx>b.maxX||wz<b.minZ||wz>b.maxZ)continue;
      const exact=path.heightAt(wx,wz),near=Number.isFinite(exact)?null:path.nearest(wx,wz);
      const distance=near?Math.max(0,near.distance-path.def.width/2):0,transition=path.def.transitionWidth;
      if(near&&(transition===0||distance>=transition))continue;
      let roadHeight=near?.height ?? exact;
      if(!near)for(const dx of [-.125,.125])for(const dz of [-.125,.125]) {
        const edge=path.heightAt(wx+dx,wz+dz);if(Number.isFinite(edge))roadHeight=Math.min(roadHeight,edge);
      }
      const t=near?distance/transition:0,weight=1-t*t*(3-2*t),target=(roadHeight-origin[1])/.25;
      height=height+(target-height)*weight;changed=true;
    }
    const result=changed?Math.max(1,Math.min(base.dimensions[1],Math.floor(height+1e-7))):null;
    if(cache.size>=8192)cache.clear();cache.set(key,result);return result;
  }
  function getVoxel(x,y,z) {
    if(!containsVoxel([x,y,z],base.dimensions))return 0;
    const h=column(x,z);if(h===null)return base.getVoxel(x,y,z);
    if(y>=h)return 0;
    // The upper roadbed is solid fill; deeper unchanged geology and caves remain intact.
    if(y>=h-4||y>=base.getTerrainHeight(x,z))return 2;
    return base.getVoxel(x,y,z);
  }
  function generateChunk(cx,cy,cz) {
    if(!paths.length)return base.generateChunk(cx,cy,cz);
    const min=chunkToVoxel([cx,cy,cz]),data=new Uint8Array(32**3);
    for(let z=0;z<32;z++)for(let x=0;x<32;x++)for(let y=0;y<32;y++)data[voxelIndex(x,y,z)]=getVoxel(min[0]+x,min[1]+y,min[2]+z);
    return data;
  }
  function excludesFeature(feature) {
    if(!feature)return false;
    const x=origin[0]+(feature.min[0]+feature.max[0])*.125,z=origin[2]+(feature.min[2]+feature.max[2])*.125;
    const radius=Math.hypot(feature.max[0]-feature.min[0],feature.max[2]-feature.min[2])*.125;
    return candidates(x,z,radius).some(p=>{const limit=p.def.width/2+p.def.transitionWidth+radius,b=p.bounds;
      return p.def.proceduralExclusion&&x>=b.minX-radius&&x<=b.maxX+radius&&z>=b.minZ-radius&&z<=b.maxZ+radius&&p.nearest(x,z,limit).distance<=limit;});
  }
  return {...base, base, cacheStats:()=>({...base.cacheStats?.(),pathColumns:cache.size,pathLookupTiles:nearby.size}), getVoxel, generateChunk, excludesFeature,
    setPathOrigin(position){origin.splice(0,3,...position);origin[1]+=definition.heightLimits?.min||0;cache.clear();nearby.clear();},
    setPathConstraints(next){paths=next.filter(p=>p.def.visible).slice().sort((a,b)=>a.def.id.localeCompare(b.def.id));cache.clear();nearby.clear();},
    getTerrainHeight:(x,z)=>column(x,z) ?? base.getTerrainHeight(x,z),
    getSolidHeight:(x,z,max)=>column(x,z) ?? base.getSolidHeight(x,z,max),
    getWaterTop:(x,z)=>column(x,z)===null?base.getWaterTop(x,z):0,
    clearColumns(){cache.clear();nearby.clear();base.clearColumns();}};
}
