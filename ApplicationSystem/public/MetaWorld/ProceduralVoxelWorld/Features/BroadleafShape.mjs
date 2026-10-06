// Nodevision/ApplicationSystem/public/MetaWorld/ProceduralVoxelWorld/Features/BroadleafShape.mjs
// This shared sampler builds voxelized tapered trunks, diagonal branch segments and irregular foliage lobes from species-specific seeded dimensions.
import { hash } from '../SeededVoxelNoise.mjs';
export function broadleafParameters(seed,config){
  const r=n=>hash(n,41,seed),height=config.height[0]+Math.floor(r(1)*(config.height[1]-config.height[0]));
  const radius=config.crown[0]+r(2)*(config.crown[1]-config.crown[0]);
  const p={height,crownRadius:radius,trunkRadius:config.trunk[0]+r(3)*(config.trunk[1]-config.trunk[0]),
    crookedness:config.crookedness,phase:r(4)*6.28,branches:[],lobes:[]};
  p.lobes.push({x:0,y:height*.73,z:0,rx:radius*.75,ry:height*.27,rz:radius*.72});
  for(let i=0;i<config.branches;i++){
    const angle=p.phase+i*6.28/config.branches+(r(10+i)-.5)*.5;
    const length=radius*(.55+r(20+i)*.25),tip={x:Math.cos(angle)*length,y:height*(.56+r(30+i)*.18),z:Math.sin(angle)*length};
    p.branches.push({a:{x:0,y:height*(config.branchStart+r(40+i)*.12),z:0},b:tip,radius:config.branchRadius});
    p.lobes.push({...tip,rx:radius*(.4+r(50+i)*.13),ry:height*(.17+r(60+i)*.06),rz:radius*(.4+r(70+i)*.13)});
  }
  return p;
}
function segmentDistance(x,y,z,{a,b}){
  const dx=b.x-a.x,dy=b.y-a.y,dz=b.z-a.z;
  const t=Math.max(0,Math.min(1,((x-a.x)*dx+(y-a.y)*dy+(z-a.z)*dz)/(dx*dx+dy*dy+dz*dz)));
  return Math.hypot(x-a.x-t*dx,y-a.y-t*dy,z-a.z-t*dz);
}
export function sampleBroadleaf(x,y,z,seed,p,materials){
  if(y<0||y>=p.height||Math.abs(x)>24||Math.abs(z)>24)return 0;
  const shift=p.crookedness*Math.sin(y*.07),trunk=p.trunkRadius*(1-.65*y/p.height);
  const trunkDistance=Math.hypot(x-shift*Math.cos(p.phase),z-shift*Math.sin(p.phase));
  if(y<p.height*.8&&trunkDistance<=trunk)return trunkDistance<=trunk-1?materials[0]:materials[1];
  if(y<p.height*.2)return 0;
  for(const branch of p.branches){const d=segmentDistance(x,y,z,branch);if(d<=branch.radius)return d<=branch.radius-1?materials[0]:materials[1];}
  for(const l of p.lobes){
    const d=((x-l.x)/l.rx)**2+((y-l.y)/l.ry)**2+((z-l.z)/l.rz)**2;
    if(d<.82||(d<1&&hash(x+y*17,z,seed)>.15))return materials[2];
  }
  return 0;
}
