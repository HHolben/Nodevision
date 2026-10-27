// Nodevision/ApplicationSystem/public/MetaWorld/SessionVoxels/TerrainSession.mjs
// Extends the existing construction-composed generator; both mesh pipelines and analytic collision read the same opinions.
import {voxelIndex} from '../ProceduralVoxelWorld/VoxelCoordinates.mjs';
import {isLiquidVoxel} from '../ProceduralVoxelWorld/VoxelMaterialIds.mjs';
export function composeSession(base){
 let binding=null;
 const opinion=(x,y,z)=>binding?.session.opinion(binding.toCell([x,y,z]));
 const sample=(render,x,y,z)=>{const v=render&&binding?.session.renderOpinion?binding.session.renderOpinion(binding.toCell([x,y,z])):opinion(x,y,z);return v===undefined?(render?base.getRenderVoxel:base.getVoxel)(x,y,z):v===null?0:binding.material(v);};
 const getVoxel=(x,y,z)=>sample(false,x,y,z),getRenderVoxel=(x,y,z)=>sample(true,x,y,z);
 function patch(data,cx,cy,cz){if(!binding?.session.count)return data;const out=new Uint16Array(data);for(let y=0;y<32;y++)for(let z=0;z<32;z++)for(let x=0;x<32;x++){const at=[cx*32+x,cy*32+y,cz*32+z],v=binding.session.renderOpinion?binding.session.renderOpinion(binding.toCell(at)):opinion(...at);if(v!==undefined)out[voxelIndex(x,y,z)]=v===null?0:binding.material(v);}return out;}
 function levels(original,cx,cz){if(!binding?.session.count)return original;const result=new Set(original),a=binding.toCell([cx*32-1,0,cz*32-1]),b=binding.toCell([cx*32+32,0,cz*32+32]);for(let x=Math.floor(a[0]/32);x<=Math.floor(b[0]/32);x++)for(let z=Math.floor(a[2]/32);z<=Math.floor(b[2]/32);z++)for(const y of binding.session.column(x,z))for(let n=Math.floor((y*32-a[1]-1)/32);n<=Math.floor((y*32+32-a[1])/32);n++)if(n>=0&&n<Math.ceil(base.dimensions[1]/32))result.add(n);return [...result].sort((a,b)=>a-b);}
 return {...base,get season(){return base.season;},get hasConstructions(){return base.hasConstructions;},get hasSession(){return !!binding?.session.count;},persistent:base,getVoxel,getRenderVoxel,
  bindSession(value){binding=value;},
  getFeatureVoxel(x,y,z,list){return opinion(x,y,z)!==undefined?0:base.getFeatureVoxel(x,y,z,list);},
  getVoxelMaterialId(x,y,z){const v=opinion(x,y,z);return v===undefined?base.getVoxelMaterialId(x,y,z):v?.materialId||'air';},
  getSolidHeight(x,z,max=Infinity){if(!binding?.session.count)return base.getSolidHeight(x,z,max);const p=binding.toCell([x,0,z]);if(!binding.session.column(Math.floor(p[0]/32),Math.floor(p[2]/32)).length)return base.getSolidHeight(x,z,max);const solid=binding.solid||((n)=>n&&!isLiquidVoxel(n));for(let y=Math.min(base.dimensions[1],Math.floor(max));y>0;y--){const v=getVoxel(x,y-1,z),above=getVoxel(x,y,z);if(solid(v)&&!solid(above))return y;}return 0;},
  pathSupport(path,x,z){const height=path.heightAt(x,z);if(binding&&Number.isFinite(height)){const at=binding.fromWorld?.([x,height-1e-6,z]);if(at&&opinion(...at)!==undefined)return {height,suppressed:true};}return base.pathSupport?.(path,x,z);},
  generateChunk:(...c)=>patch(base.generateChunk(...c),...c),
  *generateChunkSteps(...c){const data=yield*base.generateChunkSteps(...c);yield;return patch(data,...c);},
  getChunkLevels:(x,z)=>levels(base.getChunkLevels(x,z),x,z),
  *getChunkLevelsSteps(x,z){return levels(yield*base.getChunkLevelsSteps(x,z),x,z);}
 };
}
