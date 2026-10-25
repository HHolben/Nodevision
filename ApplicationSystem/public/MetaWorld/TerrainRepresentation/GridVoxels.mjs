// Nodevision/ApplicationSystem/public/MetaWorld/TerrainRepresentation/GridVoxels.mjs
// Derives exposed voxel columns from the legacy height grid at quarter-meter resolution, keeping the original grid and vertex colors authoritative.
import {gridHeight} from './TerrainData.mjs';
export function* gridVoxelSteps(THREE,terrain){
  const {columns:sourceColumns,rows:sourceRows,tileSize,heights,vertexColors}=terrain;
  const s=.25,width=sourceColumns*tileSize,depth=sourceRows*tileSize,columns=Math.ceil(width/s),rows=Math.ceil(depth/s);
  const height=(x,z)=>gridHeight(terrain,Math.min(width,x*s+s/2)-width/2,Math.min(depth,z*s+s/2)-depth/2);
  if(columns*rows>65536)throw Error('Terrain grid exceeds the 65536-column representation budget. Split it into smaller terrain surfaces.');
  let minimum=Infinity;for(const h of heights)minimum=Math.min(minimum,h);
  const base=Math.floor(minimum/s)-1;
  const top=(x,z)=>x<0||z<0||x>=columns||z>=rows?base:Math.ceil(height(x,z)/s);
  const p=[],colors=[],indices=[],uvs=[];
  function quad(points,color){const start=p.length/3,c=new THREE.Color(color||terrain.color);for(const v of points){p.push(v[0]-width/2,v[1],v[2]-depth/2);colors.push(c.r,c.g,c.b);uvs.push(v[0]/width,v[2]/depth);}indices.push(start,start+1,start+2,start,start+2,start+3);}
  for(let z=0;z<rows;z++){for(let x=0;x<columns;x++){
    const h=top(x,z)*s,x0=x*s,x1=Math.min(width,x0+s),z0=z*s,z1=Math.min(depth,z0+s),color=vertexColors?.[Math.min(sourceRows,Math.floor(z*s/tileSize))*(sourceColumns+1)+Math.min(sourceColumns,Math.floor(x*s/tileSize))]||terrain.color;
    quad([[x0,h,z0],[x0,h,z1],[x1,h,z1],[x1,h,z0]],color);
    const left=top(x-1,z)*s,right=top(x+1,z)*s,back=top(x,z-1)*s,front=top(x,z+1)*s;
    if(left<h)quad([[x0,left,z0],[x0,left,z1],[x0,h,z1],[x0,h,z0]],color);
    if(right<h)quad([[x1,right,z1],[x1,right,z0],[x1,h,z0],[x1,h,z1]],color);
    if(back<h)quad([[x1,back,z0],[x0,back,z0],[x0,h,z0],[x1,h,z0]],color);
    if(front<h)quad([[x0,front,z1],[x1,front,z1],[x1,h,z1],[x0,h,z1]],color);
  }yield;}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));g.setIndex(indices);g.computeVertexNormals();g.computeBoundingSphere();return g;
}
