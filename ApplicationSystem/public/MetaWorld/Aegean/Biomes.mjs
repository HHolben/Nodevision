// Nodevision/ApplicationSystem/public/MetaWorld/Aegean/Biomes.mjs
// This module defines reusable Mediterranean communities and continuously weighted habitat transitions for deterministic spatial placement.
const biome=(id,name,species,ground,moisture,slope)=>Object.freeze({id,name,species,ground,moisture,slope,climate:'mediterranean',elevation:[0,1500],soil:['limestone','schist','volcanic'],seasonalAppearance:'mediterranean',transition:'environment-weighted'});
export const AEGEAN_BIOMES=Object.freeze([
  biome('phrygana','Dry Aegean scrubland',{WildThyme:4,GreekSage:3,Rockrose:2,ThornyBurnet:2,DryGrass:4,RockTufts:2},'DryMediterraneanSoil',[0,.5],[0,2]),
  biome('maquis','Mediterranean maquis',{Mastic:4,KermesOak:2,Carob:1,Olive:1,StrawberryTree:1,MaquisShrub:3},'RockySoil',[.35,.8],[0,1]),
  biome('pine-woodland','Mediterranean pine woodland',{TurkishPine:3,AleppoPine:3,Juniper:1,Rosemary:2,SparseGrass:2},'PineNeedles',[.2,.7],[0,1]),
  biome('olive-terraces','Olive grove and abandoned terraces',{Olive:6,WildFig:1,Wildflowers:2,SparseGrass:3,Almond:1,Cypress:1,Anemone:1,Poppy:1},'TerraRossa',[.2,.6],[0,.4]),
  biome('coastal-cliffs','Rocky coastal cliffs',{Juniper:1,CoastalJuniper:2,WildThyme:1,SeaLavender:1},'PaleLimestone',[0,.5],[.3,3]),
  biome('dunes','Coastal dunes and coves',{DuneGrass:5,SeaHolly:2,CoastalJuniper:1,SeaLavender:1},'FineBeachSand',[0,.6],[0,.4]),
  biome('stream-valley','Seasonal stream valleys',{WildFig:2,BayLaurel:2,SpringGrass:5,TallGrass:3,Asphodel:1},'StreambedGravel',[.5,1],[0,.7]),
  biome('upland-oak','Upland oak woodland',{HolmOak:5,KermesOak:2,RockTufts:2},'LeafLitter',[.4,.8],[0,1]),
  biome('rocky-mountain','Rocky mountain terrain',{Juniper:1,ThornyBurnet:2,RockTufts:1},'FracturedLimestone',[0,.5],[.5,3]),
  biome('volcanic','Volcanic island terrain',{Spurge:2,WildThyme:2,Everlasting:2,SparseGrass:2},'VolcanicAsh',[0,.6],[0,2])
]);
export function biomeWeights(e,config) {
  const coast=Math.max(0,1-Math.abs(e.height-e.sea)/24),shelter=1-e.exposure;
  const weights=[.8*(1-e.moisture)+.15,e.moisture*shelter*1.4,Math.max(0,e.moisture-.2)*.8,
    e.cultural&&e.slope<.4?.9:0,coast*Math.min(1,e.slope)*2,coast*Math.max(0,1-e.slope*3),
    e.stream?1.5:0,config.uplandOak&&e.height>e.sea+60?e.moisture:0,
    config.mountains&&e.height>e.sea+100?.8:0,config.geology==='volcanic'?.8:0];
  const sum=weights.reduce((a,b)=>a+b,0);return weights.map((weight,i)=>({biome:AEGEAN_BIOMES[i],weight:weight/sum}));
}
export function chooseBiome(weights,value) {
  for(const entry of weights){value-=entry.weight;if(value<=0)return entry.biome;}
  return weights[weights.length-1].biome;
}
