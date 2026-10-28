// Nodevision/ApplicationSystem/public/SvgGeometry/MeasureSvg.mjs
// This service measures supported SVG geometry in document coordinates and returns explicit unavailable values for unsupported content. Curves use adaptive numerical contours, while filled boundaries are resolved before measuring area and perimeter.
import { pathContours, distance } from './PathContours.mjs';
import { filledRegion, regionMeasurements, clipping } from './FilledRegion.mjs';
import { documentUnits, elementMatrix } from './Coordinates.mjs';
const supported=new Set(['rect','circle','ellipse','polygon','polyline','path','line']);
function shapePath(el) {
  const n=name=>{const value=el[name]?.baseVal?.value;return Number.isFinite(value)?value:Number(el.getAttribute(name)||0);};
  const tag=el.localName;
  if(tag==='path')return el.getAttribute('d')||'';
  if(tag==='polygon'||tag==='polyline'){
    const p=el.points;return Array.from({length:p.numberOfItems},(_,i)=>{const a=p.getItem(i);return `${i?'L':'M'}${a.x} ${a.y}`;}).join(' ')+(tag==='polygon'?'Z':'');
  }
  if(tag==='line')return `M${n('x1')} ${n('y1')}L${n('x2')} ${n('y2')}`;
  if(tag==='circle'||tag==='ellipse'){
    const x=n('cx'),y=n('cy'),rx=n(tag==='circle'?'r':'rx'),ry=n(tag==='circle'?'r':'ry');
    if(rx<0||ry<0)throw Error('Invalid radius');
    return `M${x-rx} ${y}A${rx} ${ry} 0 1 0 ${x+rx} ${y}A${rx} ${ry} 0 1 0 ${x-rx} ${y}Z`;
  }
  const x=n('x'),y=n('y'),w=n('width'),h=n('height');
  if(w<0||h<0)throw Error('Invalid rectangle');
  const rx=Math.min(w/2,Math.max(0,el.hasAttribute('rx')?n('rx'):n('ry'))),ry=Math.min(h/2,Math.max(0,el.hasAttribute('ry')?n('ry'):n('rx')));
  if(!rx||!ry)return `M${x} ${y}h${w}v${h}h${-w}Z`;
  return `M${x+rx} ${y}H${x+w-rx}A${rx} ${ry} 0 0 1 ${x+w} ${y+ry}V${y+h-ry}A${rx} ${ry} 0 0 1 ${x+w-rx} ${y+h}H${x+rx}A${rx} ${ry} 0 0 1 ${x} ${y+h-ry}V${y+ry}A${rx} ${ry} 0 0 1 ${x+rx} ${y}Z`;
}
function collect(el,root,units) {
  if(el.localName==='g'){
    const children=Array.from(el.children).filter(n=>!n.hasAttribute('data-nv-editor-ui')&&!['title','desc','metadata','defs'].includes(n.localName));
    const parts=children.map(child=>collect(child,root,units));
    const regions=parts.map(p=>p.region).filter(r=>r.length);
    return {points:parts.flatMap(p=>p.points),region:regions.length?clipping.union(...regions):[],length:parts.reduce((s,p)=>s+p.length,0),open:parts.some(p=>p.open),hasArea:parts.some(p=>p.hasArea)};
  }
  if(!supported.has(el.localName))throw Error(`Measurements unavailable for <${el.localName}>`);
  const style=el.ownerDocument.defaultView.getComputedStyle(el);
  const contours=pathContours(shapePath(el),elementMatrix(el,root,units));
  const isClosed=c=>c.closed || c.points.length>1&&distance(c.points[0],c.points.at(-1))<1e-10;
  const areaContours=contours.filter(c=>isClosed(c)||style.fill!=='none' && el.localName==='path' && c.points.length>2);
  const region=filledRegion(areaContours,style.fillRule);
  const open=contours.some(c=>!isClosed(c));
  const length=contours.reduce((sum,c)=>sum+c.points.slice(1).reduce((s,p,i)=>s+distance(c.points[i],p),0),0);
  return {points:contours.flatMap(c=>c.points),region,length,open,hasArea:areaContours.length>0};
}
export function measureSvg(element,root) {
  const units=documentUnits(root);
  try{
    const result=collect(element,root,units), filled=regionMeasurements(result.region);
    let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
    for(const [x,y] of result.points){minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);}
    const empty=!result.points.length;
    return {units,area:result.hasArea&&(!result.open||filled.area>0)?filled.area:null,length:result.open?result.length:filled.perimeter,
      lengthLabel:result.open?'Path Length':'Perimeter',width:empty?null:maxX-minX,height:empty?null:maxY-minY,
      note:result.open&&result.hasArea?'Area uses filled contours and implicit path closure. Path Length sums raw subpaths, excluding implicit closing edges.':'Perimeter follows the filled boundary, including holes.'};
  }catch(error){return {units,area:null,length:null,width:null,height:null,lengthLabel:'Perimeter',note:error.message};}
}
