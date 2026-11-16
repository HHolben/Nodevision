// Place the tip outside the firing player's body along the crosshair ray, even when aiming down through the capsule.
export function releaseTip(THREE,origin,direction,player,height=1.75){
 const body=new THREE.Box3(new THREE.Vector3(player.x-.35,player.y-height,player.z-.35),new THREE.Vector3(player.x+.35,player.y+.1,player.z+.35));
 let distance=.5;if(body.containsPoint(origin)){const exit=new THREE.Ray(origin,direction).intersectBox(body,new THREE.Vector3());if(exit)distance=Math.max(distance,origin.distanceTo(exit)+.04);}
 return origin.clone().addScaledVector(direction,distance);
}
