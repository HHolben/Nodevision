// Nodevision/scripts/terrain-e3-runtime-metrics.mjs
// Fingerprint installed terrain geometry, material groups and normals outside timed frame windows. Geometric equality is stronger than vertex/triangle counts alone; shading intentionally differs.
export async function geometryFingerprint(root){
 const chunks=[];root.traverse(o=>{if(o.userData?.proceduralChunk&&o.geometry)chunks.push(o);});chunks.sort((a,b)=>a.userData.proceduralChunk.join(',').localeCompare(b.userData.proceduralChunk.join(',')));
 const geometry=[],normals=[];let vertices=0,triangles=0,bufferBytes=0;
 const text=v=>new TextEncoder().encode(JSON.stringify(v)),view=a=>new Uint8Array(a.buffer,a.byteOffset,a.byteLength);
 for(const mesh of chunks){
  const g=mesh.geometry;geometry.push(text([mesh.userData.proceduralChunk,g.groups]),view(g.attributes.position.array),view(g.attributes.uv.array),view(g.index.array));normals.push(view(g.attributes.normal.array));
  vertices+=g.attributes.position.count;triangles+=g.index.count/3;bufferBytes+=Object.values(g.attributes).reduce((n,a)=>n+a.array.byteLength,0)+g.index.array.byteLength;
 }
 async function hash(arrays){const joined=new Uint8Array(arrays.reduce((n,a)=>n+a.length,0));let at=0;for(const a of arrays){joined.set(a,at);at+=a.length;}return [...new Uint8Array(await crypto.subtle.digest('SHA-256',joined))].map(n=>n.toString(16).padStart(2,'0')).join('');}
 return {geometry:await hash(geometry),normals:await hash(normals),chunks:chunks.length,vertices,triangles,bufferBytes};
}
