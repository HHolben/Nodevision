// Nodevision/ApplicationSystem/public/MetaWorld/Aegean/PlantPlacement.mjs
// This provider places bounded Mediterranean plant features using reusable species definitions, weighted habitats and stable spatial seeds within the existing feature cache.
import { vegetationSeed } from './Regeneration.mjs';
import { AEGEAN_SPECIES_DATA } from './SpeciesData.mjs';
import { chooseBiome } from './Biomes.mjs';
import { hash, noise } from '../ProceduralVoxelWorld/SeededVoxelNoise.mjs';
import { broadleafParameters, sampleBroadleaf } from '../ProceduralVoxelWorld/Features/BroadleafShape.mjs';
import { VOXEL_MATERIAL_IDS } from '../ProceduralVoxelWorld/VoxelMaterialIds.mjs';
export const AEGEAN_SPECIES=Object.freeze(Object.fromEntries(AEGEAN_SPECIES_DATA.map(s=>[s.id,Object.freeze(s)])));
const index=id=>VOXEL_MATERIAL_IDS.indexOf(id);
export function plantParameters(species,seed,form=species.growthForms[0]) {
  const age=form==='young'?.55:form==='low-growing'?.45:form==='windswept'?.8:1;
  const tree=species.category==='tree',h=species.dimensions.height.map(v=>Math.max(1,Math.min(72,Math.round(v*4*age))));
  const crown=species.dimensions.crownDiameter.map(v=>Math.min(17,v*2*(form==='young'?.6:1)));
  const p=broadleafParameters(seed,{height:h,crown,trunk:tree?[.9,form==='ancient'?4:2]:[.2,.3],crookedness:form==='ancient'?3:1.5,branches:tree?6:0,branchStart:.25,branchRadius:tree?1.1:0});
  p.materials=[index(species.materials.wood),index(species.materials.bark),index(species.materials.leaf)];
  p.form=form;p.lean=(hash(12,19,seed)-.5)*(form==='windswept'?5:2);p.density=.75+hash(17,11,seed)*.25;
  if(species.id==='Cypress'&&form==='columnar')p.lobes=[{x:0,y:p.height*.6,z:0,rx:3,ry:p.height*.4,rz:3}];
  if(species.id.includes('Pine'))for(const l of p.lobes){l.ry*=.5;l.y=Math.min(p.height-l.ry,l.y+p.height*.1);}
  return p;
}
export function samplePlant(species,seed,p,x,y,z) {
  if(y<0||y>=p.height)return 0;
  const materials=p.materials??[index(species.materials.wood),index(species.materials.bark),index(species.materials.leaf)];
  x-=p.lean*y/p.height;
  if(species.category!=='tree') {
    const radius=p.crownRadius*(1-.6*y/p.height);
    if(x*x+z*z>radius*radius||hash(Math.floor(x)+y*37,Math.floor(z),seed)<.3)return 0;
    return materials[2];
  }
  if(p.form==='ancient'&&y<p.height*.35&&Math.hypot(x,z)<p.trunkRadius*.4)return 0;
  const value=sampleBroadleaf(x,y,z,seed,p,materials);
  return value===materials[2]&&hash(Math.floor(x)+y*13,Math.floor(z),seed)>p.density?0:value;
}
export function createAegeanPlacement(base,def) {
  const seed=def.generator.seed,c=def.environment;
  return {cellSize:20,reach:26,maxHeight:72,candidate(rx,rz){
    const centerX=rx*20+10,centerZ=rz*20+10;
    const revisedSeed=def.vegetationRevisions?.length?vegetationSeed(def,centerX,centerZ,base.getBiome(centerX,centerZ)):seed;
    const local=(hash(rx,rz,revisedSeed^7193)*2147483647)|0;
    const x=rx*20+4+Math.floor(hash(1,0,local)*12),z=rz*20+4+Math.floor(hash(2,0,local)*12);
    const e=base.getEnvironment(x,z);if(!e.weights.length||e.height<=e.waterTop||(c.seasonMode==='calendar'&&e.stream))return null;
    const cluster=noise(x/70,z/70,seed^7291);
    if(hash(3,0,local)>c.vegetationDensity*(.2+cluster*.8))return null;
    const biome=chooseBiome(e.weights,hash(4,0,local));
    const candidates=Object.entries(biome.species).filter(([id,w])=>w>0&&AEGEAN_SPECIES[id]);
    let pick=hash(5,0,local)*candidates.reduce((sum,[,w])=>sum+w,0),species;
    for(const [id,w] of candidates){pick-=w;if(pick<=0){species=AEGEAN_SPECIES[id];break;}}
    if(!species||e.slope>species.slopeTolerance||e.moisture<species.moistureRange[0]||e.moisture>species.moistureRange[1])return null;
    if(e.temperature<species.temperatureRange[0]||e.temperature>species.temperatureRange[1]||e.elevation<species.elevationRange[0]||e.elevation>species.elevationRange[1]||!species.soilPreferences.includes(e.soil))return null;
    if(e.height<e.sea+24&&e.exposure>species.coastalTolerance)return null;
    if(species.category==='flower'&&c.season!=='spring'&&hash(6,0,local)>.15)return null;
    if(species.id==='DryGrass'&&c.season!=='summer')species=AEGEAN_SPECIES.SpringGrass;
    const form=species.growthForms[Math.min(species.growthForms.length-1,Math.floor(hash(7,0,local)*species.growthForms.length))];
    const p=plantParameters(species,local,form),r=Math.ceil(p.crownRadius*1.4+Math.abs(p.lean)),y=e.height;
    if(x-r<0||z-r<0||x+r>=base.dimensions[0]||z+r>=base.dimensions[2]||y+p.height>=base.dimensions[1])return null;
    return {id:`aegean:${rx},${rz}`,species:species.id,seed:local,origin:[x,y,z],parameters:p,
      min:[x-r,y,z-r],max:[x+r+1,y+p.height,z+r+1],sample:(vx,vy,vz)=>samplePlant(species,local,p,vx-x,vy-y,vz-z)};
  }};
}
