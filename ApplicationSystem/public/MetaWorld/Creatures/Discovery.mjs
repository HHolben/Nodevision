import {extractCreatureWorld,validateCreatureWorld,BUILTIN_HARE} from './Document.mjs';
import {readCreatureText,checkCreatureDependencies} from './Read.mjs';
import {brownHare} from '../Mobs/Registry.mjs';
let cached=null,pending=null;
export function invalidateCreatureDiscovery(){cached=null;}
export async function discoverCreatures({refresh=false,search,read=readCreatureText}={}){
 if(cached&&!refresh)return cached;if(pending)return pending;
 pending=(async()=>{const response=search?await search():await fetch('/api/search?q='+encodeURIComponent('"documentType"')+'&scope=content&limit=300').then(r=>{if(!r.ok)throw Error('Notebook creature search unavailable');return r.json();});
 const entries=[{...brownHare,document:BUILTIN_HARE}],errors=[],ids=new Map([[brownHare.id,BUILTIN_HARE]]),documentIds=new Map([[brownHare.documentId,BUILTIN_HARE]]);const paths=[...new Set(response.files||[])].filter(p=>/\.html?$/i.test(p));
 for(const path of paths){try{const reference='/Notebook/'+path.replace(/^\/?Notebook\//,'').split('/').map(encodeURIComponent).join('/'),a=validateCreatureWorld(extractCreatureWorld(await read(reference)),reference);if(ids.has(a.species.id)||documentIds.has(a.species.documentId)){const prior=ids.get(a.species.id)||documentIds.get(a.species.documentId);errors.push({path,error:'Duplicate species/document identity: '+a.species.id+' (also '+prior+')'});if(prior!==BUILTIN_HARE){const i=entries.findIndex(e=>e.document===prior);if(i>=0)entries.splice(i,1);}continue;}if(read===readCreatureText)await checkCreatureDependencies(a.dependencies);ids.set(a.species.id,a.document);documentIds.set(a.species.documentId,a.document);entries.push(a.species);}catch(e){errors.push({path,error:e.message});}}
 return cached={entries,errors,truncated:(response.total||0)>=300};})();try{return await pending;}finally{pending=null;}
}
