// Nodevision/ApplicationSystem/public/MetaWorld/TerrainMaps/Preview.mjs
// This module distributes committed in-memory terrain-map previews to linked world views. It manages preview ownership and subscriptions without saving transient editor state into Notebook content.
// One editor per asset; committed in-memory strokes are shared with every linked world in this application.
const previews=new Map(),listeners=new Set();
export const mapPreview=path=>previews.get(path);
export function onMapPreview(fn){listeners.add(fn);return()=>listeners.delete(fn);}
export async function publishMapPreview(path,value,bounds,owner){if(!value&&owner&&previews.get(path)?.owner!==owner)return;if(value)previews.set(path,value);else previews.delete(path);await Promise.all([...listeners].map(fn=>fn(path,value,bounds)));}
