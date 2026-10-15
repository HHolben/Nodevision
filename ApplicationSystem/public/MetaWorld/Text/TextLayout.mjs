// Nodevision/ApplicationSystem/public/MetaWorld/Text/TextLayout.mjs
// This module shapes complete Unicode runs with the browser canvas engine and wraps at grapheme boundaries while retaining editable source text.

const fonts=new Map();
export async function loadTextFont(def) {
 if(!def.fontUrl)return def.font;
 const url=new URL(def.fontUrl,location.origin);
 if(url.origin!==location.origin||!/^https?:$/.test(url.protocol))throw Error('Choose a local application or Notebook font URL.');
 if(!fonts.has(url.href)) {
  const family='nv-world-font-'+fonts.size;
  fonts.set(url.href,new FontFace(family,`url(${JSON.stringify(url.href)})`).load().then(face=>{document.fonts.add(face);return family;}));
 }
 return fonts.get(url.href);
}
export function wrapText(text,measure,width) {
 const segmenter=new Intl.Segmenter(undefined,{granularity:'grapheme'}),lines=[];
 for(const paragraph of text.split('\n')) {
  let line='';
  for(const {segment} of segmenter.segment(paragraph)) {
   if(line&&measure(line+segment)>width){lines.push(line);line='';}line+=segment;
  }lines.push(line);
 }return lines;
}
export function textCanvas(def,family=def.font) {
 const canvas=document.createElement('canvas'),density=Math.min(256,1024/Math.max(def.width,def.height));
 canvas.width=Math.max(16,Math.ceil(def.width*density));canvas.height=Math.max(16,Math.ceil(def.height*density));
 const c=canvas.getContext('2d',{willReadFrequently:true});
 c.font=`${def.fontSize*density}px ${family}, serif`;c.textBaseline='top';c.textAlign=def.alignment;
 if('letterSpacing' in c)c.letterSpacing=`${def.letterSpacing*density}px`;
 const padding=8,lines=wrapText(def.content,s=>c.measureText(s).width,canvas.width-padding*2);
 const x=def.alignment==='left'?padding:def.alignment==='right'?canvas.width-padding:canvas.width/2;
 c.fillStyle='#ffffff';lines.forEach((line,i)=>c.fillText(line,x,padding+i*def.fontSize*density*def.lineSpacing));
 if(def.weathering>0){
  // Deterministic wear changes the mask without changing the Unicode source or using per-character layout.
  c.globalCompositeOperation='destination-out';c.fillStyle='rgba(0,0,0,.45)';
  let seed=2166136261;for(const char of def.content)seed=Math.imul(seed^char.codePointAt(0),16777619)>>>0;
  for(let i=0;i<canvas.width*canvas.height*def.weathering/80;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;const x=seed%canvas.width;seed=(Math.imul(seed,1664525)+1013904223)>>>0;c.fillRect(x,seed%canvas.height,1+def.weathering*2,1);}
 }
 return canvas;
}
