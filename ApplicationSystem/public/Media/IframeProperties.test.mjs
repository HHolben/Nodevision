import { readFile } from 'node:fs/promises';
import test from 'node:test';
import assert from 'node:assert/strict';
import { iframeDefaults, validateIframeValues, iframeDimension, iframeWorldDefinition } from './IframeProperties.mjs';

test('Notebook references remain relative and Internet references require HTTP(S)', () => {
  for (const src of ['./page.html','../other.php','/Notebook/page.html','folder/a%20b.html']) assert.equal(validateIframeValues({...iframeDefaults,src}).src,src);
  for (const src of ['https://example.com/embed?q=1&x=2','http://localhost:8080/page.php']) assert.equal(validateIframeValues({...iframeDefaults,sourceKind:'internet',src}).src,src);
  assert.throws(()=>validateIframeValues({...iframeDefaults,sourceKind:'internet',src:'relative.html'}));
});
test('reject active and filesystem schemes and obfuscation', () => {
  for (const src of ['javascript:alert(1)','data:text/html,<script>','file:///etc/passwd','blob:https://site/id','//example.com','java\nscript:x','https://user:pass@example.com/','C:\\private.html']) assert.throws(()=>validateIframeValues({...iframeDefaults,src}));
});
test('CSS dimensions accept supported units without declaration injection', () => {
  for (const value of ['560','100%','20rem','30vh','10.5cm']) assert.ok(iframeDimension(value));
  for (const value of ['0','-2','10px;position:fixed','expression(x)','100foo']) assert.throws(()=>iframeDimension(value));
});
test('new iframe world definitions preserve conservative permissions and pixel aspect', () => {
  const def=iframeWorldDefinition({...iframeDefaults,src:'../embed.php'},[1,2,3]);
  assert.equal(def.sandbox,'');assert.equal(def.allow,'');assert.equal(def.allowfullscreen,false);
  assert.equal(def.src,'../embed.php');assert.deepEqual(def.position,[1,2,3]);assert.ok(Math.abs(def.size[1]-1.35)<1e-10);
  assert.throws(()=>validateIframeValues({...iframeDefaults,src:'a.html',sandbox:'allow-scripts allow-same-origin'}));
});

test('the existing iframe callback is available in HTML, PHP and both world modes', async () => {
  const toolbar = JSON.parse(await readFile(new URL('../ToolbarJSONfiles/insertToolbar.json', import.meta.url), 'utf8'));
  const entry = (Array.isArray(toolbar) ? toolbar : toolbar.items).find(item => item.callbackKey === 'insertIFRAME');
  for (const mode of ['HTMLediting','PHPediting','Virtual World Editing','VR World Editing']) assert.ok(entry.modes.includes(mode));
});
