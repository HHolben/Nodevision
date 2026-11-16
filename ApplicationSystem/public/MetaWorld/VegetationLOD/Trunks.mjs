// Nodevision/ApplicationSystem/public/MetaWorld/VegetationLOD/Trunks.mjs
// Refine only the base envelope of distant upright voxel trunks from the authoritative composed sampler. Keep occupancy/IDs unchanged for polygonal extraction; do not thicken every thin branch into an extra metre-scale box.
import {featureMaterialPriority} from '../ProceduralVoxelWorld/VoxelMaterialIds.mjs';
export function* anchorVoxelTrunks(generator,region,cells,step,proceduralOutside){
 const groups=new Map();for(const c of cells){if(!groups.has(c.id))groups.set(c.id,[]);groups.get(c.id).push(c);}
 const covered=(x,z)=>{const s=generator.terrainSampler?.sample(x*.25,z*.25);return !s||!s.pending&&(s.covered||proceduralOutside);};
 for(const f of region.features){
  if(f.variant?.includes('fallen'))continue;const list=groups.get(f.id)||[],ys=new Set(list.filter(c=>featureMaterialPriority(c.material)>=2&&c.p[1]<f.origin[1]+8).map(c=>c.p[1]));
  for(const y of ys){
   const sample=(x,z)=>generator.getFeatureVoxel(x,y+Math.floor(step/2),z,[f]);
   if(featureMaterialPriority(sample(f.origin[0],f.origin[2]))<2)continue;
   const lo=[f.origin[0],f.origin[2]],hi=lo.map(n=>n+1);let bounded=true;
   for(let a=0;a<2;a++)for(const sign of [-1,1])for(let d=1;d<=4;d++){
    const p=[f.origin[0],f.origin[2]];p[a]+=sign*d;if(featureMaterialPriority(sample(...p))<2)break;if(d===4)bounded=false;if(sign<0)lo[a]=p[a];else hi[a]=p[a]+1;
   }
   if(!bounded)continue;
   if(![lo[0],hi[0]-1].every(x=>[lo[1],hi[1]-1].every(z=>covered(x,z))))continue;
   const base=list.filter(c=>c.p[1]===y&&featureMaterialPriority(c.material)>=2&&c.p[0]<hi[0]&&c.p[0]+step>lo[0]&&c.p[2]<hi[1]&&c.p[2]+step>lo[1]);
   const clippedLo=[Math.max(lo[0],region.min[0]),Math.max(lo[1],region.min[2])],clippedHi=[Math.min(hi[0],region.max[0]),Math.min(hi[1],region.max[2])];
   if(!base.length||clippedHi.some((v,a)=>v<=clippedLo[a]))continue;
   for(const c of base)c.voxelHidden=true;
   const bottom=Math.max(y,f.origin[1]),top=y+step;if(top<=bottom)continue;
   base[0].voxelHidden=false;base[0].voxelBox={p:[clippedLo[0],bottom,clippedLo[1]],size:[clippedHi[0]-clippedLo[0],top-bottom,clippedHi[1]-clippedLo[1]],material:sample(lo[0],f.origin[2])||base[0].material};
   yield;
  }
 }
}
export function voxelTrunkBoxes(cells){
 const ordinary=cells.filter(c=>!c.voxelHidden&&!c.voxelBox),trunks=cells.filter(c=>!c.voxelHidden&&c.voxelBox).map(c=>({...c,...c.voxelBox,size:c.voxelBox.size.slice()})).sort((a,b)=>a.p[1]-b.p[1]),last=new Map();
 for(const c of trunks){const key=[c.id,c.material,c.p[0],c.p[2],c.size[0],c.size[2]].join(':'),previous=last.get(key);if(previous&&previous.p[1]+previous.size[1]===c.p[1])previous.size[1]+=c.size[1];else{ordinary.push(c);last.set(key,c);}}
 return ordinary;
}
