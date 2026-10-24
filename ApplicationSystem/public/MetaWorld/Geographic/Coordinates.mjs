// Nodevision/ApplicationSystem/public/MetaWorld/Geographic/Coordinates.mjs
// This module converts supported WGS84 regional coordinates to a common UTM meter grid and samples georeferenced raster snapshots without conflating sample centers with pixel corners.
import { rasterData } from './Snapshot.mjs';
import proj4 from '../../vendor/geographic/projection.mjs';
export const UTM = '+proj=utm +zone=34 +datum=WGS84 +units=m +no_defs';
const projection=proj4('EPSG:4326',UTM);
export const project = point => projection.forward(point);
export const unproject = point => projection.inverse(point);
export function rasterPoint(r, east, north) {
  const p = r.crs === 4326 ? unproject([east,north]) : [east,north];
  const origin=r.sourceOrigin??r.origin,window=r.window??[0,0];
  const values=[(p[0]-origin[0])/r.resolution[0]-r.offset-window[0],(p[1]-origin[1])/r.resolution[1]-r.offset-window[1]];
  return r.encoding?values.map(v=>Math.abs(v-Math.round(v))<1e-9?Math.round(v):v):values;
}
export function sampleRaster(r,east,north,nearest=false) {
  const [x,y]=rasterPoint(r,east,north), {width:w,height:h}=r,data=rasterData(r);
  if(nearest){
    const edge=r.offset===.5?.5:0;
    if(x< -edge||y< -edge||x>w-1+edge||y>h-1+edge)return null;
    const value=data[Math.min(h-1,Math.round(y))*w+Math.min(w-1,Math.round(x))];return Number.isFinite(value)?value:null;
  }
  if(x<0||y<0||x>w-1||y>h-1)return null;
  const x0=Math.floor(x),y0=Math.floor(y),x1=Math.min(x0+1,w-1),y1=Math.min(y0+1,h-1),tx=x-x0,ty=y-y0;
  const values=[data[y0*w+x0],data[y0*w+x1],data[y1*w+x0],data[y1*w+x1]],weights=[(1-tx)*(1-ty),tx*(1-ty),(1-tx)*ty,tx*ty];
  if(values.some((v,i)=>weights[i]>(r.encoding?0:1e-12)&&!Number.isFinite(v)))return null;
  return values.reduce((sum,v,i)=>sum+(Number.isFinite(v)?v:0)*weights[i],0);
}
export function inRing(point,ring) {
  let inside=false;
  for(let i=0,j=ring.length-1;i<ring.length;j=i++) {
    const [x,y]=point,[a,b]=ring[i],[c,d]=ring[j];
    if((b>y)!==(d>y)&&x<(c-a)*(y-b)/(d-b)+a)inside=!inside;
  }
  return inside;
}
export const inPolygon = (p,polygon) => inRing(p,polygon.rings[0])&&!polygon.rings.slice(1).some(r=>inRing(p,r));
