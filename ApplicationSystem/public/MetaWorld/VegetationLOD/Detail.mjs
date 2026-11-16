// Nodevision/ApplicationSystem/public/MetaWorld/VegetationLOD/Detail.mjs
// Attribute only authoritative procedural vegetation vertices in existing merged chunk meshes. Collision, indices, canonical material groups and nonprocedural vertices remain unchanged; one shared owned material clone per palette entry supplies opaque coverage.
import {featureMaterialPriority} from '../ProceduralVoxelWorld/VoxelMaterialIds.mjs';
import {vegetationDither} from './Dither.mjs';
export function vegetationDetail(THREE,generator,ownership){
 const clones=new Map(),hidden=new Map(),entries=new Set(),stats={preparationMs:0,attributeBytes:0};
 function attach(entry,cell){
  const mesh=entry.mesh;if(!mesh||mesh.userData.disposeVegetation)return;if(!mesh.geometry.groups.some(g=>featureMaterialPriority(g.materialIndex+1)>0))return;const started=performance.now(),record=()=>{const elapsed=performance.now()-started;stats.preparationMs+=elapsed;entry.installationMs=(entry.installationMs||0)+elapsed;entry.buildMs=(entry.buildMs||0)+elapsed;};const g=mesh.geometry,p=g.attributes.position,n=g.attributes.normal,ids=new Uint16Array(p.count),refs=new Map();
  const min=cell.map(v=>v*32-2),max=min.map(v=>v+36),features=generator.features.query(min,max),materials=mesh.material.slice();
  for(const group of g.groups){
   const material=group.materialIndex+1;if(featureMaterialPriority(material)<=0)continue;
   const original=materials[group.materialIndex];if(!original)continue;
   if(!clones.has(original))clones.set(original,vegetationDither(original,ownership.texture));materials[group.materialIndex]=clones.get(original);
   for(let at=group.start;at<group.start+group.count;at+=3){
    const triangle=Array.from(g.index.array.slice(at,at+3));if(triangle.every(i=>ids[i]))continue;
    const point=[0,1,2].map(a=>cell[a]*32+triangle.reduce((q,i)=>q+p.array[i*3+a]*4-n.array[i*3+a]*.51,0)/3),v=point.map(Math.floor);
    for(const f of features){
     if(!point.every((q,a)=>q>=f.min[a]-1&&q<=f.max[a]+1))continue;
     let matches=generator.getFeatureVoxel(...v,[f])===material;
     // An authored opinion at the face centre is not procedural ownership.
     if(!matches&&generator.getRenderVoxel?.(...v)===material)continue;
     const lo=point.map(q=>Math.floor(q-.5));
     for(let z=0;z<2&&!matches;z++)for(let y=0;y<2&&!matches;y++)for(let x=0;x<2&&!matches;x++)matches=generator.getFeatureVoxel(lo[0]+x,lo[1]+y,lo[2]+z,[f])===material;
     if(!matches)continue;
     if(!refs.has(f.id))refs.set(f.id,ownership.retain(f,'detail'));for(const i of triangle)ids[i]=refs.get(f.id);break;
    }
   }
  }
  if(!refs.size){record();return;}
  const sections=new Map();for(const group of g.groups)if(featureMaterialPriority(group.materialIndex+1)>0){const owners=new Set();for(let i=group.start;i<group.start+group.count;i++)owners.add(ids[g.index.array[i]]);sections.set(group.materialIndex,[...owners].map(slot=>[...refs].find(([,value])=>value===slot)?.[0]??null));}
  const base=mesh.material;mesh.userData.vegetationSections={sections,base};entries.add(entry);
  g.setAttribute('nvTree',new THREE.BufferAttribute(ids,1));mesh.userData.vegetationOriginal=mesh.material;mesh.material=materials;entry.residentBytes+=ids.byteLength;stats.attributeBytes+=ids.byteLength;
  mesh.userData.disposeVegetation=()=>{for(const id of refs.keys())ownership.release(id,'detail');refs.clear();stats.attributeBytes=Math.max(0,stats.attributeBytes-ids.byteLength);entries.delete(entry);delete mesh.userData.vegetationSections;delete mesh.userData.disposeVegetation;};record();
 }
 return {attach,snapshot:()=>({...stats}),sync(){for(const entry of entries){const mesh=entry.mesh,{sections,base}=mesh.userData.vegetationSections;for(const [index,ids] of sections){const values=ids.map(id=>id===null?1:ownership.value(id)??1),original=base[index];let material=original;if(values.every(v=>v===0)){if(!hidden.has(original)){const m=original.clone();m.visible=false;hidden.set(original,m);}material=hidden.get(original);}else if(!values.every(v=>v===1))material=clones.get(original);mesh.material[index]=material;}}},detach(entry){const mesh=entry.mesh;if(!mesh?.userData.disposeVegetation)return 0;mesh.userData.disposeVegetation();mesh.material=mesh.userData.vegetationOriginal;delete mesh.userData.vegetationOriginal;const bytes=mesh.geometry.attributes.nvTree?.array.byteLength||0;mesh.geometry.dispose();mesh.geometry.deleteAttribute('nvTree');entry.residentBytes-=bytes;return bytes;},dispose(){for(const material of [...clones.values(),...hidden.values()])material.dispose();clones.clear();hidden.clear();entries.clear();stats.attributeBytes=0;}};
}
