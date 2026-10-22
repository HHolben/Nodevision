// Nodevision/ApplicationSystem/public/Models/ModelPlacementMath.mjs
// Validates physical placement settings without changing source voxel coordinates.
export const placementDefaults=()=>({position:[0,0,0],rotation:[0,0,0],scale:[1,1,1],pivot:'bottom-center',gridSnap:false,gridSize:0.25,surfaceSnap:true,groundAlignment:true});
export function placementSettings(input={},current=placementDefaults()){
 const s={...current,...input};for(const k of ['position','rotation','scale'])if(!Array.isArray(s[k])||s[k].length!==3||s[k].some(v=>!Number.isFinite(v)||(k==='scale'&&(v<=0||v>1000))))throw Error('Invalid '+k);if(!['origin','center','bottom-center'].includes(s.pivot))throw Error('Invalid pivot');if(!Number.isFinite(s.gridSize)||s.gridSize<=0)throw Error('Grid interval must be positive');return s;
}
export function positionPreview(THREE,object,point,settings){object.position.copy(point);object.rotation.fromArray([...settings.rotation,'XYZ']);object.scale.fromArray(settings.scale);if(settings.gridSnap)for(const axis of ['x','y','z'])object.position[axis]=Math.round(object.position[axis]/settings.gridSize)*settings.gridSize;object.updateMatrixWorld(true);if(settings.groundAlignment){const box=new THREE.Box3().setFromObject(object);if(!box.isEmpty())object.position.y+=point.y-box.min.y;}object.updateMatrixWorld(true);return object.position.toArray();}
