// Nodevision/ApplicationSystem/public/MetaWorld/Geographic/CropGeometry.mjs
// This module intersects requested regions, polygon holes and source coverage using polygon clipping, and densifies nonlinear transformed edges before calculating raster windows.
import clipping from '../../vendor/geographic/clipping.mjs';
import { project,unproject,rasterPoint,inPolygon } from './Coordinates.mjs';
export const intersection=(...polygons)=>clipping.intersection(...polygons);
export const rectangle=([a,b,c,d])=>[[[[a,b],[c,b],[c,d],[a,d],[a,b]]]];
export const geometryBounds=geometry=>{
  const b=[Infinity,Infinity,-Infinity,-Infinity];
  for(const polygon of geometry)for(const ring of polygon)for(const p of ring){b[0]=Math.min(b[0],p[0]);b[1]=Math.min(b[1],p[1]);b[2]=Math.max(b[2],p[0]);b[3]=Math.max(b[3],p[1]);}return b;
};
export const insideGeometry=(p,geometry)=>geometry.some(rings=>inPolygon(p,{rings}));
export function area(geometry) {
  const ringArea=r=>Math.abs(r.slice(1).reduce((sum,p,i)=>sum+(r[i][0]-r[0][0])*(p[1]-r[0][1])-(p[0]-r[0][0])*(r[i][1]-r[0][1]),0)/2);
  return geometry.reduce((sum,p)=>sum+ringArea(p[0])-p.slice(1).reduce((a,r)=>a+ringArea(r),0),0);
}
export function transformGeometry(geometry,transform,tolerance=.001,maxLength=100) {
  let count=0;
  const checked=p=>{if(!p.every(Number.isFinite))throw Error('Source coordinates cannot be projected into the supported region.');return p;};
  const convert=p=>checked(transform(p));
  function segment(a,b,pa,pb,depth=0) {
    const mid=a.map((v,i)=>(v+b[i])/2),pm=convert(mid),error=Math.hypot(...pm.map((v,i)=>v-(pa[i]+pb[i])/2));
    if(depth<20&&(error>tolerance||Math.hypot(pb[0]-pa[0],pb[1]-pa[1])>maxLength))return [...segment(a,mid,pa,pm,depth+1),...segment(mid,b,pm,pb,depth+1)];
    if(++count>131072)throw Error('Transformed boundary exceeds the geometry budget. Select a smaller source or simplify the polygon.');
    return [pb];
  }
  return geometry.map(p=>p.map(r=>{const result=[convert(r[0])];for(let i=1;i<r.length;i++)result.push(...segment(r[i-1],r[i],convert(r[i-1]),convert(r[i])));return result;}));
}
export function rasterToMeters(r,p) {
  const q=[r.origin[0]+(p[0]+r.offset)*r.resolution[0],r.origin[1]+(p[1]+r.offset)*r.resolution[1]];
  return r.crs===4326?project(q):q;
}
export const sourceCoverage=r=>transformGeometry(rectangle([0,0,r.width-1,r.height-1]),p=>rasterToMeters(r,p));
export const geographicBounds=g=>geometryBounds(transformGeometry(g,unproject,1e-9,.001));
export function planCrop(meta,settings) {
  const crop=settings.crop.map(Number);
  if(crop.length!==4||!crop.every(Number.isFinite)||crop[0]<18||crop[2]>24||crop[1]<0||crop[3]>84||crop[0]>=crop[2]||crop[1]>=crop[3])throw Error('Use west,south,east,north within 18–24°E and 0–84°N.');
  const source=sourceCoverage(meta),boundary=settings.regions?.find(r=>r.id===settings.boundary);
  if(settings.boundary&&!boundary)throw Error('Selected crop polygon is missing.');
  let requested=transformGeometry(rectangle(crop),project);
  if(boundary)requested=intersection(requested,[boundary.rings]);
  const effective=intersection(requested,source),overlap={source,requested,effective,crop,coverageBounds:geographicBounds(source)};
  if(!effective.length||area(effective)<.01)throw Object.assign(Error('No usable overlap between crop, polygon and source coverage. Adjust the crop.'),{diagnostic:overlap});
  const outside=clipping.difference(requested,source);
  if(area(outside)>.001&&!settings.fitCoverage)throw Object.assign(Error('Requested terrain extends outside elevation coverage. Review the overlap and choose Fit to available coverage, or adjust the crop.'),{diagnostic:{...overlap,code:'COVERAGE',outside}});
  // The densified raster-space polygon is saved and becomes the exact V2 inclusion test.
  const raster=intersection(transformGeometry(effective,p=>rasterPoint(meta,...p),1e-7,16),rectangle([0,0,meta.width-1,meta.height-1]));
  const bounds=geometryBounds(raster),window=[Math.max(0,Math.floor(bounds[0])),Math.max(0,Math.floor(bounds[1])),Math.min(meta.width,Math.ceil(bounds[2])+1),Math.min(meta.height,Math.ceil(bounds[3])+1)];
  const local=raster.map(p=>p.map(r=>r.map(([x,y])=>[x-window[0],y-window[1]])));
  const generated=transformGeometry(raster,p=>rasterToMeters(meta,p));
  return {...overlap,effective:generated,raster,local,window,bounds:geometryBounds(generated)};
}
