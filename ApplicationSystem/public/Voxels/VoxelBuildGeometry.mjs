// Nodevision/ApplicationSystem/public/Voxels/VoxelBuildGeometry.mjs
// Bounded integer-grid geometry shared by build previews and committed drawing operations.
import { position,key } from './VoxelModel.mjs';
export const LIMIT=262144;
export function region(a,b){position(a);position(b);const lo=a.map((v,i)=>Math.min(v,b[i])),hi=a.map((v,i)=>Math.max(v,b[i]));if(hi.reduce((n,v,i)=>n*(v-lo[i]+1),1)>LIMIT)throw Error('Operation exceeds 262144 voxel limit');return{lo,hi};}
export function* gridLine(a,b){position(a);position(b);const n=Math.max(...a.map((v,i)=>Math.abs(v-b[i])));if(n>=LIMIT)throw Error('Line exceeds operation limit');for(let t=0;t<=n;t++)yield a.map((v,i)=>Math.round(v+(b[i]-v)*(n?t/n:0)));}
export function* geometry(kind,args){
 const a=position(args.at),axis='xyz'.indexOf(args.axis||'y');if(axis<0)throw Error('Expected x, y or z axis');let b=args.to;
 if(args.dimensions){position(args.dimensions);if(args.dimensions.some(v=>v<1))throw Error('Dimensions must be positive');b=a.map((v,i)=>v+args.dimensions[i]-1);}
 if(args.radius!==undefined||args.radii){const r=args.radii||[args.radius,args.radius,args.radius];position(r);if(r.some(v=>v<0))throw Error('Radius must be nonnegative');b=a.map((v,i)=>v+r[i]);args={...args,at:a.map((v,i)=>v-r[i])};}
 if(kind==='cylinder'&&args.radius!==undefined){const height=args.height??(args.radius*2+1);if(!Number.isInteger(height)||height<1)throw Error('Cylinder height must be a positive integer');args.at[axis]=a[axis];b[axis]=a[axis]+height-1;}
 if(kind==='sphere'&&args.radius===undefined&&!args.radii){position(b);const size=Math.max(...b.map((v,i)=>Math.abs(v-a[i])));b=a.map((v,i)=>v+(b[i]<v?-size:size));}
 if(kind==='line'){yield* gridLine(a,b);return;}
 if(kind==='rectangle'){b=position(b).slice();const normal={xy:2,xz:1,yz:0}[args.plane||'xz'];if(normal===undefined)throw Error('Invalid construction plane');b[normal]=a[normal];}
 const {lo,hi}=region(args.at,b),thickness=args.thickness??1;if(!Number.isInteger(thickness)||thickness<1)throw Error('Shell thickness must be a positive integer');
 const axes=[0,1,2].filter(i=>i!==axis),normal={xy:2,xz:1,yz:0}[args.plane||'xz'];
 const inside=(p,inset=0,used=[0,1,2])=>used.reduce((s,i)=>{const r=(hi[i]-lo[i]+1)/2-inset;return r<=0?Infinity:s+((p[i]-(lo[i]+hi[i])/2)/r)**2;},0)<=1;
 for(let z=lo[2];z<=hi[2];z++)for(let y=lo[1];y<=hi[1];y++)for(let x=lo[0];x<=hi[0];x++){
  const p=[x,y,z],edge=i=>p[i]-lo[i]<thickness||hi[i]-p[i]<thickness;
  if(['sphere','ellipsoid'].includes(kind)&&(!inside(p)||(args.hollow&&inside(p,thickness))))continue;
  if(kind==='cylinder'&&(!inside(p,0,axes)||(args.hollow&&inside(p,thickness,axes))))continue;
  if(kind==='box'&&(args.hollow||args.walls)&&![0,1,2].filter(i=>!args.walls||i!==axis).some(edge))continue;
  if(kind==='rectangle'&&args.hollow&&![0,1,2].filter(i=>i!==normal).some(edge))continue;
  yield p;
 }
}
export function constrain(p,anchor,constraint='free'){position(p);position(anchor);if(!['free','x','y','z','xy','xz','yz'].includes(constraint))throw Error('Invalid axis constraint');return p.map((v,i)=>constraint==='free'||constraint.includes('xyz'[i])?v:anchor[i]);}
export function symmetric(points,axes=[],origin=[0,0,0]){position(origin);const result=new Map();for(const p of points){let variants=[p];for(const name of new Set(axes)){const i='xyz'.indexOf(name);if(i<0)throw Error('Invalid symmetry axis');variants=variants.concat(variants.map(q=>q.map((v,j)=>j===i?2*origin[i]-v:v)));}for(const q of variants){position(q);result.set(key(q),q);if(result.size>LIMIT)throw Error('Symmetry exceeds operation limit');}}return [...result.values()];}
