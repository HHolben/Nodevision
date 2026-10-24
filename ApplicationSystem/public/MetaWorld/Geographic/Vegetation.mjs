// Nodevision/ApplicationSystem/public/MetaWorld/Geographic/Vegetation.mjs
// This adapter reuses both existing vegetation providers with explicit biome selection and approximate Mediterranean habitat parameters, without interpreting land-cover classes as surveyed tree species.
import { createTreePlacement } from '../ProceduralVoxelWorld/Features/TreePlacement.mjs';
import { createAegeanPlacement } from '../Aegean/PlantPlacement.mjs';
import { AEGEAN_BIOMES } from '../Aegean/Biomes.mjs';
import { geographicPoint } from './Definition.mjs';
import { sampleRaster } from './Coordinates.mjs';
export function geographicVegetation(base,def) {
  const generic=id=>id==='temperate'||id==='snowy-pine-forest';
  const trees=createTreePlacement(base,def.generator.seed);
  const forest={...trees,candidate(x,z){const f=trees.candidate(x,z);return f&&generic(base.getBiome(f.origin[0],f.origin[2]))?f:null;}};
  const environmentBase={...base,getEnvironment(x,z){
    const biome=AEGEAN_BIOMES.find(b=>b.id===base.getBiome(x,z)),height=base.getTerrainHeight(x,z);
    return {height,waterTop:0,sea:-10000,weights:height&&biome?[{biome,weight:1}]:[],slope:base.getSlope(x,z),moisture:biome?(biome.moisture[0]+biome.moisture[1])/2:.5,
      temperature:18,elevation:sampleRaster(def.geographic.elevation,...geographicPoint(def.geographic,x,z))??0,soil:'schist',exposure:.3,stream:false};
  }};
  const mediterranean=createAegeanPlacement(environmentBase,{...def,environment:{season:'summer',seasonMode:'manual',vegetationDensity:.35}});
  return [forest,mediterranean];
}
