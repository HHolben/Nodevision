// Browser uses existing static resources; Node verification reads the same built-in document.
export async function readCreatureText(reference){
 if(import.meta.url.startsWith('file:')&&reference.startsWith('/BuiltIn/')){
  const {readFile}=await import('node:fs/promises');return readFile(new URL('../../'+reference.slice(1),import.meta.url),'utf8');
 }
 const {getLiveFileContentForPath}=await import('../../LiveFileContent.mjs');
 const live=reference.startsWith('/Notebook/')&&getLiveFileContentForPath(decodeURIComponent(reference.slice(10)));if(live?.content!==undefined)return live.content;
 const response=await fetch(reference,{cache:'no-store'});if(!response.ok)throw Error(`Creature document unavailable (${response.status}): ${reference}`);return response.text();
}
export async function checkCreatureDependencies(paths){
 for(const reference of paths){if(import.meta.url.startsWith('file:')&&reference.startsWith('/BuiltIn/')){const {access}=await import('node:fs/promises');await access(new URL('../../'+reference.slice(1),import.meta.url));}else{const response=await fetch(reference,{method:'HEAD',cache:'no-store'});if(!response.ok)throw Error('Missing creature dependency: '+reference);}}
}
