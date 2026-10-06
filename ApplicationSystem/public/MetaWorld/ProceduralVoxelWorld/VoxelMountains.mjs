// Nodevision/ApplicationSystem/public/MetaWorld/ProceduralVoxelWorld/VoxelMountains.mjs
// This module adds broad masked ridges to rolling V1 terrain and scales relief to finite world headroom instead of clipping mountain peaks.
import { noise } from './SeededVoxelNoise.mjs';
export const MOUNTAINS = Object.freeze({ regionScale:1024, regionSalt:700003, threshold:.56, transition:.3,
  ridgeScale:192, ridgeSalt:32452843, peakScale:384, peakSalt:49979687, relief:320, treeHeadroom:64, rollingMaximum:108 });
export function mountainStrength(x,z,seed){
  const p=MOUNTAINS,t=Math.max(0,Math.min(1,(noise(x/p.regionScale,z/p.regionScale,seed^p.regionSalt)-p.threshold)/p.transition));
  return t*t*(3-2*t);
}
export function mountainRelief(x,z,seed,verticalCells){
  const p=MOUNTAINS,mask=mountainStrength(x,z,seed);
  if(!mask)return 0;
  const available=Math.max(0,Math.min(p.relief,verticalCells-p.treeHeadroom-p.rollingMaximum));
  const ridge=1-Math.abs(2*noise(x/p.ridgeScale,z/p.ridgeScale,seed^p.ridgeSalt)-1);
  const peaks=noise(x/p.peakScale,z/p.peakScale,seed^p.peakSalt);
  return available*mask*(.3+.7*(.65*ridge+.35*peaks));
}
export function maximumTerrainHeight(verticalCells){
  return Math.min(verticalCells,MOUNTAINS.rollingMaximum+Math.max(0,Math.min(MOUNTAINS.relief,verticalCells-MOUNTAINS.treeHeadroom-MOUNTAINS.rollingMaximum)));
}
