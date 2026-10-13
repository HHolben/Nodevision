// Nodevision/ApplicationSystem/public/RasterAnalysis/ImageAnalysisWorkerClient.test.mjs
// These tests simulate overlapping worker replies to verify coalescing, stale visualization recovery, and source-pixel cache disposal without relying on timing-sensitive large images.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createImageAnalysisWorkerClient } from './ImageAnalysisWorkerClient.mjs';

test('coalesced requests redraw discarded transfers and read pixels once per revision', () => {
  const names=['Worker','document','requestAnimationFrame','cancelAnimationFrame'];
  const originals=names.map(name=>Object.getOwnPropertyDescriptor(globalThis,name));
  let tick, reads=0; const workers=[], received=[];
  class Worker {
    messages=[];
    constructor() { workers.push(this); }
    postMessage(data) { this.messages.push(structuredClone(data)); }
    terminate() { this.terminated=true; }
    reply(index) { this.onmessage({data:{id:this.messages[index].id,layers:[]}}); }
  }
  Object.assign(globalThis,{Worker,document:{createElement:()=>({getContext:()=>({drawImage(){},getImageData(){reads++;return {data:new Uint8ClampedArray(4)};}})})},
    requestAnimationFrame:fn=>{tick=fn;return 1;},cancelAnimationFrame:()=>{tick=null;}});
  try {
    const client=createImageAnalysisWorkerClient({},()=>({width:1,height:1}),value=>received.push(value),message=>assert.fail(message));
    client.request([],[]); tick(); const worker=workers[0];
    client.request([],[{id:'latest'}]); tick();
    assert.equal(worker.messages.length,2);
    worker.reply(1); assert.equal(received.length,0);
    assert.equal(worker.messages[2].redraw,true); assert.equal(worker.messages[2].layers[0].id,'latest');
    worker.reply(2); assert.equal(received.length,1); assert.equal(reads,1);
    client.request([],[]); tick(); assert.equal(worker.messages[3].redraw,false);
    client.invalidate(); assert.equal(worker.terminated,true);
    client.request([],[]); tick(); assert.equal(reads,2);
    client.dispose(); assert.equal(workers[1].terminated,true);
  } finally {
    names.forEach((name,i)=>{if(originals[i]) Object.defineProperty(globalThis,name,originals[i]); else delete globalThis[name];});
  }
});
