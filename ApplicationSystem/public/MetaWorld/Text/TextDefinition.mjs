// Nodevision/ApplicationSystem/public/MetaWorld/Text/TextDefinition.mjs
// This module defines versioned editable Unicode text sources, appearance presets, and validated transforms independently of disposable rendering resources.

export const TEXT_PARENT_TYPES=['box','sphere','cylinder','cone','pyramid','torus','console','object-file','iframe','image-plane'];
export const TEXT_KINDS = ['free-standing','surface','engraved','raised','sign'];
export const SIGN_PRESETS = ['wooden-signpost','stone-tablet','marble-plaque','wooden-plaque','stone-stele','rectangular','directional-arrow'];
export const GREEK_UPPER = 'Α Β Γ Δ Ε Ζ Η Θ Ι Κ Λ Μ Ν Ξ Ο Π Ρ Σ Τ Υ Φ Χ Ψ Ω';
export const GREEK_LOWER = 'α β γ δ ε ζ η θ ι κ λ μ ν ξ ο π ρ σ ς τ υ φ χ ψ ω';
export const APPEARANCES = {
 'floating-annotation': {kind:'free-standing',color:'#ffffff'},
 'engraved-limestone': {kind:'engraved',material:'limestone',color:'#403c30'},
 'engraved-marble': {kind:'engraved',material:'marble',color:'#454545'},
 'painted-ceramic': {kind:'surface',material:'Ceramic',color:'#213b92'},
 'painted-wood': {kind:'surface',material:'PineWood',color:'#ffffff'},
 'carved-wood': {kind:'engraved',material:'PineWood',color:'#392317'},
 'bronze-lettering': {kind:'raised',material:'Bronze',color:'#b78946',metalness:.8},
 'ink-on-parchment': {kind:'surface',color:'#272016',background:'#e9dbb0'}
};
const number=(v,d,min,max)=>Number.isFinite(Number(v))?Math.min(max,Math.max(min,Number(v))):d;
const vector=(v,d)=>d.map((n,i)=>number(v?.[i],n,-1e7,1e7));
export function normalizeText(source={}) {
 const d=structuredClone(source); if(d.textVersion>1)throw Error('Unsupported world text version.');
 d.id=String(d.id||globalThis.crypto.randomUUID());d.type='world-text';d.textVersion=1;
 d.kind=TEXT_KINDS.includes(d.kind)?d.kind:'free-standing';d.content=String(d.content??'Α — ΑΛΦΑ');
 d.name=String(d.name||'Text');d.position=vector(d.position,[0,1,0]);d.rotation=vector(d.rotation,[0,0,0]);d.scale=vector(d.scale,[1,1,1]);
 for(const [key,value,min,max] of [['width',2,.05,100],['height',1,.05,100],['fontSize',.3,.01,10],['lineSpacing',1.2,.5,5],['letterSpacing',0,-.1,1],['opacity',1,0,1],['depth',.04,0,2],['bevel',0,0,.2],['engravingDepth',.02,0,1],['surfaceOffset',.004,.001,1],['roughness',.8,0,1],['metalness',0,0,1],['weathering',0,0,1],['thickness',.12,.01,2],['maxDistance',150,1,10000]])d[key]=number(d[key],value,min,max);
 d.alignment=['left','center','right'].includes(d.alignment)?d.alignment:'center';
 d.font=String(d.font||'serif');d.fontUrl=String(d.fontUrl??'/fonts/dejavu/DejaVuSerif.ttf');d.color=String(d.color||'#332c24');d.background=String(d.background||'');
 d.signPreset=SIGN_PRESETS.includes(d.signPreset)?d.signPreset:'wooden-signpost';
 d.materialProperties=d.materialProperties!==false;d.material=String(d.material||'');d.sideMaterial=String(d.sideMaterial||d.material);d.surfaceMaterial=String(d.surfaceMaterial||(d.signPreset.includes('marble')?'marble':d.signPreset.includes('stone')?'limestone':'PineWood'));
 d.frameMaterial=String(d.frameMaterial||d.surfaceMaterial);d.frame=d.frame!==false;d.support=d.support??['wooden-signpost','directional-arrow'].includes(d.signPreset);
 d.parentId=String(d.parentId||'');d.visible=d.visible!==false&&d.hidden!==true;delete d.hidden;d.collider=false;d.isSolid=false;
 d.displayMode=['always','interaction','learning','hide-recall'].includes(d.displayMode)?d.displayMode:'always';
 d.links=Object.fromEntries(['file','memoryAnchor','station','audio','note'].map(k=>[k,String(d.links?.[k]||'')]));
 return d;
}
export function textVisible(def,{mode='normal',revealed=false,distance=0}={}) {
 return def.visible && distance<=def.maxDistance && (def.displayMode==='always'||def.displayMode==='interaction'&&revealed||def.displayMode==='learning'&&mode==='learning'||def.displayMode==='hide-recall'&&mode!=='recall');
}

// Source links, transforms and visibility do not require new glyph geometry or textures.
export function textRenderKey(def) {
 const keys=['kind','content','width','height','font','fontUrl','fontSize','lineSpacing','letterSpacing','alignment','color','background','opacity','depth','bevel','engravingDepth','surfaceOffset','roughness','metalness','weathering','emissive','material','sideMaterial','surfaceMaterial','frameMaterial','signPreset','thickness','frame','support','materialProperties'];
 return JSON.stringify(keys.map(key=>def[key]));
}
