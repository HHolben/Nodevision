import test from 'node:test';
import assert from 'node:assert/strict';
import {resourceReference,makeResourcePayload,readResourcePayload,writeResourceTransfer,resourceFromTransfer,isResourceTransfer} from './ResourceTransfer.mjs';
import {linkedResourceMarkup} from '/Media/LinkedResourceMarkup.mjs';
test('central relative references preserve raw Notebook file identities',()=>{
 for(const [source,target,result] of [['Project/Page.html','Project/Picture.png','Picture.png'],['Project/Page.html','Project/Assets/Picture.png','Assets/Picture.png'],['Project/Docs/Page.html','Project/Picture.png','../Picture.png'],['Project/Docs/Page.html','Project/Assets/Picture.png','../Assets/Picture.png'],['One/Page.html','Two/Picture.png','../Two/Picture.png'],['A #/Page?.html','B/雪 100%?#.png','../B/%E9%9B%AA%20100%25%3F%23.png']])assert.equal(resourceReference(source,target),result);
});
test('unsafe or unsaved relationships are rejected',()=>{
 for(const source of ['','untitled.html','/home/user/a.html','file:///a.html','../a.html'])assert.throws(()=>resourceReference(source,'a.png'));
 for(const path of ['/home/a.png','file:///etc/passwd','C:\\a.png','../a.png','a/../b.png'])assert.throws(()=>makeResourcePayload({path}));
});
test('file and graph managers share typed identities, never infer files from plain text',()=>{
 for(const sourcePanel of ['file-manager','graph-manager']){const values=new Map(),dataTransfer={types:[],setData(k,v){values.set(k,v);this.types.push(k)},getData:k=>values.get(k)||''};writeResourceTransfer({dataTransfer},{path:'Assets/a.png',sourcePanel});assert.ok(isResourceTransfer(dataTransfer));assert.equal(resourceFromTransfer(dataTransfer).id,'Notebook/Assets/a.png');}
 assert.equal(isResourceTransfer({types:['text/plain','Files']}),false);
 assert.throws(()=>readResourcePayload(makeResourcePayload({path:'Folder',isDirectory:true})));
 assert.throws(()=>readResourcePayload(makeResourcePayload({entries:[{path:'a.png'},{path:'b.png'}]})));
});
test('resource markup uses semantic media and escapes attributes',()=>{
 assert.match(linkedResourceMarkup({src:'a.png',name:'A"<x>',extension:'png'}),/alt="A&quot;&lt;x&gt;"/);
 for(const [extension,tag] of [['svg','img'],['webm','video'],['mp3','audio'],['html','a'],['pdf','a'],['txt','a']])assert.ok(linkedResourceMarkup({src:'a.'+extension,name:'a',extension}).startsWith('<'+tag+' '));
});
