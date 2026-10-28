// Nodevision/ApplicationSystem/public/SvgGeometry/PathContours.mjs
// This module flattens SVG path commands into measurement contours using adaptive subdivision in document coordinates. It preserves subpath boundaries and explicit closure independently of the editable path model, whose command subset cannot represent general SVG paths.
const arity = { M:2, L:2, H:1, V:1, C:6, S:4, Q:4, T:2, A:7, Z:0 };
export const distance = (a,b) => Math.hypot(a[0]-b[0],a[1]-b[1]);
export const transformPoint = (p,m) => [m.a*p[0]+m.c*p[1]+m.e,m.b*p[0]+m.d*p[1]+m.f];
const midpoint = (a,b) => [(a[0]+b[0])/2,(a[1]+b[1])/2];
function flattenBezier(points, output, tolerance, depth=0) {
  const chord=distance(points[0],points.at(-1));
  const length=points.slice(1).reduce((sum,p,i)=>sum+distance(points[i],p),0);
  if (length-chord <= tolerance && depth > 0 || depth >= 20) { output.push(points.at(-1)); return; }
  let row=points, left=[row[0]], right=[row.at(-1)];
  while(row.length>1) { row=row.slice(1).map((p,i)=>midpoint(row[i],p)); left.push(row[0]); right.unshift(row.at(-1)); }
  flattenBezier(left,output,tolerance/2,depth+1); flattenBezier(right,output,tolerance/2,depth+1);
}
function arcPoints(start, values, end, m, output, tolerance) {
  let [rx,ry,angle,large,sweep]=values; rx=Math.abs(rx); ry=Math.abs(ry);
  if(!rx || !ry || distance(start,end)===0) {output.push(transformPoint(end,m));return;}
  const phi=angle*Math.PI/180, co=Math.cos(phi), si=Math.sin(phi);
  const dx=(start[0]-end[0])/2, dy=(start[1]-end[1])/2;
  const x=co*dx+si*dy, y=-si*dx+co*dy;
  const scale=Math.sqrt(x*x/(rx*rx)+y*y/(ry*ry)); if(scale>1){rx*=scale;ry*=scale;}
  const factor=(large===sweep?-1:1)*Math.sqrt(Math.max(0,(rx*rx*ry*ry-rx*rx*y*y-ry*ry*x*x)/(rx*rx*y*y+ry*ry*x*x)));
  const cx=factor*rx*y/ry, cy=-factor*ry*x/rx;
  const center=[co*cx-si*cy+(start[0]+end[0])/2,si*cx+co*cy+(start[1]+end[1])/2];
  const first=Math.atan2((y-cy)/ry,(x-cx)/rx);
  let delta=Math.atan2((-y-cy)/ry,(-x-cx)/rx)-first;
  if(sweep && delta<0)delta+=2*Math.PI; if(!sweep && delta>0)delta-=2*Math.PI;
  const radius=Math.max(rx,ry)*Math.hypot(m.a,m.b,m.c,m.d);
  const count=Math.max(8,Math.ceil(Math.abs(delta)/Math.sqrt(8*tolerance/Math.max(radius,tolerance))));
  if(count>65536)throw Error('Geometry exceeds measurement precision budget');
  for(let i=1;i<=count;i++){const t=first+delta*i/count;output.push(transformPoint([center[0]+co*rx*Math.cos(t)-si*ry*Math.sin(t),center[1]+si*rx*Math.cos(t)+co*ry*Math.sin(t)],m));}
}
export function pathContours(d, m, tolerance=1e-5) {
  const tokens=String(d).match(/[a-zA-Z]|[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:[eE][-+]?\d+)?/g)||[];
  let i=0, cmd='', cursor=[0,0], start=cursor, contour=null, control=null, previous=''; const contours=[];
  while(i<tokens.length){
    if(/^[a-z]$/i.test(tokens[i]))cmd=tokens[i++];
    const upper=cmd.toUpperCase(), relative=cmd!==upper, n=arity[upper];
    if(n===undefined)throw Error('Unsupported path command');
    if(upper==='Z'){if(contour){contour.closed=true;contour.points.push(transformPoint(start,m));}cursor=start;control=null;previous=upper;cmd='';continue;}
    if(i+n>tokens.length || tokens.slice(i,i+n).some(v=>!Number.isFinite(Number(v))))throw Error('Invalid path');
    const v=tokens.slice(i,i+n).map(Number);i+=n;
    const point=(offset)=>[v[offset]+(relative?cursor[0]:0),v[offset+1]+(relative?cursor[1]:0)];
    let end=cursor, nextControl=null;
    if(upper==='M'){cursor=point(0);start=cursor;contour={points:[transformPoint(cursor,m)],closed:false};contours.push(contour);cmd=relative?'l':'L';}
    else {
      if(!contour)throw Error('Path must begin with moveto');
      if(upper==='L')end=point(0);
      if(upper==='H')end=[v[0]+(relative?cursor[0]:0),cursor[1]];
      if(upper==='V')end=[cursor[0],v[0]+(relative?cursor[1]:0)];
      let controls=[];
      const reflected=control?[2*cursor[0]-control[0],2*cursor[1]-control[1]]:cursor;
      if(upper==='C'){controls=[point(0),point(2)];end=point(4);nextControl=controls[1];}
      if(upper==='S'){controls=[/[CS]/.test(previous)?reflected:cursor,point(0)];end=point(2);nextControl=controls[1];}
      if(upper==='Q'){controls=[point(0)];end=point(2);nextControl=controls[0];}
      if(upper==='T'){controls=[/[QT]/.test(previous)?reflected:cursor];end=point(0);nextControl=controls[0];}
      if(upper==='A'){end=point(5);arcPoints(cursor,v,end,m,contour.points,tolerance);}
      else if(controls.length)flattenBezier([cursor,...controls,end].map(p=>transformPoint(p,m)),contour.points,tolerance);
      else contour.points.push(transformPoint(end,m));
      cursor=end;
    }
    control=nextControl;previous=upper;
    if(contour.points.length>100000)throw Error('Geometry exceeds measurement precision budget');
  }
  return contours;
}
