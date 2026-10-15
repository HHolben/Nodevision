// Nodevision/ApplicationSystem/public/MetaWorld/Aegean/AegeanDefinition.mjs
// This module validates the versioned environmental extension while leaving legacy terrain definitions and world-level calendar preferences intact.
export const AEGEAN_DEFAULTS = Object.freeze({id:'aegean',version:1,landform:'island',geology:'limestone',seaLevel:0,vegetationDensity:.65,season:'summer',seasonMode:'manual',uplandOak:false,mountains:false});
export function validateAegean(def) {
  if(def.environment === undefined)return;
  const e=def.environment,fail=message=>{throw Error('Aegean environment: '+message);};
  if(!e||e.id!=='aegean'||e.version!==1)fail('unavailable environment generator version; original definition must be retained.');
  if(!['island','peninsula'].includes(e.landform))fail('invalid landform');
  if(!['limestone','metamorphic','volcanic','mixed'].includes(e.geology))fail('invalid geology');
  if(!['spring','summer','autumn','winter'].includes(e.season))fail('invalid season');
  if(e.seasonMode!==undefined&&!['manual','calendar'].includes(e.seasonMode))fail('invalid season source');
  if(!Number.isFinite(e.vegetationDensity)||e.vegetationDensity<0||e.vegetationDensity>1)fail('density must be between 0 and 1');
  if(!Number.isFinite(e.seaLevel)||!Number.isInteger(e.seaLevel*4)||e.seaLevel<=(def.heightLimits?.min??0)||e.seaLevel>=(def.heightLimits?.max??def.size[1]))fail('sea level must be a quarter-meter value strictly inside height limits');
  for(const flag of ['uplandOak','mountains'])if(typeof e[flag]!=='boolean')fail('invalid '+flag);
  if(def.size[0]<32||def.size[2]<32||def.size[1]<16)fail('requires at least 32 × 32 m and 16 m of height');
}
