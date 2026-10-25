// Nodevision/ApplicationSystem/public/MetaWorld/Paths/PathTerrainField.mjs
// Derives bounded excavation, floor materials, legacy grading and feature exclusions from path ribbons while retaining the upstream terrain sampler for restoration and follow-terrain paths.
import {pathColumn,applyPathColumn} from './PathClearance.mjs';
import {isLiquidVoxel} from '../ProceduralVoxelWorld/VoxelMaterialIds.mjs';
import { voxelIndex, chunkToVoxel, containsVoxel } from '../ProceduralVoxelWorld/VoxelCoordinates.mjs';
export function createPathTerrainField(base, definition) {
  let paths=[], cache=new Map(),nearby=new Map(),operations=new Map(),excavating=false;
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
  function upstream(x,y,z) {
    if(!containsVoxel([x,y,z],base.dimensions))return 0;
    const h=column(x,z);if(h===null)return base.getVoxel(x,y,z);
    if(y>=h)return 0;
    // The upper roadbed is solid fill; deeper unchanged geology and caves remain intact.
    if(y>=h-4||y>=base.getTerrainHeight(x,z))return 2;
    return base.getVoxel(x,y,z);
  }
  function modifiers(x,z){
    if(!excavating)return [];
    const key=`${x},${z}`;if(operations.has(key))return operations.get(key);
    const list=candidates(origin[0]+(x+.5)*.25,origin[2]+(z+.5)*.25).filter(p=>p.def.terrainInteraction==='excavate').map(p=>pathColumn(p,x,z,origin,upstream)).filter(Boolean);
    if(operations.size>=8192)operations.clear();operations.set(key,list);return list;
  }
  const applyExcavation=(x,y,z,value)=>applyPathColumn(modifiers(x,z),y,value);
  const getVoxel=(x,y,z)=>containsVoxel([x,y,z],base.dimensions)?applyExcavation(x,y,z,upstream(x,y,z)):0;
  function solidHeight(x,z,max=Infinity){
    if(!modifiers(x,z).length)return column(x,z)??base.getSolidHeight(x,z,max);
    const solid=y=>{const id=getVoxel(x,y,z);return id!==0&&!isLiquidVoxel(id);};
    for(let y=Math.min(base.dimensions[1],Math.floor(max),Math.max(base.getTerrainHeight(x,z),column(x,z)||0));y>0;y--)if(solid(y-1)&&!solid(y))return y;
    return 0;
  }
  function pathSupport(path,wx,wz){
    const x=Math.floor((wx-origin[0])/.25),z=Math.floor((wz-origin[2])/.25);
    if(x<0||z<0||x>=base.dimensions[0]||z>=base.dimensions[2])return null;
    const op=pathColumn(path,x,z,origin,upstream),final=op?.supported?getVoxel(x,op.floor,z):0;return op?.supported&&final!==0&&!isLiquidVoxel(final)?{height:origin[1]+op.top*.25,origin:origin.slice()}:null;
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
      return p.def.terrainInteraction!=='excavate'&&p.def.proceduralExclusion&&x>=b.minX-radius&&x<=b.maxX+radius&&z>=b.minZ-radius&&z<=b.maxZ+radius&&p.nearest(x,z,limit).distance<=limit;});
  }
  return {...base, base, cacheStats:()=>({...base.cacheStats?.(),pathColumns:cache.size,pathLookupTiles:nearby.size,pathModifiers:operations.size}), getVoxel, generateChunk, excludesFeature,applyExcavation,pathSupport,get hasExcavation(){return excavating;},
    getPathMin:(x,z)=>modifiers(x,z).reduce((n,op)=>Math.min(n,op.floor,op.low),Infinity),
    setPathOrigin(position){origin.splice(0,3,...position);origin[1]+=definition.heightLimits?.min||0;cache.clear();nearby.clear();operations.clear();},
    setPathConstraints(next){paths=next.filter(p=>p.def.visible).slice().sort((a,b)=>a.def.id.localeCompare(b.def.id));excavating=paths.some(p=>p.def.terrainInteraction==='excavate');cache.clear();nearby.clear();operations.clear();},
    getTerrainHeight:(x,z)=>column(x,z) ?? base.getTerrainHeight(x,z),
    getSolidHeight:solidHeight,
    getWaterTop:(x,z)=>column(x,z)===null?base.getWaterTop(x,z):0,
    clearColumns(){cache.clear();nearby.clear();operations.clear();base.clearColumns();}};
}
