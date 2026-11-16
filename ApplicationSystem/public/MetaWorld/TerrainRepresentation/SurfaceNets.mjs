// Nodevision/ApplicationSystem/public/MetaWorld/TerrainRepresentation/SurfaceNets.mjs
// Extracts one connected binary surface net from globally aligned occupancy samples, with halo cells shared exactly between neighboring chunks and separate liquid surfaces.
import {isLiquidVoxel} from '../ProceduralVoxelWorld/VoxelMaterialIds.mjs';
import {voxelIndex} from '../ProceduralVoxelWorld/VoxelCoordinates.mjs';
const corners=Array.from({length:8},(_,i)=>[i&1,(i>>1)&1,(i>>2)&1]);
const edges=[];for(let i=0;i<8;i++)for(let a=0;a<3;a++)if(!(i&(1<<a)))edges.push([i,i|(1<<a)]);
// The 256 binary corner patterns have fixed interpolation and normal values.
const patterns=Array.from({length:256},(_,mask)=>{
  const values=corners.map((_,i)=>(mask>>i)&1),p=[0,0,0],normal=[0,0,0];let n=0;
  for(const [a,b] of edges)if(values[a]!==values[b]){for(let axis=0;axis<3;axis++)p[axis]+=(corners[a][axis]+corners[b][axis])*.5;n++;}
  for(let a=0;a<3;a++)for(let i=0;i<8;i++)normal[a]+=(corners[i][a]?-1:1)*values[i];
  const length=Math.hypot(...normal)||1;
  return {fraction:p.map(v=>Math.round(v/n*4096)/4096),offset:p.map(v=>v/n),normal:normal.map(v=>v/length)};
});
export function* surfaceNetSteps(data,chunk,getVoxel,shade=null){
  const origin=chunk.map(v=>v*32),cache=new Uint16Array(34**3),at=(x,y,z)=>(x+1)+34*((y+1)+34*(z+1));
  for(let z=-1;z<=32;z++)for(let y=-1;y<=32;y++){for(let x=-1;x<=32;x++)cache[at(x,y,z)]=x>=0&&x<32&&y>=0&&y<32&&z>=0&&z<32?data[voxelIndex(x,y,z)]:getVoxel(origin[0]+x,origin[1]+y,origin[2]+z);yield;}
  const positions=[],normals=[],uvs=[],indices=[],buckets=new Map();let solidVoxels=0,liquidVoxels=0;
  for(const m of data)if(m){if(isLiquidVoxel(m))liquidVoxels++;else solidVoxels++;}
  for(const liquid of [false,true]){
    if(liquid?!liquidVoxels:!solidVoxels)continue;
    const inside=m=>m!==0&&isLiquidVoxel(m)===liquid,nodes=new Int32Array(33**3).fill(-1),key=(x,y,z)=>x+1+33*(y+1+33*(z+1));
    // Classify once, then reject uniform cells without allocating corner arrays.
    const occupancy=Uint8Array.from(cache,m=>inside(m)?1:0);
    for(let z=-1;z<32;z++)for(let y=-1;y<32;y++){
      for(let x=-1;x<32;x++){
        const i=at(x,y,z),mask=occupancy[i]|occupancy[i+1]<<1|occupancy[i+34]<<2|occupancy[i+35]<<3|occupancy[i+1156]<<4|occupancy[i+1157]<<5|occupancy[i+1190]<<6|occupancy[i+1191]<<7;
        if(mask===0||mask===255)continue;
        const {fraction,offset,normal}=patterns[mask],index=positions.length/3;nodes[key(x,y,z)]=index;
        positions.push((x+.5+fraction[0])*.25,(y+.5+fraction[1])*.25,(z+.5+fraction[2])*.25);
        normals.push(...(!liquid&&shade?shade(origin[0]+x,origin[1]+y,origin[2]+z,patterns[mask],cache,i):normal));uvs.push((origin[0]+x+offset[0])*.25,(origin[2]+z+offset[2])*.25);
      }yield;
    }
    for(let z=-1;z<32;z++)for(let y=-1;y<32;y++){
      for(let x=-1;x<32;x++)for(let axis=0;axis<3;axis++){
        if(axis!==0&&x<0||axis!==1&&y<0||axis!==2&&z<0)continue;
        const atCell=at(x,y,z),stride=axis===0?1:axis===1?34:1156,a=cache[atCell],b=cache[atCell+stride],aInside=inside(a),bInside=inside(b);
        if(aInside===bInside)continue;
        const coordinate=axis===0?x:axis===1?y:z;
        if(coordinate===-1&&!bInside||coordinate===31&&!aInside)continue;
        const u=(axis+1)%3,v=(axis+2)%3,su=u===0?1:u===1?33:1089,sv=v===0?1:v===1?33:1089,k=key(x,y,z);
        const i0=nodes[k],i1=nodes[k-su],i2=nodes[k-su-sv],i3=nodes[k-sv];
        if(i0<0||i1<0||i2<0||i3<0)continue;
        const material=aInside?a:b;if(!buckets.has(material))buckets.set(material,[]);
        if(aInside)buckets.get(material).push(i0,i1,i2,i0,i2,i3);
        else buckets.get(material).push(i3,i2,i1,i3,i1,i0);
      }yield;
    }
  }
  const groups=[];for(const [material,bucket] of [...buckets].sort((a,b)=>a[0]-b[0])){groups.push({start:indices.length,count:bucket.length,materialIndex:material-1});for(const i of bucket)indices.push(i);}
  return {positions,normals,uvs,indices,groups,solidVoxels,faceCount:indices.length/6};
}
