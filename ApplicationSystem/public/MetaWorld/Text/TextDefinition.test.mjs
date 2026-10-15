// Nodevision/ApplicationSystem/public/MetaWorld/Text/TextDefinition.test.mjs
// These tests verify source preservation, grapheme boundaries, version validation, and memory visibility independently of the renderer.
import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeText,textVisible,SIGN_PRESETS} from './TextDefinition.mjs';
import {wrapText} from './TextLayout.mjs';
test('Unicode and exact local transforms survive JSON round trips',()=>{
 const d=normalizeText({id:'greek',kind:'engraved',content:'Α — ΑΛΦΑ\nἄλφα σς α\u0301 </script> $&',parentId:'boulder',position:[.123456789,2,3],links:{file:'Notebook/Greek.html'},engravingDepth:.17});
 assert.deepEqual(normalizeText(JSON.parse(JSON.stringify(d))),d);assert.equal(d.position[0],.123456789);assert.equal(d.engravingDepth,.17);
});
test('wrapping never separates combining sequences or emoji graphemes',()=>{
 assert.deepEqual(wrapText('α\u0301β\n👩‍👩‍👧‍👦x',s=>[...new Intl.Segmenter().segment(s)].length,1),['α\u0301','β','👩‍👩‍👧‍👦','x']);
});
test('sign presets share schema and invalid dimensions are bounded',()=>{
 for(const signPreset of SIGN_PRESETS)assert.equal(normalizeText({signPreset}).signPreset,signPreset);
 assert.equal(normalizeText({width:-5,opacity:5}).width,.05);assert.throws(()=>normalizeText({textVersion:2}));
});
test('memory visibility is optional and controlled externally',()=>{
 assert.equal(textVisible(normalizeText()),true);
 assert.equal(textVisible(normalizeText({displayMode:'interaction'})),false);
 assert.equal(textVisible(normalizeText({displayMode:'interaction'}),{revealed:true}),true);
 assert.equal(textVisible(normalizeText({displayMode:'learning'}),{mode:'recall'}),false);
 assert.equal(textVisible(normalizeText({displayMode:'hide-recall'}),{mode:'recall'}),false);
 assert.equal(textVisible(normalizeText(),{distance:1000}),false);
});

const {signPresetPatch,greekInscription}=await import('./TextPresets.mjs');
test('sign presets switch structural materials and Greek helper keeps final sigma optional',()=>{
 assert.equal(signPresetPatch('marble-plaque').surfaceMaterial,'marble');
 assert.equal(signPresetPatch('marble-plaque').support,false);
 assert.equal(signPresetPatch('stone-stele').height,2);
 assert.equal(signPresetPatch('directional-arrow').support,true);
 assert.equal(greekInscription(0,{withName:true}),'Α — ΑΛΦΑ');
 assert.equal(greekInscription(23,{lowercase:true}),'ω');
});
