import {prepareBehaviorProgram,resolveProgramLibraries} from '../Creatures/Behaviors/Library.mjs';
import {BUILTIN_HARE,resourcePath,extractCreatureWorld,validateCreatureWorld} from '../Creatures/Document.mjs';
import {readCreatureText,checkCreatureDependencies} from '../Creatures/Read.mjs';
const documents=new Map(),pending=new Map(),builtins=new Map();
export const creatureResolutionStats={reads:0,cacheHits:0,parseMs:0,dependencyMs:0};
export function registerCreatureWorld(world,reference){let assembly=validateCreatureWorld(world,resourcePath(reference));if(assembly.species.behaviorProgram?.libraries){const runtimeBehaviorProgram=resolveProgramLibraries(assembly.species.behaviorProgram,assembly.document);assembly=Object.freeze({...assembly,species:Object.freeze({...assembly.species,runtimeBehaviorProgram})});}documents.set(assembly.document,assembly);return assembly;}
export async function resolveCreature(reference,{reload=false,read=readCreatureText}={}){
 const key=resourcePath(reference);if(!reload&&documents.has(key)){creatureResolutionStats.cacheHits++;return documents.get(key);}if(pending.has(key))return pending.get(key);
 const task=(async()=>{creatureResolutionStats.reads++;const html=await read(key),start=performance.now(),rawAssembly=validateCreatureWorld(extractCreatureWorld(html),key);const runtimeBehaviorProgram=rawAssembly.species.behaviorProgram?await prepareBehaviorProgram(rawAssembly.species.behaviorProgram,key,{reload,read}):undefined,assembly=Object.freeze({...rawAssembly,species:Object.freeze({...rawAssembly.species,...(runtimeBehaviorProgram?{runtimeBehaviorProgram}:{})})});creatureResolutionStats.parseMs+=performance.now()-start;const dependencyStart=performance.now();if(read===readCreatureText)await checkCreatureDependencies(assembly.dependencies);creatureResolutionStats.dependencyMs+=performance.now()-dependencyStart;documents.set(key,assembly);return assembly;})();pending.set(key,task);try{return await task;}finally{pending.delete(key);}
}
const hare=await resolveCreature(BUILTIN_HARE);builtins.set(hare.species.id,hare);
export const brownHare=hare.species;
export const mobSpecies=Object.freeze([brownHare]);
export function speciesById(id,reference){const s=reference?documents.get(resourcePath(reference))?.species:builtins.get(id)?.species;if(!s||s.id!==id)throw Error('Unknown creature species/document: '+id+(reference?' ('+reference+')':''));return s;}
export function creatureAssembly(reference){return documents.get(resourcePath(reference));}
// Every open resolves external documents once. Active instances retain their immutable assembly.
export async function prepareCreatureWorld(world,worldPath){
 if(world?.metadata?.creature){if(world.metadata.creature.definition.behaviorProgram)await prepareBehaviorProgram(world.metadata.creature.definition.behaviorProgram,worldPath);const assembly=registerCreatureWorld(world,worldPath);world.objects[0].creatureDocument=assembly.document;return world;}
 const seen=new Map();for(const def of world.objects||[]){if(def.type!=='mob'||!def.creatureDocument)continue;const ref=resourcePath(def.creatureDocument,worldPath.startsWith('/')?worldPath:'/Notebook/'+worldPath);try{if(!seen.has(ref))seen.set(ref,resolveCreature(ref,{reload:true}));const a=await seen.get(ref);if(a.species.id!==def.speciesId)throw Error('Species ID changed in referenced creature');delete def.creatureError;}catch(e){def.creatureError=e.message;}}
 return world;
}
