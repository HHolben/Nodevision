// Nodevision/ApplicationSystem/public/MetaWorld/ConstructionEditing/Scene.mjs
// Focused geometry outside procedural terrain extents receives its own transient renderer and collision bounds, while conflict highlights remain separate helpers.
import {cellPreview} from './Preview.mjs';
export function constructionEditScene(edit,signal){
 const T=edit.ctx.THREE,root=new T.Group();root.position.fromArray(edit.position);root.scale.setScalar(.25);edit.ctx.scene.add(root);const conflicts=cellPreview(T,root,0xff3355),selection=cellPreview(T,root,0xb487ff),batches=new Map();let revision=-1;
 function refresh(){
  const region=edit.geometry;conflicts.update(edit.intersections(region).map(c=>c.at));selection.update([...(edit.selection?.selection||[])].map(k=>k.split(',').map(Number)));
  if(revision===edit.layer.revision)return;revision=edit.layer.revision;
  for(const mesh of batches.values()){mesh.removeFromParent();mesh.geometry.dispose();mesh.material.dispose();mesh.dispose();}batches.clear();
  const groups=new Map();for(const {at,value} of edit.layer.entries()){if(!value||edit.api.contains(edit.world(at)))continue;const key=value.rgba.join(',');if(!groups.has(key))groups.set(key,[]);groups.get(key).push(at);}
  for(const [key,points] of groups){const rgba=key.split(',').map(Number),color=new T.Color().setRGB(...rgba.slice(0,3).map(n=>n/255),T.SRGBColorSpace),mesh=new T.InstancedMesh(new T.BoxGeometry(1,1,1),new T.MeshBasicMaterial({color,transparent:rgba[3]<255,opacity:rgba[3]/255}),points.length),matrix=new T.Matrix4();points.forEach((p,i)=>mesh.setMatrixAt(i,matrix.makeTranslation(...p.map(n=>n+.5))));mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();mesh.raycast=()=>{};root.add(mesh);batches.set(key,mesh);}
  const points=region.cells.map(c=>c.at),bounds=points.length?{min:[0,1,2].map(i=>Math.min(...points.map(p=>p[i]))),max:[0,1,2].map(i=>Math.max(...points.map(p=>p[i]))+1)}:null;
  edit.runtime.setEditGeometry({bounds:bounds&&{min:bounds.min.map((n,i)=>edit.position[i]+n*.25),max:bounds.max.map((n,i)=>edit.position[i]+n*.25)},sample:p=>edit.layer.effective(p.map((n,i)=>Math.floor((n-edit.position[i])/.25)))});
 }
 signal.addEventListener('abort',()=>{conflicts.dispose();selection.dispose();for(const mesh of batches.values()){mesh.geometry.dispose();mesh.material.dispose();mesh.dispose();}root.removeFromParent();edit.runtime.setEditGeometry(null);},{once:true});return {refresh};
}
