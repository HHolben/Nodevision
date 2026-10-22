// Nodevision/ApplicationSystem/public/MetaWorld/Paths/PathGeometry.mjs
// This module samples Three.js centripetal curves and builds unbanked horizontal-width ribbons with shared triangle-based height queries for terrain and player collision.
import { indexPathSegments } from './PathSegments.mjs';
export function samplePath(THREE, def, terrainHeight) {
  const points = def.controlPoints.map(p => new THREE.Vector3(...p).add(new THREE.Vector3(...def.position)));
  const length = points.slice(1).reduce((n,p,i) => n + p.distanceTo(points[i]),0);
  if (length > 4096) throw Error('Path length exceeds 4096 m. Split it into shorter paths.');
  const result = [];
  if(def.elevationMode==='locally-flat'&&points.length>2){const original=points.map(p=>p.y),strength=def.smoothing??.5;for(let i=1;i<points.length-1;i++)points[i].y=original[i]*(1-strength)+(original[i-1]+original[i+1])*.5*strength;}
  if (def.interpolation === 'smooth') {
    const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal');
    curve.arcLengthDivisions = Math.max(200, Math.ceil(length * 4));
    const count=Math.max(2,Math.ceil(length/.25)),strength=1-(def.smoothing||0)*.5;
    if(strength===1)result.push(...curve.getSpacedPoints(count).map(p=>p.toArray()));
    else for(let i=0;i<=count;i++){const t=i/count*(points.length-1),segment=Math.min(points.length-2,Math.floor(t)),linear=points[segment].clone().lerp(points[segment+1],t-segment);result.push(linear.lerp(curve.getPoint(i/count),strength).toArray());}
  } else {
    const curve=def.interpolation==='mixed'?new THREE.CatmullRomCurve3(points,false,'centripetal'):null;
    points.slice(1).forEach((p,i) => {
      const count = Math.max(1,Math.ceil(p.distanceTo(points[i]) / .25));
      for (let j=0;j<count;j++) result.push(curve&&def.segmentKinds?.[i]==='smooth'?points[i].clone().lerp(p,j/count).lerp(curve.getPoint((i+j/count)/(points.length-1)),1-(def.smoothing||0)*.5).toArray():points[i].clone().lerp(p,j/count).toArray());
    });
    result.push(points.at(-1).toArray());
  }
  if (def.elevationMode === 'follow-terrain') for (const p of result) {
    const height = terrainHeight?.(p[0],p[2]);
    if (!Number.isFinite(height)) throw Error('Follow terrain requires every path sample to lie within a terrain heightfield.');
    p[1] = height;
  }
  if(def.elevationMode==='follow-terrain'&&def.smoothing>0){const ys=result.map(p=>p[1]),radius=Math.max(1,Math.round(def.smoothing*16));for(let i=1;i<result.length-1;i++){let sum=0,n=0;for(let j=Math.max(0,i-radius);j<=Math.min(result.length-1,i+radius);j++){sum+=ys[j];n++;}result[i][1]=ys[i]*(1-def.smoothing)+sum/n*def.smoothing;}}
  for(const p of result)p[1]+=def.elevationOffset||0;
  return result;
}
const cross = (a,b,c) => (b[0]-a[0])*(c[2]-a[2])-(b[2]-a[2])*(c[0]-a[0]);
export function ribbonForPath(def, samples) {
  const vertices=[], triangles=[], half=def.width/2;
  for(let i=0;i<samples.length;i++) {
    const p=samples[i], a=samples[Math.max(0,i-1)], b=samples[Math.min(samples.length-1,i+1)];
    const dx=b[0]-a[0], dz=b[2]-a[2], length=Math.hypot(dx,dz);
    if(length<1e-6)throw Error('Path doubles back too sharply. Move the control points apart.');
    vertices.push([p[0]-dz/length*half,p[1],p[2]+dx/length*half], [p[0]+dz/length*half,p[1],p[2]-dx/length*half]);
    if(i) {
      const n=i*2;
      for(const tri of [[n-2,n-1,n],[n-1,n+1,n]]) {
        if(cross(...tri.map(j=>vertices[j])) <= 1e-8) throw Error('Path is too wide for this turn. Reduce width or soften the curve.');
        triangles.push(tri);
      }
    }
  }
  const padding=def.transitionWidth+1, bounds={minX:Infinity,maxX:-Infinity,minZ:Infinity,maxZ:-Infinity};
  for(const p of vertices) {bounds.minX=Math.min(bounds.minX,p[0]-padding);bounds.maxX=Math.max(bounds.maxX,p[0]+padding);bounds.minZ=Math.min(bounds.minZ,p[2]-padding);bounds.maxZ=Math.max(bounds.maxZ,p[2]+padding);}
  const cells=new Map(), cellSize=Math.max(2,def.width), key=(x,z)=>`${x},${z}`;
  for(const tri of triangles) {
    const v=tri.map(i=>vertices[i]), xs=v.map(p=>p[0]), zs=v.map(p=>p[2]);
    for(let z=Math.floor(Math.min(...zs)/cellSize);z<=Math.floor(Math.max(...zs)/cellSize);z++)for(let x=Math.floor(Math.min(...xs)/cellSize);x<=Math.floor(Math.max(...xs)/cellSize);x++) {
      const k=key(x,z);if(!cells.has(k))cells.set(k,[]);cells.get(k).push(v);
    }
  }
  function heightAt(x,z) {
    for(const [a,b,c] of cells.get(key(Math.floor(x/cellSize),Math.floor(z/cellSize))) || []) {
      const p=[x,0,z],area=cross(a,b,c),u=cross(p,b,c)/area,v=cross(a,p,c)/area,w=1-u-v;
      if(Math.min(u,v,w)>=-1e-8)return a[1]*u+b[1]*v+c[1]*w;
    }
    return NaN;
  }
  const nearest=indexPathSegments(samples,half+padding);
  const outline=[...vertices.filter((_,i)=>i%2===0),...vertices.filter((_,i)=>i%2===1).reverse(),vertices[0]];
  try { indexPathSegments(outline,half,true); }
  catch { throw Error('Path edges overlap. Reduce width or move the control points farther apart.'); }
  return {def,samples,vertices,triangles,bounds,heightAt,nearest};
}
