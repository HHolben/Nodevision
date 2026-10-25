// Nodevision/ApplicationSystem/public/MetaWorld/Paths/PathEnvelope.mjs
// Builds a transient translucent directional clearance preview along the same sampled centerline used by terrain modifiers.
export function clearanceEnvelope(THREE,def,samples,origin=[0,0,0]){
  const positions=[],indices=[];
  for(let i=0;i<samples.length;i++){
    const p=samples[i],a=samples[Math.max(0,i-1)],b=samples[Math.min(samples.length-1,i+1)],dx=b[0]-a[0],dz=b[2]-a[2],length=Math.hypot(dx,dz)||1;
    for(const [side,y] of [[1,-(def.lowerClearance||0)],[-1,-(def.lowerClearance||0)],[-1,def.upperClearance||0],[1,def.upperClearance||0]]){
      const width=def.width/2+(side>0?def.leftClearance||0:def.rightClearance||0);
      positions.push(p[0]-side*dz/length*width-origin[0],p[1]+y-origin[1],p[2]+side*dx/length*width-origin[2]);
    }
    if(i)for(let side=0;side<4;side++){const a=(i-1)*4+side,b=(i-1)*4+(side+1)%4,c=i*4+side,d=i*4+(side+1)%4;indices.push(a,b,c,b,d,c);}
  }
  if(samples.length){const end=(samples.length-1)*4;indices.push(0,1,2,0,2,3,end,end+2,end+1,end,end+3,end+2);}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setIndex(indices);g.computeVertexNormals();
  const mesh=new THREE.Mesh(g,new THREE.MeshBasicMaterial({color:0xffa52b,transparent:true,opacity:.18,side:THREE.DoubleSide,depthWrite:false}));
  mesh.userData.runtimeGenerated=true;mesh.userData.isEditorHelper=true;mesh.renderOrder=21;return mesh;
}
