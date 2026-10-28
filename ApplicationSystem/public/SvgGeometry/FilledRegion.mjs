// Nodevision/ApplicationSystem/public/SvgGeometry/FilledRegion.mjs
// This module measures flattened filled contours using the existing polygon clipping dependency. Nonzero winding regions are partitioned by integer winding count so overlapping and nested opposite orientations cancel correctly without subtracting unrelated shapes.
import clipping from '../vendor/geographic/clipping.mjs';
import { hasSelfIntersection } from './SimpleContour.mjs';
import { distance } from './PathContours.mjs';
export function signedArea(ring) { const [x,y]=ring[0]||[0,0];return ring.reduce((s,p,i)=>{const q=ring[(i+1)%ring.length];return s+(p[0]-x)*(q[1]-y)-(q[0]-x)*(p[1]-y);},0)/2; }
export function ringLength(ring) {return ring.reduce((s,p,i)=>s+distance(p,ring[(i+1)%ring.length]),0);}
export function filledRegion(contours, rule='nonzero') {
  let regions=new Map();let parity=[];
  for(const {points} of contours){
    if(points.length<3)continue;
    if(hasSelfIntersection(points))throw Error('Self-intersecting subpaths are not supported');
    const area=signedArea(points); if(area===0)continue;
    const polygon=[[points]], sign=area<0?-1:1;
    if(rule==='evenodd'){parity=clipping.xor(parity,polygon);continue;}
    let remainder=polygon; const next=new Map();
    const add=(w,shape)=>{if(w && shape.length)next.set(w,next.has(w)?clipping.union(next.get(w),shape):shape);};
    for(const [w,shape] of regions){
      add(w,clipping.difference(shape,polygon));add(w+sign,clipping.intersection(shape,polygon));
      remainder=clipping.difference(remainder,shape);
    }
    add(sign,remainder);regions=next;
  }
  return rule==='evenodd'?parity:regions.size?clipping.union(...regions.values()):[];
}
export function regionMeasurements(region) {
  let area=0, perimeter=0;
  for(const polygon of region)polygon.forEach((ring,i)=>{area+=(i?-1:1)*Math.abs(signedArea(ring));perimeter+=ringLength(ring);});
  return {area,perimeter};
}
export { clipping };
