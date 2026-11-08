// Nodevision/ApplicationSystem/public/MetaWorld/TerrainLOD/Heightfield.mjs
// This resumable builder samples the existing metre-space source and composed surface without creating voxel volumes. Eight-metre sections permit independent handoff to detailed columns, with downward skirts covering resolution mismatches.
import {infiniteWorld} from '../ProceduralVoxelWorld/WorldExtent.mjs';
import {coarseCoverage} from './Coverage.mjs';
import { WATER_VOXEL } from '../ProceduralVoxelWorld/VoxelMaterialIds.mjs';
export function* heightfieldSteps(generator, definition, tx, tz, level, modified = () => false, refineCoverage = true) {
  const coverage=coarseCoverage(definition),step=level===1?2:8, sections=[], floor=definition.heightLimits?.min||0;
  const infinite=infiniteWorld(definition),width=infinite?(tx+1)*64:definition.size[0],depth=infinite?(tz+1)*64:definition.size[2], cache=new Map();
  function sample(x,z) {
    const key=`${x},${z}`;if(cache.has(key))return cache.get(key);
    // Sample the final interior cell on the outer boundary; never extend the footprint.
    const px=infinite?x:Math.min(width-.125,x),pz=infinite?z:Math.min(depth-.125,z);
    if(!infinite&&(x<0||z<0||x>width||z>depth))return null;
    let source=generator.terrainSampler.sample(px,pz);
    if(!source.covered&&!source.pending&&definition.terrainMap?.outside==='procedural')source={covered:true,elevation:floor+generator.getTerrainHeight(Math.floor(px/.25),Math.floor(pz/.25))*.25};
    if(!source.covered||source.pending||!Number.isFinite(source.elevation))return null;
    const vx=Math.floor(px/.25),vz=Math.floor(pz/.25),edited=modified(Math.floor(px/8),Math.floor(pz/8));
    let h=edited?floor+generator.getSolidHeight(vx,vz)*.25:source.elevation,y=Math.floor((h-floor)/.25);
    if(edited)while(y>0&&!generator.getRenderVoxel(vx,y-1,vz))y--;
    if(edited&&y<=0)return null;
    if(edited)h=floor+y*.25;
    const material=generator.getRenderVoxel(vx,y-1,vz)||3;
    const water=floor+generator.getWaterTop(vx,vz)*.25;
    const result={height:h,material,water:water>h?water:null,waterMaterial:water>h?generator.getRenderVoxel(vx,Math.floor((water-floor)/.25)-1,vz)||WATER_VOXEL:WATER_VOXEL};cache.set(key,result);return result;
  }
  function vertex(x,z,s,water=false) {
    const a=sample(infinite?x-.25:Math.max(0,x-.25),z),b=sample(infinite?x+.25:Math.min(width,x+.25),z),c=sample(x,infinite?z-.25:Math.max(0,z-.25)),d=sample(x,infinite?z+.25:Math.min(depth,z+.25));
    const nx=water?0:(a?.height??s.height)-(b?.height??s.height),nz=water?0:(c?.height??s.height)-(d?.height??s.height),length=Math.hypot(nx,.5,nz);
    return {p:[x,water?s.water:s.height,z],n:water?[0,1,0]:[nx/length,.5/length,nz/length]};
  }
  for(let bz=tz*64;bz<Math.min(depth,(tz+1)*64);bz+=8)for(let bx=tx*64;bx<Math.min(width,(tx+1)*64);bx+=8){
    const section={x:Math.floor(bx/8),z:Math.floor(bz/8),faces:[]},spacingStep=modified(Math.floor(bx/8),Math.floor(bz/8)) ? .25 : step;
    if(definition.generation?.caves!==false&&definition.terrainSource!=='geographic')for(let z=bz;z<Math.min(bz+8,depth);z+=2)for(let x=bx;x<Math.min(bx+8,width);x+=2)if(generator.getCavern?.(Math.floor(x/.25),Math.floor(z/.25)))section.requiresVolume=true;
    function* cell(x,z,ex,ez) {
      const points=[[x,z],[x,ez],[ex,ez],[ex,z]],samples=points.map(p=>sample(...p));
      let covered=samples.every(Boolean);
      const spacing=Math.max(.25,Math.min(step/2,...(generator.terrainSampler.resolution||[1])));
      if(covered&&coverage)covered=coverage(x,z,ex,ez);
      else if(generator.terrainSampler.kind!=='procedural'&&!['map','hybrid'].includes(definition.terrainSource))for(let v=z;covered&&v<=ez;v+=spacing)for(let u=x;covered&&u<=ex;u+=spacing)if(!sample(u,v))covered=false;
      if(!covered){
        // Refine coverage edges rather than leaving a whole coarse-cell border missing.
        if(refineCoverage&&Math.max(ex-x,ez-z)>.25&&(samples.some(Boolean)||sample((x+ex)/2,(z+ez)/2))){
          const mx=(x+ex)/2,mz=(z+ez)/2;
          yield*cell(x,z,mx,mz);yield*cell(mx,z,ex,mz);yield*cell(x,mz,mx,ez);yield*cell(mx,mz,ex,ez);
        }
        return;
      }
      if(Math.max(ex-x,ez-z)>.25&&samples.some(s=>s.water!==null)&&samples.some(s=>s.water===null)){const mx=(x+ex)/2,mz=(z+ez)/2;yield*cell(x,z,mx,mz);yield*cell(mx,z,ex,mz);yield*cell(x,mz,mx,ez);yield*cell(mx,mz,ex,ez);return;}
      const face=(water=false)=>{
        const vertices=points.map((p,i)=>vertex(...p,samples[i],water)),material=water?samples[0].waterMaterial:samples[0].material;
        section.faces.push({vertices,material});
        const heights=vertices.map(v=>v.p[1]),drop=Math.max(2,step,Math.max(...heights)-Math.min(...heights)+2);
        // Vertical skirts cover resolution mismatches without overlapping horizontal surfaces.
        for(const [a,b,boundary] of [[0,1,x===bx],[1,2,ez===Math.min(bz+8,depth)],[2,3,ex===Math.min(bx+8,width)],[3,0,z===bz]])if(boundary){
          const va=vertices[a],vb=vertices[b],lower=v=>({p:[v.p[0],v.p[1]-drop,v.p[2]],n:v.n});
          section.faces.push({vertices:[va,lower(va),lower(vb),vb],material});
        }
      };
      face();if(samples.every(s=>s.water!==null))face(true);yield;
    }
    for(let z=bz;z<Math.min(bz+8,depth);z+=spacingStep)for(let x=bx;x<Math.min(bx+8,width);x+=spacingStep)yield*cell(x,z,Math.min(x+spacingStep,bx+8,width),Math.min(z+spacingStep,bz+8,depth));
    sections.push(section);yield;
  }
  return {sections,level,tx,tz,coverageRefined:refineCoverage||generator.terrainSampler.kind==='procedural'};
}
