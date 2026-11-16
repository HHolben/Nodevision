import {createSensorySignals} from '../ApplicationSystem/public/MetaWorld/Mobs/SensorySignals.mjs';
// Shared deterministic scenes use real rendered triangles / owned colliders and the production ground and player collision queries.
export function navigationFixture(THREE,kind='wall',offset=0){
 const scene=new THREE.Scene(),objects=[],colliders=[],player=new THREE.Object3D(),floor=new THREE.Mesh(new THREE.PlaneGeometry(100,100).rotateX(-Math.PI/2),new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));floor.position.x=offset;floor.updateMatrixWorld(true);objects.push(floor);scene.add(floor);
 // Real plane ray hits are used when sampleGroundY is absent.
 colliders.push({type:'box',target:floor,box:new THREE.Box3(new THREE.Vector3(offset-50,-.1,-50),new THREE.Vector3(offset+50,0,50))});
 function wall(x,z,sx,sz){const mesh=new THREE.Mesh(new THREE.BoxGeometry(sx,2,sz),new THREE.MeshBasicMaterial());mesh.position.set(x+offset,1,z);scene.add(mesh);objects.push(mesh);mesh.updateMatrixWorld(true);colliders.push({type:'box',target:mesh,box:new THREE.Box3().setFromObject(mesh)});return mesh;}
 if(kind==='wall'||kind==='left'||kind==='right'||kind==='chase')wall(0,.65,1.5,.35);
 if(kind==='left')wall(1.2,0,.4,3);if(kind==='right')wall(-1.2,0,.4,3);
 if(kind==='enclosed'){wall(0,.65,3,.35);wall(0,-.65,3,.35);wall(1,0,.35,1.3);wall(-1,0,.35,1.3);}
 if(kind==='passage'){wall(-.6,1.2,.3,4);wall(.6,1.2,.3,4);}
 player.position.set(offset,1.5,-1.5);return {THREE,scene,objects,colliders,sensorySignals:createSensorySignals(),controls:{getObject:()=>player},movementState:{paused:false},player,wall};
}
export function sampleRun(root,ctx,{seconds=12,fps=30,chase=true,changing=false}={}){
 const r=root.userData.mobRuntime,poses=[],initial=[...r.position];let flips=0,previousYaw=0,lastTurn=0,maxLift=0,minimumTravel=Infinity;
 if(!chase)ctx.sensorySignals.emit({type:'sound',sourceId:'initial-running-step',category:'running',position:ctx.player.position.toArray(),intensity:1},0);r.tick(1000,ctx);for(let i=1;i<=seconds*fps;i++){if(chase){const p=r.position;ctx.player.position.set(p[0]+(changing?Math.sin(i/fps)*.6:0),p[1]+1.5,p[2]-1.5);}if(chase)ctx.sensorySignals.emit({type:'sound',sourceId:'chasing-player',category:'running',position:ctx.player.position.toArray(),intensity:1},i/fps);else ctx.sensorySignals.advance(i/fps);r.tick(1000+i*1000/fps,ctx);const p=r.position,yaw=r.body.rotation.y,delta=Math.atan2(Math.sin(yaw-previousYaw),Math.cos(yaw-previousYaw)),sign=Math.abs(delta)>.015?Math.sign(delta):0;if(sign&&lastTurn&&sign!==lastTurn)flips++;if(sign)lastTurn=sign;previousYaw=yaw;maxLift=Math.max(maxLift,r.body.getWorldPosition(new ctx.THREE.Vector3()).y-p[1]);if(i%Math.max(1,Math.round(fps/5))===0)poses.push({t:i/fps,position:p,yaw,...(r.snapshot().navigation?{navigation:r.snapshot().navigation}:{})});minimumTravel=Math.min(minimumTravel,Math.hypot(p[0]-initial[0],p[2]-initial[2]));}
 const p=r.position;return {seconds,headingFlips:flips,displacement:Math.hypot(p[0]-initial[0],p[2]-initial[2]),escapeProgress:p[2]-initial[2],maxLift,snapshot:r.snapshot(),poses};
}
