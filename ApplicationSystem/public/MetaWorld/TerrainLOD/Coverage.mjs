// Nodevision/ApplicationSystem/public/MetaWorld/TerrainLOD/Coverage.mjs
// This module conservatively checks coarse cells against the existing geographic snapshot without resampling dense voxel columns. Raster samples are shared with the authoritative source, and boundary-touching or NoData cells remain excluded.
import {rasterData} from '../Geographic/Snapshot.mjs';
import {rasterPoint} from '../Geographic/Coordinates.mjs';
import {geographicPoint} from '../Geographic/Definition.mjs';
export function coarseCoverage(definition) {
  const g=definition.geographic;if(definition.terrainSource!=='geographic'||g?.version!==2)return null;
  const raster=g.elevation,data=rasterData(raster),edges=[];
  for(const polygon of g.effectiveRaster)for(const ring of polygon)for(let i=1;i<ring.length;i++){
    const a=ring[i-1],b=ring[i];edges.push([Math.min(a[0],b[0]),Math.min(a[1],b[1]),Math.max(a[0],b[0]),Math.max(a[1],b[1])]);
  }
  return (x,z,ex,ez)=>{
    const points=[[x,z],[x,ez],[ex,z],[ex,ez]].map(([u,v])=>rasterPoint(raster,...geographicPoint(g,Math.floor(Math.min(definition.size[0]-.125,u)/.25),Math.floor(Math.min(definition.size[2]-.125,v)/.25))));
    const lo=[Math.min(...points.map(p=>p[0])),Math.min(...points.map(p=>p[1]))],hi=[Math.max(...points.map(p=>p[0])),Math.max(...points.map(p=>p[1]))];
    // Reject boundary intersections conservatively, including small holes wholly inside a coarse cell.
    if(edges.some(e=>e[0]<hi[0]&&e[2]>lo[0]&&e[1]<hi[1]&&e[3]>lo[1]))return false;
    const min=lo.map(Math.floor),max=hi.map(Math.ceil);
    if(min[0]<0||min[1]<0||max[0]>=raster.width||max[1]>=raster.height)return false;
    for(let row=min[1];row<=max[1];row++)for(let col=min[0];col<=max[0];col++)if(!Number.isFinite(data[row*raster.width+col]))return false;
    return true;
  };
}
