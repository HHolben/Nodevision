import {registerCreatureWorld,prepareCreatureWorld} from '../Mobs/Registry.mjs';
import {extractCreatureWorld} from './Document.mjs';
import {readCreatureText} from './Read.mjs';
export async function builtInWorld(path){return extractCreatureWorld(await readCreatureText(path));}
export function restoreCreatureMetadata(world,metadata,path){
 world.metadata.creature=structuredClone(metadata);world.name=metadata.displayName;const source=structuredClone(world);for(const def of source.objects)if(def.creatureRoot)delete def.creatureDocument;const assembly=registerCreatureWorld(source,path);for(const def of world.objects)if(def.creatureRoot)def.creatureDocument=assembly.document;
}
export {prepareCreatureWorld};
