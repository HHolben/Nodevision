// Nodevision/ApplicationSystem/public/MetaWorld/Paths/PathSurface.mjs
// Clips path triangles to the terrain voxel grid, suppresses supported portions, and connects unsupported bridge edges to voxel roadbed heights without filling the space below.
import {pathTriangleField} from './PathTriangleField.mjs';
function clip(points,axis,bound,greater){
  const out=[];for(let i=0;i<points.length;i++){
    const a=points[i],b=points[(i+1)%points.length],inside=p=>greater?p[axis]>=bound:p[axis]<=bound,ia=inside(a),ib=inside(b);
    if(ia)out.push(a);if(ia!==ib){const t=(bound-a[axis])/(b[axis]-a[axis]);out.push(a.map((v,j)=>v+(b[j]-v)*t));}
  }return out;
}
export function pathSurface(ribbon,support,origin=[0,0,0]){
  if(ribbon.def.terrainInteraction!=='excavate'||!support)return ribbon;
  const vertices=[],triangles=[],cache=new Map();let work=0;
  const supported=(x,z)=>{const cx=Math.floor((x-origin[0])/.25),cz=Math.floor((z-origin[2])/.25),key=`${cx},${cz}`;
    if(!cache.has(key))cache.set(key,support(origin[0]+(cx+.5)*.25,origin[2]+(cz+.5)*.25));return cache.get(key);};
  for(const tri of ribbon.triangles){const points=tri.map(i=>ribbon.vertices[i]),zs=points.map(p=>p[2]);
    for(let z=Math.floor((Math.min(...zs)-origin[2])/.25);z<=Math.floor((Math.max(...zs)-origin[2])/.25);z++){
      const z0=origin[2]+z*.25,row=clip(clip(points,2,z0,true),2,z0+.25,false);if(row.length<3)continue;
      const xs=row.map(p=>p[0]);for(let x=Math.floor((Math.min(...xs)-origin[0])/.25);x<=Math.floor((Math.max(...xs)-origin[0])/.25);x++){
        if(++work>262144)throw Error('Path support clipping exceeds 262144 cells. Shorten the path or reduce its width.');
        const x0=origin[0]+x*.25;if(supported(x0+.125,z0+.125))continue;
        const polygon=clip(clip(row,0,x0,true),0,x0+.25,false);if(polygon.length<3)continue;
        const area=polygon.reduce((sum,p,i)=>{const q=polygon[(i+1)%polygon.length];return sum+p[0]*q[2]-q[0]*p[2];},0);if(Math.abs(area)<1e-10)continue;
        const start=vertices.length;
        for(const p of polygon){let height=Infinity;for(const dx of [-1e-6,1e-6])for(const dz of [-1e-6,1e-6]){const s=supported(p[0]+dx,p[2]+dz);if(s)height=Math.min(height,s.height);}
          vertices.push([p[0],Number.isFinite(height)?height:p[1],p[2]]);
        }
        for(let i=1;i<polygon.length-1;i++){const [a,b,c]=[polygon[0],polygon[i],polygon[i+1]];
          if(Math.abs((b[0]-a[0])*(c[2]-a[2])-(b[2]-a[2])*(c[0]-a[0]))>1e-10)triangles.push([start,start+i,start+i+1]);
        }
      }
    }
  }
  return {vertices,triangles,heightAt:pathTriangleField(vertices,triangles),work};
}
