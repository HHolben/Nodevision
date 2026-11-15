// Nodevision/ApplicationSystem/public/MetaWorld/TerrainDiagnostics/SceneSubmission.mjs
// This on-demand scene inspection estimates visible distant draw inputs using the same object bounds as Three.js frustum culling. It distinguishes estimated submitted instances and indexed vertex references from actual renderer counters and does not execute during ordinary unprofiled frames.
export function distantSubmission(root,frustum){
 const totals={visibleMeshes:0,materialGroups:0,submittedInstancesEstimate:0,vertexReferencesEstimate:0,coarseMeshes:0,vegetationMeshes:0,geometryUploadBytes:null};
 root.traverseVisible?.(mesh=>{
  if(!mesh.isMesh||mesh.isInstancedMesh&&mesh.count===0||(!mesh.userData.terrainLOD&&!mesh.userData.vegetationProxy)||frustum&&mesh.frustumCulled&&!frustum.intersectsObject(mesh))return;
  const g=mesh.geometry,count=mesh.isInstancedMesh?mesh.count:1,indices=Math.min(g.index?.count??g.attributes.position.count,g.drawRange.count);
  totals.visibleMeshes++;totals.materialGroups+=Array.isArray(mesh.material)?g.groups.length:1;
  totals.submittedInstancesEstimate+=mesh.isInstancedMesh?mesh.count:0;totals.vertexReferencesEstimate+=indices*count;
  if(mesh.userData.terrainLOD)totals.coarseMeshes++;else totals.vegetationMeshes++;
 });
 return totals;
}
