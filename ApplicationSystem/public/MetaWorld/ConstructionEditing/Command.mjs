// Standard command registry entry points; explicit flags authorize referenced-asset publication.
import {beginConstructionEdit} from './Session.mjs';
import {chooseConstructionEdit,showConstructionEditor} from './Controls.mjs';
const current=()=>{const e=window.VRWorldContext?.constructionEdit;if(!e)throw Error('No construction editing session is active');return e;};
export function constructionEdit([options={}]){chooseConstructionEdit(options);return true;}
export async function constructionEditSource([options={}]){return showConstructionEditor(await beginConstructionEdit({...options,strategy:'source'})).status();}
export async function constructionMakeUnique([options={}]){const e=window.VRWorldContext?.constructionEdit;if(e){if(e.busy)throw Error('Save is in progress');e.strategy='unique';e.onChange?.();return e.status();}return showConstructionEditor(await beginConstructionEdit({...options,strategy:'unique'})).status();}
export function constructionSave([options={}]){if(options.confirm!==true)throw Error('Save Construction requires confirm:true; other worlds may reference this source');return current().save(options);}
export function constructionDiscard([options={}]){if(options.confirm!==true)throw Error('Discard requires confirm:true');return current().discard();}
export function constructionExit(){return current().requestExit();}
export function constructionStatus(){return window.VRWorldContext?.constructionEdit?.status()||{active:false};}
