// Nodevision/ApplicationSystem/public/MetaWorld/SessionVoxels/Raycast.mjs
// Grid DDA targets effective occupancy, including cells whose old terrain meshes are awaiting the scheduler.
export function raycastCells(origin,direction,sample,{maxDistance=24,gridOrigin=[0,0,0],includeEmpty=()=>false}={}){
 const size=.25,p=origin.map((v,i)=>(v-gridOrigin[i])/size),cell=p.map(Math.floor),step=direction.map(Math.sign),delta=direction.map(v=>v?size/Math.abs(v):Infinity);
 const next=p.map((v,i)=>direction[i]?((direction[i]>0?cell[i]+1:cell[i])-v)*size/direction[i]:Infinity);let distance=0,normal=[0,0,0];
 for(let i=0;i<2048&&distance<=maxDistance;i++){const value=sample(cell);if(value||includeEmpty(cell))return {at:cell.slice(),normal:normal.slice(),value,distance};const a=next.indexOf(Math.min(...next));if(!Number.isFinite(next[a]))break;distance=next[a];cell[a]+=step[a];next[a]+=delta[a];normal=[0,0,0];normal[a]=-step[a];}return null;
}
