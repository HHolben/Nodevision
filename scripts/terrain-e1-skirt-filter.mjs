// Nodevision/scripts/terrain-e1-skirt-filter.mjs
// This profiling-only filter removes exactly coincident, oppositely wound opaque vertical quads from an already masked coarse mesh. Horizontal surfaces, unmatched boundaries, custom shaders, transparency and displaced geometry remain untouched.
export function skirtFilter(geometry,materials){
 const p=geometry.attributes.position,c=geometry.attributes.color,index=Array.from(geometry.index.array),faces=[],pairs=new Map();
 for(const group of geometry.groups){const m=materials[group.materialIndex],safe=m&&!m.transparent&&m.opacity===1&&!m.wireframe&&!m.displacementMap&&!Object.hasOwn(m,'onBeforeCompile');
  for(let i=group.start;i<group.start+group.count;i+=6){const indices=index.slice(i,i+6),vertices=[indices[0],indices[1],indices[2],indices[5]].map(n=>[p.getX(n),p.getY(n),p.getZ(n)]),face={indices,materialIndex:group.materialIndex,remove:false};faces.push(face);
   if(!safe||!vertices.every(v=>v[0]===vertices[0][0])&&!vertices.every(v=>v[2]===vertices[0][2]))continue;
   const [a,b,d]=vertices,ab=b.map((n,j)=>n-a[j]),ad=d.map((n,j)=>n-a[j]),normal=[ab[1]*ad[2]-ab[2]*ad[1],ab[2]*ad[0]-ab[0]*ad[2],ab[0]*ad[1]-ab[1]*ad[0]];
   const key=group.materialIndex+':'+(c?[c.getX(indices[0]),c.getY(indices[0]),c.getZ(indices[0])].join(','):'')+':'+vertices.map(v=>v.join(',')).sort().join(';');
   if(!pairs.has(key))pairs.set(key,[]);pairs.get(key).push({face,normal});
  }
 }
 for(const pair of pairs.values())if(pair.length===2&&pair[0].normal.reduce((sum,n,i)=>sum+n*pair[1].normal[i],0)<0)for(const e of pair)e.face.remove=true;
 const filtered=[],groups=[];for(const f of faces){if(f.remove)continue;let group=groups.at(-1);if(!group||group.materialIndex!==f.materialIndex){group={start:filtered.length,count:0,materialIndex:f.materialIndex};groups.push(group);}filtered.push(...f.indices);group.count+=f.indices.length;}
 return {original:index,originalGroups:geometry.groups.map(g=>({...g})),filtered,groups,removedTriangles:(index.length-filtered.length)/3};
}
