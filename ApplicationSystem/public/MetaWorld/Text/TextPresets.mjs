// Nodevision/ApplicationSystem/public/MetaWorld/Text/TextPresets.mjs
// This module applies coherent sign presets and provides optional Greek insertion helpers without restricting ordinary world text to a particular language.
import {SIGN_PRESETS,GREEK_UPPER} from './TextDefinition.mjs';
export const GREEK_NAMES=['ΑΛΦΑ','ΒΗΤΑ','ΓΑΜΜΑ','ΔΕΛΤΑ','ΕΨΙΛΟΝ','ΖΗΤΑ','ΗΤΑ','ΘΗΤΑ','ΙΩΤΑ','ΚΑΠΠΑ','ΛΑΜΒΔΑ','ΜΥ','ΝΥ','ΞΙ','ΟΜΙΚΡΟΝ','ΠΙ','ΡΩ','ΣΙΓΜΑ','ΤΑΥ','ΥΨΙΛΟΝ','ΦΙ','ΧΙ','ΨΙ','ΩΜΕΓΑ'];
export function signPresetPatch(signPreset) {
 if(!SIGN_PRESETS.includes(signPreset))throw Error('Unknown sign preset.');
 const stone=signPreset.includes('stone'),marble=signPreset==='marble-plaque';
 const material=marble?'marble':stone?'limestone':'PineWood';
 return {kind:'sign',signPreset,width:signPreset==='stone-stele'?1:2,height:signPreset==='stone-stele'?2:1,
  thickness:stone ? .25 : marble ? .08 : .12,surfaceMaterial:material,frameMaterial:material,
  frame:!stone&&!marble,support:['wooden-signpost','directional-arrow'].includes(signPreset)};
}
export function greekInscription(index,{lowercase=false,withName=false}={}) {
 const letter=GREEK_UPPER.split(' ')[index];if(!letter)return '';
 return (lowercase?letter.toLocaleLowerCase('el'):letter)+(withName?' — '+GREEK_NAMES[index]:'');
}
