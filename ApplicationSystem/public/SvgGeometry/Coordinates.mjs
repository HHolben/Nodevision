// Nodevision/ApplicationSystem/public/SvgGeometry/Coordinates.mjs
// This module resolves SVG document coordinates and reliable physical display units without including editor camera transforms. Physical dimensions are used only when both root dimensions explicitly specify absolute units.
const physical={mm:1,cm:10,in:25.4,pt:25.4/72,pc:25.4/6,Q:0.25};
export function documentUnits(root) {
  const parse=value=>{const match=String(value||'').trim().match(/^([+\d.eE-]+)\s*(mm|cm|in|pt|pc|Q)$/);return match&&Number(match[1])>0?{value:Number(match[1]),unit:match[2]}:null;};
  const w=parse(root.getAttribute('width')),h=parse(root.getAttribute('height'));
  const vb=root.viewBox?.baseVal;
  if(!w || !h)return {name:'SVG user units',length:'user units',area:'user units²',x:1,y:1};
  const width=w.value, height=h.value*physical[h.unit]/physical[w.unit];
  let x=physical[w.unit] ? 25.4/96/physical[w.unit] : 1,y=x;
  if(vb?.width>0 && vb?.height>0){
    x=width/vb.width;y=height/vb.height;
    const aspect=root.getAttribute('preserveAspectRatio')||'xMidYMid meet';
    if(!/\bnone\b/.test(aspect))x=y=/\bslice\b/.test(aspect)?Math.max(x,y):Math.min(x,y);
  }
  return {name:w.unit,length:w.unit,area:w.unit+'²',x,y};
}
export function elementMatrix(element,root,units) {
  // Multiplying SVG transform lists avoids CSS zoom, pan, hidden-element CTM failures,
  // and any editor transforms outside the SVG document.
  let matrix=new DOMMatrix();const chain=[];
  const rootTransforms=root.transform?.baseVal;
  for(let i=0;i<(rootTransforms?.numberOfItems||0);i++)matrix=matrix.multiply(rootTransforms.getItem(i).matrix);
  for(let node=element;node && node!==root;node=node.parentElement)chain.unshift(node);
  for(const node of chain){
    if(node.localName==='svg')throw Error('Nested SVG viewports are not supported');
    const style=node.ownerDocument.defaultView.getComputedStyle(node);
    const list=node.transform?.baseVal;let local=new DOMMatrix();
    for(let i=0;i<(list?.numberOfItems||0);i++)local=local.multiply(list.getItem(i).matrix);
    const computed=style.transform==='none'?new DOMMatrix():new DOMMatrix(style.transform);
    if(node.style?.transform==='none'&&!local.isIdentity || style.transform!=='none' && (['a','b','c','d','e','f'].some(key=>Math.abs(local[key]-computed[key])>1e-5*Math.max(1,Math.abs(local[key]))) || (!local.isIdentity && style.transformOrigin.split(' ').some(value=>parseFloat(value)!==0))))throw Error('CSS transform overrides and transform origins are not supported');
    matrix=matrix.multiply(local);
  }
  return new DOMMatrix().scale(units.x,units.y).multiply(matrix);
}
