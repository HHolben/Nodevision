// Nodevision/ApplicationSystem/public/MetaWorld/ProceduralVoxelWorld/VoxelGreedyMesher.mjs
// This mesher merges coplanar exposed cells of one canonical material into rectangles while retaining the existing solid, liquid, winding and cross-chunk visibility rules.
import { isLiquidVoxel, isWaterVoxel } from './VoxelMaterialIds.mjs';
const SIZE=32,STRIDES=[1,1024,32],SCALE=.25;
const liquid=new Uint8Array(256),water=new Uint8Array(256);
for(let i=0;i<256;i++){liquid[i]=Number(isLiquidVoxel(i));water[i]=Number(isWaterVoxel(i));}
export function meshGreedyVoxelChunk(data,chunk,getVoxel) {
  const positions=[],uvs=[],normals=[],materials=[],indices=[],buckets=new Map(),mask=new Uint16Array(SIZE*SIZE);
  const origin=chunk.map(v=>v*SIZE);
  let solidVoxels=0,surfaceFaceCount=0;
  for(let i=0;i<data.length;i++)if(data[i]&&!liquid[data[i]])solidVoxels++;
  for(let axis=0;axis<3;axis++)for(const sign of [-1,1]){
    const u=(axis+1)%3,v=(axis+2)%3,normal=[0,0,0];normal[axis]=sign;
    const stride=STRIDES[axis],su=STRIDES[u],sv=STRIDES[v],coords=[0,0,0];
    for(let layer=0;layer<SIZE;layer++){
      mask.fill(0);const neighborLayer=layer+sign,internal=neighborLayer>=0&&neighborLayer<SIZE;
      for(let j=0;j<SIZE;j++)for(let i=0;i<SIZE;i++){
        const index=layer*stride+i*su+j*sv,material=data[index];if(!material)continue;
        let neighbor;
        if(internal)neighbor=data[index+sign*stride];
        else {coords[axis]=origin[axis]+neighborLayer;coords[u]=origin[u]+i;coords[v]=origin[v]+j;neighbor=getVoxel(coords[0],coords[1],coords[2]);}
        if(water[material]&&water[neighbor])continue;
        if(neighbor&&(!liquid[neighbor]||(liquid[material]&&material<=neighbor)))continue;
        mask[i+j*SIZE]=material;surfaceFaceCount++;
      }
      // Rectangles never cross a material boundary, face orientation or chunk boundary.
      for(let j=0;j<SIZE;j++)for(let i=0;i<SIZE;){
        const material=mask[i+j*SIZE];if(!material){i++;continue;}
        let width=1,height=1;
        while(i+width<SIZE&&mask[i+width+j*SIZE]===material)width++;
        outer:while(j+height<SIZE){for(let k=0;k<width;k++)if(mask[i+k+(j+height)*SIZE]!==material)break outer;height++;}
        const first=positions.length/3,plane=(layer+(sign>0?1:0))*SCALE;
        for(let corner=0;corner<4;corner++){
          const point=[0,0,0];point[axis]=plane;
          point[u]=(i+(corner===1||corner===2?width:0))*SCALE;
          point[v]=(j+(corner>=2?height:0))*SCALE;
          uvs.push(point[u]/SCALE,point[v]/SCALE);
          positions.push(point[0],point[1],point[2]);normals.push(normal[0],normal[1],normal[2]);materials.push(material);
        }
        let bucket=buckets.get(material);if(!bucket){bucket=[];buckets.set(material,bucket);}
        if(sign>0)bucket.push(first,first+1,first+2,first,first+2,first+3);
        else bucket.push(first,first+2,first+1,first,first+3,first+2);
        for(let row=0;row<height;row++)mask.fill(0,i+(j+row)*SIZE,i+width+(j+row)*SIZE);
        i+=width;
      }
    }
  }
  const groups=[];
  for(const material of [...buckets.keys()].sort((a,b)=>a-b)){
    const bucket=buckets.get(material);groups.push({start:indices.length,count:bucket.length,materialIndex:material-1});
    for(const index of bucket)indices.push(index);
  }
  return {positions,uvs,normals,materials,indices,groups,solidVoxels,surfaceFaceCount,faceCount:indices.length/6};
}
