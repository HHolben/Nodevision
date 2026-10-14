// Nodevision/ApplicationSystem/public/MetaWorld/Paths/PathSegments.mjs
// This spatial index bounds local corridor queries and rejects crossing centerlines before a path creates ambiguous overlapping road surfaces.
const cross=(a,b,c)=>(b[0]-a[0])*(c[2]-a[2])-(b[2]-a[2])*(c[0]-a[0]);
export function indexPathSegments(samples,radius,closed=false) {
  const cells=new Map(),size=Math.max(2,radius),segments=samples.slice(1).map((b,i)=>({a:samples[i],b,i}));
  const key=(x,z)=>`${x},${z}`;
  function cellRange(a,b,padding,visit) {
    for(let z=Math.floor((Math.min(a[2],b[2])-padding)/size);z<=Math.floor((Math.max(a[2],b[2])+padding)/size);z++)
      for(let x=Math.floor((Math.min(a[0],b[0])-padding)/size);x<=Math.floor((Math.max(a[0],b[0])+padding)/size);x++)visit(key(x,z));
  }
  for(const segment of segments) {
    const {a,b,i}=segment,checked=new Set();
    cellRange(a,b,0,k=>{
      for(const other of cells.get(k)||[]) {
        if(Math.abs(other.i-i)<=1||(closed&&other.i===0&&i===segments.length-1)||checked.has(other.i))continue;checked.add(other.i);
        const {a:c,b:d}=other;
        if(Math.max(a[0],b[0])<Math.min(c[0],d[0])||Math.max(c[0],d[0])<Math.min(a[0],b[0])||Math.max(a[2],b[2])<Math.min(c[2],d[2])||Math.max(c[2],d[2])<Math.min(a[2],b[2]))continue;
        if(cross(a,b,c)*cross(a,b,d)<=0&&cross(c,d,a)*cross(c,d,b)<=0)throw Error('Path crosses itself. Split the crossing into separate paths.');
      }
    });
    cellRange(a,b,0,k=>{if(!cells.has(k))cells.set(k,[]);cells.get(k).push(segment);});
  }
  return (x,z,limit=radius)=>{
    let best={distance:Infinity,height:NaN};const seen=new Set(),p=[x,0,z];
    cellRange(p,p,limit,k=>{for(const {a,b,i} of cells.get(k)||[]) {
      if(seen.has(i))continue;seen.add(i);
      const dx=b[0]-a[0],dz=b[2]-a[2],den=dx*dx+dz*dz;if(den<1e-12)continue;
      const t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[2])*dz)/den)),distance=Math.hypot(x-a[0]-t*dx,z-a[2]-t*dz);
      if(distance<best.distance)best={distance,height:a[1]+t*(b[1]-a[1])};
    }});return best;
  };
}
