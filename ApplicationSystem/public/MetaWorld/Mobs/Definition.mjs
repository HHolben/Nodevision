import {speciesById} from './Registry.mjs';
export function mobDefinition(raw={}){
 const species=speciesById(raw.speciesId??'brown-hare');
 const number=(n,min,max,key)=>{if(typeof n!=='number'||!Number.isFinite(n)||n<min||n>max)throw Error('Mob: invalid '+key);return n;};
 const vector=(v,fallback,key)=>{v??=fallback;if(!Array.isArray(v)||v.length!==3)throw Error('Mob: invalid '+key);return v.map(n=>number(n,key==='scale'?.05:-1e9,key==='scale'?10:1e9,key));};
 const config={...species.defaults,...raw.behavior};for(const k of ['enabled','wander','flee','animation'])if(typeof config[k]!=='boolean')throw Error('Mob: invalid '+k);
 for(const k of ['roamingRadius','detectionRadius','fleeRadius'])number(config[k],.5,100,k);
 for(const k of ['speed','runSpeed'])number(config[k],0,10,k);
 for(const k of ['idleMin','idleMax'])number(config[k],.1,120,k);
 if(config.fleeRadius>config.detectionRadius||config.idleMin>config.idleMax||config.runSpeed<config.speed)throw Error('Mob: invalid behavior thresholds');
 const name=raw.name??species.name;if(typeof name!=='string'||name.length>120)throw Error('Mob: invalid name');
 return {...raw,type:'mob',id:raw.id||crypto.randomUUID(),speciesId:species.id,name,position:vector(raw.position,[0,0,0],'position'),rotation:vector(raw.rotation,[0,0,0],'rotation'),scale:vector(raw.scale,[1,1,1],'scale'),behavior:config,preserveLocalTransform:true,isSolid:true,collider:true};
}
