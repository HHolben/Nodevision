// Nodevision/ApplicationSystem/public/MetaWorld/TerrainRepresentation/Representation.mjs
// Declares the persisted representation contract and cooperative geometry preparation shared by terrain adapters.
export function terrainRepresentation(value,fallback='voxel'){
  const result=value??fallback;if(!['voxel','polygonal'].includes(result))throw Error('Terrain representation must be voxel or polygonal.');return result;
}
export async function prepareSteps(iterator,valid=()=>true){
  while(valid()){
    const deadline=performance.now()+4;let next;
    do{next=iterator.next();if(next.done)return next.value;}while(performance.now()<deadline);
    await new Promise(resolve=>setTimeout(resolve,0));
  }
  iterator.return?.();return null;
}
