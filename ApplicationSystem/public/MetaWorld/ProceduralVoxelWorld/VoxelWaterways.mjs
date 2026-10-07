// Nodevision/ApplicationSystem/public/MetaWorld/ProceduralVoxelWorld/VoxelWaterways.mjs
// This module builds bounded downhill drainage paths with source ponds, narrow creeks, wider streams and vertical waterfall curtains from unmodified terrain heights.
import { hash } from './SeededVoxelNoise.mjs';
const REGION=256,STEP=8;
export function createWaterways(rawHeight,dimensions,seed){
  const cache=new Map(),columns=new Array(4096);
  function region(rx,rz){
    const key=`${rx},${rz}`;if(cache.has(key))return cache.get(key);
    const minX=rx*REGION+24,minZ=rz*REGION+24,maxX=Math.min(dimensions[0]-24,(rx+1)*REGION-24),maxZ=Math.min(dimensions[2]-24,(rz+1)*REGION-24);
    const segments=[],ponds=[];
    if(maxX>minX&&maxZ>minZ&&hash(rx,rz,seed^98113)>.35){
      let x=Math.floor(minX+(maxX-minX)*hash(rx,rz,seed^773)),z=Math.floor(minZ+(maxZ-minZ)*hash(rx,rz,seed^991));
      let top=rawHeight(x,z)-1;
      if(top>76){
        ponds.push({x,z,top,radius:8});
        for(let i=0;i<40;i++){
          let next=null;
          for(let d=0;d<8;d++){
            const nx=x+Math.round(Math.cos(d*Math.PI/4)*STEP),nz=z+Math.round(Math.sin(d*Math.PI/4)*STEP);
            if(nx<minX||nz<minZ||nx>maxX||nz>maxZ)continue;
            const h=rawHeight(nx,nz)-1;
            if(h<top&&(!next||h<next.top))next={x:nx,z:nz,top:h};
          }
          if(!next)break;
          segments.push({x,z,top,...{end:next},width:i<8?2:4,kind:i<8?'creek':'stream'});
          ({x,z,top}=next);if(top<=72)break;
        }
        if(top>72)ponds.push({x,z,top,radius:12});
      }
    }
    const result={segments,ponds};if(cache.size>=128)cache.delete(cache.keys().next().value);cache.set(key,result);return result;
  }
  function calculate(x,z){
    const {segments,ponds}=region(Math.floor(x/REGION),Math.floor(z/REGION));let result=null,bankTop=null;
    const merge=(bed,top,kind)=>{if(!result||bed<result.bed)result={bed,top,kind};};
    for(const p of ponds){
      const d=Math.hypot(x-p.x,z-p.z);if(d<=p.radius+8)bankTop=p.top;if(d<=p.radius){
        const depth=Math.max(1,Math.ceil(4*(1-d*d/(p.radius*p.radius))));merge(p.top-depth,p.top,'pond');
      }
    }
    for(const s of segments){
      const dx=s.end.x-s.x,dz=s.end.z-s.z,len=dx*dx+dz*dz;
      const t=Math.max(0,Math.min(1,((x-s.x)*dx+(z-s.z)*dz)/len));
      const distance=Math.hypot(x-s.x-t*dx,z-s.z-t*dz);
      if(distance<=s.width+8)bankTop=Math.floor(s.top-(s.top-s.end.top)*t);
      if(distance>s.width)continue;
      const drop=s.top-s.end.top,fall=drop>=4;
      const top=fall?(t<.75?s.top:s.end.top):Math.floor(s.top-drop*t);
      const curtain=fall&&t>=.6&&t<.75;
      merge(curtain?s.end.top-2:top-2,top,curtain?'waterfall':s.kind);
    }
    return result??(bankTop===null?null:{bed:Infinity,top:0,kind:'bank',bankTop});
  }
  function sample(x,z){
    if(x<0||z<0||x>=dimensions[0]||z>=dimensions[2])return null;
    const key=(x&127)+((z&31)<<7),old=columns[key];if(old?.x===x&&old.z===z)return old.value;
    const value=calculate(x,z);columns[key]={x,z,value};return value;
  }
  return {sample,region,clear(){cache.clear();columns.fill(undefined);}};
}
