// Nodevision/ApplicationSystem/public/MetaWorld/VegetationLOD/Sampling.mjs
// This module samples the authoritative feature shapes into aligned, material-preserving proxy cells. Placement is queried once per region and reused across visual levels; composed exclusions remain authoritative.
import {AEGEAN_SPECIES} from '../Aegean/PlantPlacement.mjs';
import {featureMaterialPriority} from '../ProceduralVoxelWorld/VoxelMaterialIds.mjs';
export function* vegetationRegion(generator,rx,rz){
 const min=[rx*128,0,rz*128],max=[min[0]+128,generator.dimensions[1],min[2]+128];
 const features=yield*generator.features.querySteps(min,max);
 return {rx,rz,features:features.filter(f=>!AEGEAN_SPECIES[f.species]||AEGEAN_SPECIES[f.species].category==='tree'),min,max};
}
export function* vegetationCells(generator,region,level,proceduralOutside=false){
 const step=level===1?2:4,cells=[],identities=new Map();
 for(const feature of region.features){
  const lo=feature.min.map((v,a)=>Math.max(region.min[a],Math.floor(v/step)*step)),hi=feature.max.map((v,a)=>Math.min(region.max[a],v));
  for(let z=lo[2];z<hi[2];z+=step)for(let y=lo[1];y<hi[1];y+=step){
   for(let x=lo[0];x<hi[0];x+=step){
    const p=[x,y,z].map(v=>v+Math.floor(step/2));
    let material=generator.getFeatureVoxel(...p,[feature]);
    // A narrow trunk can fall between coarse cell centres. Keep its authoritative axis visible.
    if(!material&&feature.origin[0]>=x&&feature.origin[0]<x+step&&feature.origin[2]>=z&&feature.origin[2]<z+step)
     material=generator.getFeatureVoxel(feature.origin[0],p[1],feature.origin[2],[feature]);
    if(!material)continue;
    // A session or construction opinion can suppress a feature without changing its placement.
    const source=generator.terrainSampler?.sample(p[0]*.25,p[2]*.25);
    if(source&&(source.pending||!source.covered&&!proceduralOutside))continue;
    const key=`${x},${y},${z}`;
    cells.push({key,p:[x,y,z],material,id:feature.id,chunk:[x,y,z].map(v=>Math.floor(v/32)).join(',')});
    identities.set(feature.id,{id:feature.id,species:feature.species,origin:feature.origin.slice(),variant:feature.variant||'living',seed:feature.seed});
   }yield;
  }
 }
 // Overlapping providers must not create duplicate proxy cells.
 const unique=new Map();for(const cell of cells){const old=unique.get(cell.key);if(!old||featureMaterialPriority(cell.material)>featureMaterialPriority(old.material))unique.set(cell.key,cell);}
 return {region,level,step,cells:[...unique.values()],identities:[...identities.values()]};
}
