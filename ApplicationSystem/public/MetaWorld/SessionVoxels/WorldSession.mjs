// Nodevision/ApplicationSystem/public/MetaWorld/SessionVoxels/WorldSession.mjs
// Owns in-memory world sessions across view recreation, with explicit discard and unload protection; never participates in document saving.
import {createSessionLayer} from './SessionLayer.mjs';
const worlds=new Map();
const key=path=>String(path||'').replace(/^\/?Notebook\//,'').replace(/^\//,'');
export function worldSession(path){const id=key(path);if(!worlds.has(id)){
 const owner={origin:null,adapter:null,history:{undoStack:[],redoStack:[],isRestoring:false,limit:80}};
 owner.layer=createSessionLayer({persistent:p=>owner.adapter?.persistent(p)||null,contains:p=>owner.adapter?.contains(p)===true,changed:p=>owner.adapter?.changed(p),record:tx=>owner.adapter?.record(tx)});worlds.set(id,owner);
 }return worlds.get(id);}
export function confirmWorldSessionReplacement(path){const id=key(path);for(const [old,owner] of worlds)if(old!==id&&owner.adapter){if(owner.constructionEdit&&!owner.constructionEdit.requestExit?.())return false;if(owner.layer.count&&!window.confirm(`${owner.layer.count} temporary voxel edits in ${old} are not saved in the world file. Discard them and open another world?`))return false;owner.adapter?.detach();owner.layer.dispose();worlds.delete(old);}return true;}
export function closeWorldSession(path,{discard=false}={}){const id=key(path),owner=worlds.get(id);if(!owner)return true;if(owner.constructionEdit){if(discard){owner.constructionEdit.discard();owner.constructionEdit.exit();}else if(!owner.constructionEdit.requestExit?.())return false;}if(!discard&&owner.layer.count&&!window.confirm('Discard temporary voxel edits? File Save does not preserve them.'))return false;owner.adapter?.detach();owner.layer.dispose();worlds.delete(id);return true;}
if(typeof window!=='undefined')window.addEventListener('beforeunload',event=>{if([...worlds.values()].some(w=>w.layer.count||w.constructionEdit?.dirty||w.constructionEdit?.busy)){event.preventDefault();event.returnValue='';}});
