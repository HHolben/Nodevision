// Nodevision/ApplicationSystem/public/MetaWorld/TerrainRepresentation/SurfaceNets.mjs
// Extracts one connected binary surface net from globally aligned occupancy samples, with halo cells shared exactly between neighboring chunks and separate liquid surfaces.
import {isLiquidVoxel} from '../ProceduralVoxelWorld/VoxelMaterialIds.mjs';
import {voxelIndex} from '../ProceduralVoxelWorld/VoxelCoordinates.mjs';
const corners=Array.from({length:8},(_,i)=>[i&1,(i>>1)&1,(i>>2)&1]);
const edges=[];for(let i=0;i<8;i++)for(let a=0;a<3;a++)if(!(i&(1<<a)))edges.push([i,i|(1<<a)]);
export function* surfaceNetSteps(data,chunk,getVoxel){
  const origin=chunk.map(v=>v*32),cache=new Uint8Array(34**3),at=(x,y,z)=>(x+1)+34*((y+1)+34*(z+1));
  for(let z=-1;z<=32;z++)for(let y=-1;y<=32;y++){for(let x=-1;x<=32;x++)cache[at(x,y,z)]=[x,y,z].every(v=>v>=0&&v<32)?data[voxelIndex(x,y,z)]:getVoxel(origin[0]+x,origin[1]+y,origin[2]+z);yield;}
  const positions=[],normals=[],uvs=[],indices=[],buckets=new Map();let solidVoxels=0;
  for(const m of data)if(m&&!isLiquidVoxel(m))solidVoxels++;
  for(const liquid of [false,true]){
    const inside=m=>m!==0&&isLiquidVoxel(m)===liquid,nodes=new Map(),key=(x,y,z)=>x+1+33*(y+1+33*(z+1));
    for(let z=-1;z<32;z++)for(let y=-1;y<32;y++){
      for(let x=-1;x<32;x++){
        const values=corners.map(c=>inside(cache[at(x+c[0],y+c[1],z+c[2])])?1:0);
        const count=values.reduce((a,b)=>a+b,0);if(!count||count===8)continue;
        const p=[0,0,0];let n=0;
        for(const [a,b] of edges)if(values[a]!==values[b]){for(let axis=0;axis<3;axis++)p[axis]+=(corners[a][axis]+corners[b][axis])*.5;n++;}
        const normal=[0,0,0];for(let a=0;a<3;a++)for(let i=0;i<8;i++)normal[a]+=(corners[i][a]?-1:1)*values[i];
        const length=Math.hypot(...normal)||1,index=positions.length/3;nodes.set(key(x,y,z),index);
        const fraction=p.map(v=>Math.round(v/n*4096)/4096);
        positions.push((x+.5+fraction[0])*.25,(y+.5+fraction[1])*.25,(z+.5+fraction[2])*.25);
        normals.push(...normal.map(v=>v/length));uvs.push((origin[0]+x+p[0]/n)*.25,(origin[2]+z+p[2]/n)*.25);
      }yield;
    }
    for(let z=-1;z<32;z++)for(let y=-1;y<32;y++){
      for(let x=-1;x<32;x++)for(let axis=0;axis<3;axis++){
        if([x,y,z].some((v,a)=>v<0&&a!==axis))continue;
        const p=[x,y,z],q=p.slice();q[axis]++;const a=cache[at(...p)],b=cache[at(...q)];if(inside(a)===inside(b))continue;
        // At chunk boundaries the occupied endpoint owns the edge, including isolated features.
        if((p[axis]===-1&&!inside(b))||(p[axis]===31&&!inside(a)))continue;
        const u=(axis+1)%3,v=(axis+2)%3;
        const cells=[[0,0],[-1,0],[-1,-1],[0,-1]].map(([du,dv])=>{const c=p.slice();c[u]+=du;c[v]+=dv;return nodes.get(key(...c));});
        if(cells.some(i=>i===undefined))continue;
        if(!inside(a))cells.reverse();
        const material=inside(a)?a:b;if(!buckets.has(material))buckets.set(material,[]);
        buckets.get(material).push(cells[0],cells[1],cells[2],cells[0],cells[2],cells[3]);
      }yield;
    }
  }
  const groups=[];for(const [material,bucket] of [...buckets].sort((a,b)=>a[0]-b[0])){groups.push({start:indices.length,count:bucket.length,materialIndex:material-1});for(const i of bucket)indices.push(i);}
  return {positions,normals,uvs,indices,groups,solidVoxels,faceCount:indices.length/6};
}
