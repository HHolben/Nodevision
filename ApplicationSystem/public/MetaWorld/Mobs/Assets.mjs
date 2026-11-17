export const mobAssetStats={requests:0,activeLeases:0,liveEntries:0,releases:0};
// One GLTFLoader request/decode per live canonical model resource. Per-instance clones share immutable GPU resources.
const caches=new WeakMap();
export function acquireMobAsset(THREE,species,load){
 let cache=caches.get(THREE);if(!cache)caches.set(THREE,cache=new Map());let entry=cache.get(species.model);
 if(!entry){mobAssetStats.requests++;mobAssetStats.liveEntries++;entry={refs:0,asset:null};cache.set(species.model,entry);entry.ready=Promise.resolve().then(async()=>{
  const loader=load||((await import('/lib/three/examples/jsm/loaders/GLTFLoader.js')).GLTFLoader);
  const gltf=await new loader().loadAsync(species.model);entry.asset=gltf;return gltf;
 });entry.ready.catch(()=>{});}
 entry.refs++;mobAssetStats.activeLeases++;let released=false;
 function dispose(){const seen=new Set();entry.asset?.scene?.traverse(o=>{if(o.geometry&&!seen.has(o.geometry)){seen.add(o.geometry);o.geometry.dispose();}for(const m of (Array.isArray(o.material)?o.material:[o.material]))if(m&&!seen.has(m)){seen.add(m);for(const v of Object.values(m))if(v?.isTexture&&!seen.has(v)){seen.add(v);v.dispose();v.source?.data?.close?.();}m.dispose();}});if(cache.get(species.model)===entry){cache.delete(species.model);mobAssetStats.liveEntries--;}}
 return {ready:entry.ready,release(){if(released)return;released=true;mobAssetStats.activeLeases--;mobAssetStats.releases++;if(--entry.refs===0)entry.ready.then(()=>{if(entry.refs===0)dispose();},()=>{if(cache.get(species.model)===entry){cache.delete(species.model);mobAssetStats.liveEntries--;}});}};
}
