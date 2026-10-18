// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/MetaWorldImportComponents/importAssetApi.mjs
// This file wraps Meta World asset discovery and import API calls for the browser panel.

const assetTypes = new Map([
  ...['glb','gltf','obj','stl'].map(ext=>[ext,'model']),
  ...['png','jpg','jpeg','svg','webp'].map(ext=>[ext,'billboard']),
  ...['mp3','wav','ogg'].map(ext=>[ext,'audio']),
  ...['mp4','webm'].map(ext=>[ext,'video']),
]);
// The same shallow listing used by File Manager: never recurse or open assets.
export async function listNotebookAssetDirectory(directory='', {signal}={}) {
  const res=await fetch('/api/files?path='+encodeURIComponent(directory),{cache:'no-store',signal});
  const payload=await res.json();
  if(!res.ok)throw Error(payload?.error || 'Failed to open Notebook folder.');
  if(!Array.isArray(payload))throw Error('Invalid Notebook folder listing.');
  return payload.flatMap(entry=>{
    const notebookPath=String(entry.path||[directory,entry.name].filter(Boolean).join('/')).replaceAll('\\','/');
    if(entry.isDirectory)return [{name:entry.name,notebookPath,isDirectory:true}];
    const extension=entry.name.split('.').pop().toLowerCase(),type=assetTypes.get(extension);
    return type?[{name:entry.name,notebookPath,type,extension:'.'+extension,path:'/Notebook/'+notebookPath.split('/').map(encodeURIComponent).join('/')}]:[];
  });
}

export async function listNotebookCharacters() {
  const res = await fetch("/api/meta-world/characters", { cache: "no-store" });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(payload?.error || "Failed to list Notebook characters.");
  return Array.isArray(payload.characters) ? payload.characters : [];
}

export async function importNotebookAsset({ worldPath, assetPath, placement }) {
  const res = await fetch("/api/meta-world/import-asset", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ worldPath, assetPath, placement }),
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok || !payload?.success) {
    throw new Error(payload?.error || "Failed to import asset.");
  }
  return payload;
}

export async function importNotebookCharacter({ worldPath, characterPath, placement, role }) {
  const res = await fetch("/api/meta-world/import-character", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ worldPath, characterPath, placement, role }),
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok || !payload?.success) {
    throw new Error(payload?.error || "Failed to import character.");
  }
  return payload;
}
