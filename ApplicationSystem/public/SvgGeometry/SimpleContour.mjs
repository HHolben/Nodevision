// Nodevision/ApplicationSystem/public/SvgGeometry/SimpleContour.mjs
// This module detects proper self-intersections before simple-ring winding decomposition. Ambiguous self-intersecting subpaths are rejected explicitly instead of displaying an incorrect enclosed area.
export function hasSelfIntersection(points) {
  const same=(a,b)=>a[0]===b[0]&&a[1]===b[1];
  const ring=points.filter((point,i)=>!i||!same(point,points[i-1]));
  while(ring.length>1&&same(ring[0],ring.at(-1)))ring.pop();
  const edges=ring.map((a,i)=>{const b=ring[(i+1)%ring.length];return {a,b,i,minX:Math.min(a[0],b[0]),maxX:Math.max(a[0],b[0]),minY:Math.min(a[1],b[1]),maxY:Math.max(a[1],b[1])};}).sort((a,b)=>a.minX-b.minX);
  const side=(a,b,p)=>(b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0]);
  let active=[];
  for(const edge of edges){
    active=active.filter(other=>other.maxX>=edge.minX);
    for(const other of active){
      if(Math.abs(edge.i-other.i)===1||Math.abs(edge.i-other.i)===ring.length-1||other.maxY<edge.minY||edge.maxY<other.minY)continue;
      if(same(edge.a,other.a)||same(edge.a,other.b)||same(edge.b,other.a)||same(edge.b,other.b))return true;
      if(side(edge.a,edge.b,other.a)*side(edge.a,edge.b,other.b)<0 && side(other.a,other.b,edge.a)*side(other.a,other.b,edge.b)<0)return true;
    }
    active.push(edge);
  }
  return false;
}
