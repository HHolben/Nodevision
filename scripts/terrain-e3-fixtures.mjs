// Nodevision/scripts/terrain-e3-fixtures.mjs
// Deterministic analytic hills supply the same quantized authoritative source to Surface Nets and existing heightfield LOD. An excavation and added stone block exercise composed occupancy without changing the natural source.
export function surfaceFixture(name='gentle'){
 const slope=name==='steep'?.65:.16,analytic=(x,z)=>4+slope*x+.07*z+.25*Math.sin(z/9),height=(x,z)=>Math.floor(analytic((x+.5)*.25,(z+.5)*.25)*4),size=32;
 const base={dimensions:[128,256,128],getTerrainHeight:(x,z)=>x>=0&&z>=0&&x<128&&z<128?height(x,z):0,getWaterTop:()=>0,getCavern:()=>null};
 base.getVoxel=(x,y,z)=>y>=0&&y<base.getTerrainHeight(x,z)?1:0;
 const edited=name==='edited',getVoxel=(x,y,z)=>{
  if(edited&&x>=48&&x<72&&z>=40&&z<72&&y>=12)return 0;
  if(edited&&x>=76&&x<84&&z>=52&&z<60&&y>=20&&y<36)return 3;
  return base.getVoxel(x,y,z);
 };
 const sampler={kind:'procedural',sample:(x,z)=>({covered:x>=0&&z>=0&&x<size&&z<size,elevation:base.getTerrainHeight(Math.floor(x*4),Math.floor(z*4))*.25}),resolution:[.25,.25]};
 return {name,size,analytic,base,getVoxel,getRenderVoxel:getVoxel,getTerrainHeight:base.getTerrainHeight,getSolidHeight:base.getTerrainHeight,getWaterTop:()=>0,terrainSampler:sampler,dimensions:base.dimensions,definition:{size:[size,64,size],generation:{caves:false,water:false}}};
}
