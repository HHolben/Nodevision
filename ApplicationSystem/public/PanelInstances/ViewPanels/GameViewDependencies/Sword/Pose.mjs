export const SWORD=Object.freeze({duration:.65,windup:.12,activeEnd:.34,reach:1.55,bladeLength:1.05,damage:.35,step:1/120,maxSteps:12});
export function swordPhase(elapsed){return elapsed<SWORD.windup?'wind-up':elapsed<SWORD.activeEnd?'strike':elapsed<SWORD.duration?'recovery':'ready';}
export function swordPose(THREE,camera,elapsed=null,hand='dominant'){
 const phase=elapsed===null?'ready':swordPhase(elapsed),sign=hand==='off'?-1:1;let yaw=0;
 if(phase==='wind-up')yaw=-.65*elapsed/SWORD.windup;else if(phase==='strike')yaw=-.65+1.3*(elapsed-SWORD.windup)/(SWORD.activeEnd-SWORD.windup);else if(phase==='recovery')yaw=.65*(1-(elapsed-SWORD.activeEnd)/(SWORD.duration-SWORD.activeEnd));yaw*=sign;
 camera.updateWorldMatrix(true,false);const base=new THREE.Vector3(sign*.20,-.18,-.4).applyMatrix4(camera.matrixWorld),quaternion=camera.getWorldQuaternion(new THREE.Quaternion()).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),-yaw)),tip=new THREE.Vector3(0,0,-SWORD.bladeLength).applyQuaternion(quaternion).add(base);
 return {base,tip,quaternion,phase};
}
