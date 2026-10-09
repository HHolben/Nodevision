// Nodevision/ApplicationSystem/public/MetaWorld/ProceduralVoxelWorld/VoxelCaverns.mjs
// This module carves bounded chambers and walkable side passages with deterministic limestone stalactites and stalagmites anchored to their actual ceilings and floors.
import { hash } from './SeededVoxelNoise.mjs';
export function cavernColumn(x,z,surface,region,seed) {
  if (!region || region.kind==='cliff') return null;
  const cx=region.x+region.side*(region.width+58),cz=region.z;
  const distance=((x-cx)/52)**2+((z-cz)/68)**2;
  const chamber=distance<1;
  const passage=x>=Math.min(region.x,cx)&&x<=Math.max(region.x,cx)&&Math.abs(z-cz)<8;
  if(!chamber&&!passage)return null;
  const floor=region.floor;
  const ceiling=Math.floor(Math.min(surface-5,floor+(chamber?12+26*Math.sqrt(1-distance):16)));
  // The passage deliberately opens through the eroded valley wall rather than making a sealed underground bubble.
  const top=passage?Math.max(ceiling,floor+16):ceiling;
  if(top-floor<9)return null;
  const gx=Math.floor(x/12),gz=Math.floor(z/12);
  const centerX=gx*12+6,centerZ=gz*12+6,radial=Math.hypot(x-centerX,z-centerZ);
  const formation=chamber&&!passage&&hash(gx,gz,seed^77893)>.3;
  const length=Math.min((top-floor)*.38,6+hash(gx,gz,seed^8291)*10);
  return {floor,ceiling:top,formation,radial,length,chamber,passage};
}
export function sampleCavern(column,y) {
  if(!column||y<column.floor||y>=column.ceiling)return null;
  const {floor,ceiling,formation,radial,length}=column;
  if(formation){
    const up=y-floor,down=ceiling-1-y;
    if(up<length&&radial<=2.5*(1-up/length))return 4;
    if(down<length&&radial<=2.1*(1-down/length))return 4;
  }
  return 0;
}
