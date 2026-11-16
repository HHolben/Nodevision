// One authoritative definition drives visible rings and local-space scoring. Boundary lines award the inner ring.
export const RINGS=Object.freeze([['bullseye','#f4cd38',10],['red','#d84237',8],['blue','#2585cf',6],['black','#202327',4],['white','#eeeeea',2]].map(([id,color,score],i)=>Object.freeze({id,color,score,radius:(i+1)/5})));
export function targetDefinition(raw={}){
 const fail=m=>{throw Error('Archery Target: '+m);},number=(v,min,max,name)=>{if(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max)fail(name+' is outside its valid range');return v;};
 const vector=(v,fallback,name)=>{v=v??fallback;if(!Array.isArray(v)||v.length!==3)fail(name+' requires three numbers');return v.map(n=>number(n,-1e9,1e9,name));};
 const position=vector(raw.position,[0,0,0],'position'),rotation=vector(raw.rotation,[0,0,0],'rotation'),scale=vector(raw.scale,[1,1,1],'scale');if(scale.some(v=>v<.01||v>100))fail('scale must be positive (0.01–100)');
 const rings=(raw.rings??RINGS).map((r,i)=>({...RINGS[i],radius:number(r.radius,.001,1,'ring radius'),score:number(r.score,0,1000,'ring score')}));
 if(rings.length!==5||rings.some((r,i)=>i&&r.radius<=rings[i-1].radius)||rings.at(-1).radius!==1)fail('five increasing ring radii must end at 100%');
 const text=(v,n)=>{if(typeof v!=='string'||v.length>n)fail('text is too long or invalid');return v;};
 const diameter=number(raw.diameter??1.2,.1,10,'diameter'),faceHeight=number(raw.faceHeight??1.5,.1,20,'face height');if(faceHeight<diameter/2)fail('face must clear ground');
 return {...raw,type:'archery-target',id:raw.id||globalThis.crypto.randomUUID(),name:text(raw.name??'Archery Target',120),position,rotation,scale,diameter,faceHeight,thickness:number(raw.thickness??.12,.02,.5,'thickness'),rings,label:text(raw.label??'',64),greekLetter:text(raw.greekLetter??'',32),showStand:raw.showStand!==false,enabled:raw.enabled!==false,feedback:raw.feedback!==false,visible:raw.visible!==false&&raw.hidden!==true,preserveLocalTransform:true,isSolid:true,collider:true};
}
export function scoreLocal(def,point){const radialDistance=Math.hypot(point[0],point[1]-def.faceHeight),normalizedRadialDistance=radialDistance/(def.diameter/2);if(normalizedRadialDistance>1+1e-9)return null;const ring=def.rings.find(r=>normalizedRadialDistance<=r.radius+1e-9);return {ringId:ring.id,score:ring.score,radialDistance,normalizedRadialDistance,localPoint:[...point]};}
