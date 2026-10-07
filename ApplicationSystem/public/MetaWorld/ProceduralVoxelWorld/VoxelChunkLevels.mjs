// Nodevision/ApplicationSystem/public/MetaWorld/ProceduralVoxelWorld/VoxelChunkLevels.mjs
// This module derives exact local surface and feature height ranges so mountain streaming skips buried interior chunks while retaining finite boundary faces.
export function createChunkLevelQuery(base,features){
  const cache=new Map();
  return (cx,cz)=>{
    const key=`${cx},${cz}`;if(cache.has(key))return cache.get(key);
    const [width,height,depth]=base.dimensions,x0=cx*32,z0=cz*32;
    let low=height,high=0;
    for(let z=Math.max(0,z0-1);z<Math.min(depth,z0+33);z++)for(let x=Math.max(0,x0-1);x<Math.min(width,x0+33);x++){
      const h=base.getTerrainHeight(x,z);low=Math.min(low,h-1);high=Math.max(high,h,base.getWaterTop(x,z));
    }
    for(const f of features.query([x0,0,z0],[x0+32,height,z0+32]))high=Math.max(high,f.max[1]);
    const edge=x0===0||z0===0||x0+32>=width||z0+32>=depth;
    const levels=new Set([0]),bottom=edge?0:Math.max(0,Math.floor((low-1)/32));
    for(let y=bottom;y<Math.ceil(Math.min(high,height)/32);y++)levels.add(y);
    const result=[...levels];if(cache.size>=512)cache.delete(cache.keys().next().value);cache.set(key,result);return result;
  };
}
