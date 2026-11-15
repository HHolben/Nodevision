// Nodevision/ApplicationSystem/public/MetaWorld/TerrainLOD/TileMesh.mjs
// This module installs shared-palette coarse geometry and updates only section indices during detail handoff. Coarse surfaces never participate in collision or authoring picks.
import {colorBatches} from '../Rendering/ColorBatches.mjs';
export function createTileMesh(THREE, tile, materials) {
  const palette=colorBatches(materials,new Set(tile.sections.flatMap(s=>s.faces.map(f=>Math.max(0,f.material-1)))),true);
  const positions=[],normals=[],uvs=[],colors=[],sections=[];
  for(const section of tile.sections){const faces=[];
    for(const face of section.faces){const offset=positions.length/3;
      const source=Math.max(0,face.material-1),batch=palette.mapping.get(source),color=batch?.colored?materials[source].color:null;if(!batch)continue;
      for(const v of face.vertices){positions.push(...v.p);normals.push(...v.n);uvs.push(v.p[0],v.p[2]);colors.push(color?.r??1,color?.g??1,color?.b??1);}
      faces.push({material:batch?.index??0,indices:[offset,offset+1,offset+2,offset,offset+2,offset+3]});
    }sections.push({...section,faces});
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
  geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  geometry.computeBoundingSphere();
  const mesh=new THREE.Mesh(geometry,palette.batches.map(b=>b.material));mesh.userData.terrainLOD=tile.level;mesh.userData.runtimeGenerated=true;
  let signature='';
  function mask(ready){
    const active=sections.map(s=>!ready(s.x,s.z)),key=active.map(Number).join('');if(key===signature)return;signature=key;
    const groups=new Map();sections.forEach((s,i)=>{if(active[i])for(const f of s.faces){if(!groups.has(f.material))groups.set(f.material,[]);groups.get(f.material).push(...f.indices);}});
    const indices=[];geometry.clearGroups();for(const [material,list] of groups){geometry.addGroup(indices.length,list.length,material);indices.push(...list);}geometry.setIndex(indices);mesh.visible=indices.length>0;
  }
  mask(()=>false);
  return {mesh,mask,bytes:colors.length*4+positions.length*4+normals.length*4+uvs.length*4+sections.reduce((n,s)=>n+s.faces.length*24,0),dispose(){palette.dispose();geometry.dispose();mesh.removeFromParent();}};
}
