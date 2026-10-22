// Nodevision/ApplicationSystem/public/MetaWorld/Sounds/SoundProperty.test.mjs
// Checks sound-property boundaries and stable persistence defaults.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {normalizeSoundProperty} from './SoundProperty.mjs';
test('loop defaults, mute and explicit disable survive serialization',()=>{
 const sound=normalizeSoundProperty({src:'audio/rain.ogg',volume:0,enabled:false});
 assert.deepEqual(JSON.parse(JSON.stringify(sound)),{src:'audio/rain.ogg',volume:0,range:14,loop:true,enabled:false});
 assert.equal(normalizeSoundProperty({...sound,loop:false}).loop,false);
});
test('invalid sources and ranges are rejected before world mutation',()=>{
 for(const src of ['', 'javascript:alert(1)','data:text/html;base64,abc','blob:temporary'])assert.throws(()=>normalizeSoundProperty({src}));
 for(const range of [0,-1,Infinity,10001])assert.throws(()=>normalizeSoundProperty({src:'rain.wav',range}));
 for(const volume of [-1,1.1,NaN])assert.throws(()=>normalizeSoundProperty({src:'rain.wav',volume}));
 assert.equal(normalizeSoundProperty({src:'data:audio/wav;base64,AAAA'}).loop,true);
});
