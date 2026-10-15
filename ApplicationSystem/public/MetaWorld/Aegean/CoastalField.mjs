// Nodevision/ApplicationSystem/public/MetaWorld/Aegean/CoastalField.mjs
// This module samples bounded island relief, shelves, drainage and environmental gradients in voxel coordinates without allocating a world-sized height map.
import { noise } from '../ProceduralVoxelWorld/SeededVoxelNoise.mjs';
import { biomeWeights, chooseBiome } from './Biomes.mjs';
export function createCoastalField(def,dimensions) {
  const c=def.environment,seed=def.generator.seed,sea=Math.round((c.seaLevel-(def.heightLimits?.min??0))*4);
  const n=(x,z,scale,salt)=>noise(x/scale,z/scale,seed^salt),cache=new Map(),rawCache=new Map();
  function rawHeight(x,z) {
    const u=(x/dimensions[0]-.5)*2,v=(z/dimensions[2]-.5)*2;
    const r=c.landform==='peninsula'?Math.hypot(u*.85,Math.max(0,v+.25)*.8):Math.hypot(u,v);
    const edge=.72+(n(x,z,Math.min(dimensions[0],dimensions[2])*.22,918)-.5)*.24-r;
    const inland=Math.max(0,Math.min(1,edge*4));
    const ridge=1-Math.abs(n(x,z,220,123)*2-1),relief=(12+ridge*48+n(x,z,65,819)*12)*(c.mountains?2:1);
    const cliff=inland>0&&inland<.8&&n(x,z,130,442)>.66?Math.floor(inland*4)*5:0;
    const height=Math.floor(sea+cliff+Math.max(-sea+2,edge*22)+inland*relief);
    return {height:Math.max(1,Math.min(dimensions[1]-2,height)),edge,inland};
  }
  function raw(x,z){
    const key=(x+2)+(z+2)*(dimensions[0]+4),cached=rawCache.get(key);
    if(cached?.x===x&&cached.z===z)return cached.value;
    const value=rawHeight(x,z);if(rawCache.size>=8192)rawCache.delete(rawCache.keys().next().value);
    rawCache.set(key,{x,z,value});return value;
  }
  function sample(x,z) {
    const key=x+z*dimensions[0],cached=cache.get(key);if(cached?.x===x&&cached.z===z)return cached.value;
    if(x<0||z<0||x>=dimensions[0]||z>=dimensions[2])return {height:0,sea,waterTop:0,slope:0,weights:[],surface:'PaleLimestone'};
    const r=raw(x,z),moisture=n(x,z,160,781),exposure=n(x,z,240,131);
    const slope=Math.max(Math.abs(raw(x+2,z).height-raw(x-2,z).height),Math.abs(raw(x,z+2).height-raw(x,z-2).height))/4;
    const stream=r.inland>.15&&Math.abs(n(x,z,180,739)-.5)<.018;
    const cultural=n(x,z,180,998)>.66;
    let height=r.height;if(stream)height=Math.max(sea+1,height-4);
    if(cultural&&slope<.4&&height>sea+8)height=Math.floor(height/4)*4;
    const e={...r,height,sea,slope,moisture,exposure,stream,cultural};
    e.cavern=def.generation?.caves!==false&&height>sea+5&&height<sea+30&&exposure>.45&&n(x,z,24,891)>.7?{floor:sea+1,ceiling:Math.min(dimensions[1]-1,sea+13),formation:false,passage:true,chamber:false}:null;
    e.weights=biomeWeights(e,c);e.biome=chooseBiome(e.weights,n(x,z,90,345));
    e.waterTop=def.generation?.water===false?0:Math.max(sea,stream&&c.season!=='summer'?height+2:0);
    const geology=c.geology==='mixed'?(n(x,z,260,885)>.6?'metamorphic':'limestone'):c.geology;
    e.temperature={spring:16,summer:28,autumn:20,winter:12}[c.season];
    e.elevation=(height-sea)*.25;
    e.soil=height<=sea+3?'sand':geology==='metamorphic'?'schist':geology==='volcanic'?'volcanic':'limestone';
    e.rock=geology==='volcanic'?'basalt':geology==='metamorphic'?'schist':'PaleLimestone';
    e.surface=height<=sea+3?(slope<.4?'FineBeachSand':'BeachPebbles'):slope>.8?e.rock:e.biome.ground;
    const depth=(e.waterTop-height)*.25;
    e.water=e.waterTop>sea?'AegeanStreamWater':depth>4?'AegeanDeepWater':e.surface==='FineBeachSand'?'AegeanShallowWater':'AegeanClearWater';
    if(e.surface==='DryMediterraneanSoil'&&c.season!=='summer'&&moisture>.4)e.surface='LivingMediterraneanGrass';
    if(cache.size>=4096)cache.delete(cache.keys().next().value);cache.set(key,{x,z,value:e});return e;
  }
  return {sample,clear:()=>{cache.clear();rawCache.clear();},sea};
}
