// Nodevision/ApplicationSystem/public/MetaWorld/Paths/PathTriangleField.mjs
// Shares spatially indexed triangle-height queries between full path ribbons and clipped unsupported bridge geometry.
const cross=(a,b,c)=>(b[0]-a[0])*(c[2]-a[2])-(b[2]-a[2])*(c[0]-a[0]);
export function pathTriangleField(vertices,triangles,cellSize=2){
  const cells=new Map(),key=(x,z)=>`${x},${z}`;
  for(const tri of triangles){const v=tri.map(i=>vertices[i]),xs=v.map(p=>p[0]),zs=v.map(p=>p[2]);
    for(let z=Math.floor(Math.min(...zs)/cellSize);z<=Math.floor(Math.max(...zs)/cellSize);z++)for(let x=Math.floor(Math.min(...xs)/cellSize);x<=Math.floor(Math.max(...xs)/cellSize);x++){
      const k=key(x,z);if(!cells.has(k))cells.set(k,[]);cells.get(k).push(v);
    }
  }
  return (x,z)=>{for(const [a,b,c] of cells.get(key(Math.floor(x/cellSize),Math.floor(z/cellSize)))||[]){
    const p=[x,0,z],area=cross(a,b,c);if(Math.abs(area)<1e-12)continue;
    const u=cross(p,b,c)/area,v=cross(a,p,c)/area,w=1-u-v;
    if(Math.min(u,v,w)>=-1e-8)return a[1]*u+b[1]*v+c[1]*w;
  }return NaN;};
}
