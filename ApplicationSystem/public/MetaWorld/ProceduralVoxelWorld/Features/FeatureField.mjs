// Nodevision/ApplicationSystem/public/MetaWorld/ProceduralVoxelWorld/Features/FeatureField.mjs
// This bounded spatial feature field separates deterministic placement from shape sampling and composes priorities without retaining a whole-world feature inventory.
import { drainSteps } from '../ProgressiveTerrain.mjs';
export function createFeatureField(providers,priority) {
  const cache=new Map(), neighborhoods=new Map();
  function* querySteps(min,max) {
    const found=[];
    for(let i=0;i<providers.length;i++){
      const p=providers[i],s=p.cellSize,r=p.reach;
      for(let z=Math.floor((min[2]-r)/s);z<=Math.floor((max[2]+r)/s);z++)for(let x=Math.floor((min[0]-r)/s);x<=Math.floor((max[0]+r)/s);x++){
        const key=`${i}:${x},${z}`;
        if(!cache.has(key)){
          if(cache.size>=512)cache.delete(cache.keys().next().value);
          cache.set(key,p.candidate(x,z));
        }
        yield;const f=cache.get(key);
        if(f&&f.min.every((v,a)=>v<max[a]&&f.max[a]>min[a]))found.push(f);
      }
    }
    return found;
  }
  const query=(min,max)=>drainSteps(querySteps(min,max));
  function sample(features,x,y,z) {
    let result=0;
    for(const f of features){
      if(x<f.min[0]||x>=f.max[0]||y<f.min[1]||y>=f.max[1]||z<f.min[2]||z>=f.max[2])continue;
      const material=f.sample(x,y,z);
      if(priority(material)>priority(result))result=material;
    }
    return result;
  }
  function at(x,y,z){
    const min=[x,y,z].map(v=>Math.floor(v/32)*32),key=min.join(',');
    if(!neighborhoods.has(key)){
      if(neighborhoods.size>=64)neighborhoods.delete(neighborhoods.keys().next().value);
      neighborhoods.set(key,query(min,min.map(v=>v+32)));
    }
    return sample(neighborhoods.get(key),x,y,z);
  }
  return { query,querySteps,sample,at,cacheStats:()=>({features:cache.size,neighborhoods:neighborhoods.size}),clear(){cache.clear();neighborhoods.clear();},get cacheSize(){return cache.size;} };
}
