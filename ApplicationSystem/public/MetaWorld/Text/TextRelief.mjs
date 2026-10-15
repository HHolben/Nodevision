// Nodevision/ApplicationSystem/public/MetaWorld/Text/TextRelief.mjs
// This module creates bounded raster-contour extrusion geometry from shaped Unicode masks without assuming that characters map one-to-one to glyphs.

export function reliefGeometry(THREE,canvas,def) {
 const small=document.createElement('canvas');small.width=Math.min(256,canvas.width);small.height=Math.min(256,Math.max(1,Math.round(small.width*canvas.height/canvas.width)));
 const ctx=small.getContext('2d');ctx.drawImage(canvas,0,0,small.width,small.height);
 const {data}=ctx.getImageData(0,0,small.width,small.height),w=small.width,h=small.height,positions=[],indices=[];
 const on=(x,y)=>x>=0&&y>=0&&x<w&&y<h&&data[(y*w+x)*4+3]>100;
 const px=def.width/w,py=def.height/h,z=def.depth;
 const quad=(a,b,c,d)=>{const n=positions.length/3;positions.push(...a,...b,...c,...d);indices.push(n,n+1,n+2,n,n+2,n+3);};
 for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(on(x,y)) {
  const l=x*px-def.width/2,r=l+px,t=def.height/2-y*py,b=t-py;
  const bevel=Math.min(def.bevel,z/2,px*.45,py*.45),left=on(x-1,y)?l:l+bevel,right=on(x+1,y)?r:r-bevel,top=on(x,y-1)?t:t-bevel,bottom=on(x,y+1)?b:b+bevel;
  quad([left,bottom,z],[right,bottom,z],[right,top,z],[left,top,z]);
  if(bevel){quad([l,b,z-bevel],[r,b,z-bevel],[right,bottom,z],[left,bottom,z]);quad([r,b,z-bevel],[r,t,z-bevel],[right,top,z],[right,bottom,z]);quad([r,t,z-bevel],[l,t,z-bevel],[left,top,z],[right,top,z]);quad([l,t,z-bevel],[l,b,z-bevel],[left,bottom,z],[left,top,z]);}
  if(!on(x-1,y))quad([l,b,0],[l,b,z],[l,t,z],[l,t,0]);
  if(!on(x+1,y))quad([r,b,z],[r,b,0],[r,t,0],[r,t,z]);
  if(!on(x,y-1))quad([l,t,z],[r,t,z],[r,t,0],[l,t,0]);
  if(!on(x,y+1))quad([l,b,0],[r,b,0],[r,b,z],[l,b,z]);
 }
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setIndex(indices);geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();return geometry;
}
