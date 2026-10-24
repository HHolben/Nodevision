// Nodevision/scripts/media-batch-browser.mjs
// Exercises multiple media selection against the production HTML/SVG editors and sequential queue failure/placement behavior.
import {renderImage} from '/ToolbarJSONfiles/insertMediaImage.mjs';
import {renderSound} from '/ToolbarJSONfiles/insertMediaSound.mjs';
import {renderVideo} from '/ToolbarJSONfiles/insertMediaVideo.mjs';
import {renderInsertModel} from '/ToolbarJSONfiles/insertMediaModel.mjs';
import {captureAssetEditorContext} from '/AssetDownloads/AssetEditorContext.mjs';
import {createMediaBatch} from '/ToolbarJSONfiles/insertMediaBatch.mjs';
let count=0;const check=(value,message)=>{if(!value)throw Error(message);count++;};
const tick=()=>new Promise(resolve=>setTimeout(resolve,20));
async function wait(predicate){for(let i=0;i<200;i++){if(predicate())return;await tick();}throw Error('Timed out: '+predicate+'; statuses: '+[...document.querySelectorAll('[data-field=status]')].map(e=>e.textContent).join(' | '));}
const mount=()=>{const el=document.createElement('div');document.body.append(el);return el;};
const cell=(file)=>{const el=mount();el.className='panel-cell';el.dataset.id='GraphicalEditor';el.dataset.panelClass='EditorPanel';el.dataset.currentFilePath=file;el.style.cssText='width:700px;height:400px';window.activeCell=el;return el;};
const radio=(root,name,value)=>{const el=root.querySelector(`input[name="${name}"][value="${value}"]`);el.checked=true;el.dispatchEvent(new Event('change',{bubbles:true}));};
const choose=(input,files)=>{const transfer=new DataTransfer();files.forEach(file=>transfer.items.add(file));input.files=transfer.files;input.dispatchEvent(new Event('change',{bubbles:true}));};
try{
 window.NodevisionState={currentMode:'HTMLediting'};
 const {renderEditor:renderHtml}=await import('/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditor.mjs');
 const htmlCell=cell('Project/index.html');await renderHtml('Project/index.html',htmlCell);const html=htmlCell.__nvHtmlEditorContext,editor=html.getEditorElement();
 const range=document.createRange();range.selectNodeContents(editor.querySelector('p'));range.collapse(false);getSelection().removeAllRanges();getSelection().addRange(range);html.selection.capture();
 const canvas=document.createElement('canvas');canvas.width=canvas.height=2;const blob=await new Promise(r=>canvas.toBlob(r)),files=[new File([blob],'one.png',{type:'image/png'}),new File([blob],'two.png',{type:'image/png'})];
 let root=mount();renderImage(root,['png'],{bookmark:await captureAssetEditorContext(htmlCell)});radio(root,'nv-image-storage','inline');const input=root.querySelector('input[type=file]');check(input.multiple,'Image picker accepts multiple files');choose(input,files);root.querySelector('form').requestSubmit();
 await wait(()=>root.querySelector('[data-field=status]').textContent==='Inserted 2 of 2.');check(editor.querySelectorAll('img').length===2,'Both HTML images inserted');check(root.querySelectorAll('[data-media-batch] label').length===0,'Completed files leave queue');root.remove();
 root=mount();renderSound(root,['wav']);radio(root,'nv-storage','inline');choose(root.querySelectorAll('input[type=file]')[2],[new File(['RIFF'],'one.wav',{type:'audio/wav'}),new File(['RIFF'],'two.wav',{type:'audio/wav'})]);root.querySelector('form').requestSubmit();await wait(()=>root.querySelector('[data-field=status]').textContent==='Inserted 2 of 2.');check(editor.querySelectorAll('audio').length===2,'Both HTML sounds inserted');root.remove();
 root=mount();renderVideo(root,['mp4']);radio(root,'nv-storage','inline');choose(root.querySelector('input[type=file]'),[new File(['video'],'one.mp4',{type:'video/mp4'}),new File(['video'],'two.mp4',{type:'video/mp4'})]);root.querySelector('form').requestSubmit();await wait(()=>root.querySelector('[data-field=status]').textContent==='Inserted 2 of 2.');check(editor.querySelectorAll('video').length===2,'Both new video files inserted');root.remove();
 root=mount();renderInsertModel(root,['obj']);radio(root,'nv-storage','inline');choose(root.querySelector('input[type=file]'),[new File(['v 0 0 0\nv 1 0 0\nv 0 1 0\nf 1 2 3'],'one.obj'),new File(['v 0 0 0\nv 1 0 0\nv 0 1 0\nf 1 2 3'],'two.obj')]);root.querySelector('form').requestSubmit();await wait(()=>root.querySelector('[data-field=status]').textContent==='Inserted 2 of 2.');check(editor.textContent.includes('one.objtwo.obj'),'Model selection order preserved');root.remove();
 window.NodevisionState.currentMode='SVG Editing';const {renderEditor:renderSvg}=await import('/PanelInstances/EditorPanels/GraphicalEditors/SVGeditor.mjs');const svgCell=cell('Project/art.svg');await renderSvg('Project/art.svg',svgCell);const svg=svgCell.__nvSvgEditorContext;svg.setActiveLayer('layer-a');
 root=mount();renderImage(root,['png'],{bookmark:await captureAssetEditorContext(svgCell)});radio(root,'nv-image-storage','inline');choose(root.querySelector('input[type=file]'),files);svg.setActiveLayer('layer-b');root.querySelector('form').requestSubmit();await wait(()=>root.querySelector('[data-field=status]').textContent==='Inserted 2 of 2.');
 const images=svg.svgRoot.querySelectorAll('#layer-a image');check(images.length===2&&!svg.svgRoot.querySelector('#layer-b image'),'SVG batch stays in captured layer');check(Number(images[1].getAttribute('x'))-Number(images[0].getAttribute('x'))===24,'SVG images are offset rather than stacked');svg.undo();check(svg.svgRoot.querySelectorAll('image').length===1,'SVG native undo removes last item');svg.redo();check(svg.svgRoot.querySelectorAll('image').length===2,'SVG native redo restores item');root.remove();
 // Exercise the same pickers with the actual world insertion bridge.
 window.NodevisionState.currentMode='Virtual World Editing';
 const THREE=await import('/lib/three/three.module.js');
 const {loadWorldFromFile}=await import('/PanelInstances/ViewPanels/GameViewDependencies/worldLoading.mjs');
 const panel=cell('batch-world.html');panel.dataset.id='GameView';const worldCanvas=document.createElement('canvas');panel.append(worldCanvas);
 const camera=new THREE.PerspectiveCamera(55,4/3,.1,100),state={currentWorldPath:'batch-world.html'};
 const world=window.VRWorldContext={THREE,scene:new THREE.Scene(),camera,panel,canvas:worldCanvas,state,movementState:{playerMode:'creative',environment:{}},objects:[],colliders:[],lights:[],portals:[],collisionActions:[],useTargets:[],spawnPoints:[],waterVolumes:[],measurementVisuals:[],controls:{getObject:()=>camera,unlock(){}}};
 const originalFetch=window.fetch,saved=new Map();window.fetch=async(url,options)=>{
  if(url==='/api/load-world')return {ok:true,json:async()=>({worldDefinition:{name:'Batch',type:'world',worldType:'NodevisionMetaWorld',objects:[]}})};
  if(url==='/api/save'){const data=JSON.parse(options.body);saved.set(data.path.replace(/^Notebook\//,''),data);return {ok:true,json:async()=>({success:true})};}
  const path=decodeURIComponent(typeof url==='string'?url:url.url).replace(/^.*\/Notebook\//,'').split('?')[0];
  if(saved.has(path)){const data=saved.get(path);return new Response(data.encoding==='base64'?Uint8Array.from(atob(data.content),c=>c.charCodeAt(0)):data.content);}
  return originalFetch(url,options);
 };
 await loadWorldFromFile('batch-world.html',state,THREE);
 root=mount();renderImage(root,['png'],{bookmark:await captureAssetEditorContext(panel)});radio(root,'nv-image-storage','inline');choose(root.querySelector('input[type=file]'),files);root.querySelector('form').requestSubmit();await wait(()=>root.querySelector('[data-field=status]').textContent==='Inserted 2 of 2.');
 const worldImages=world.objects.filter(o=>o.userData.nvType==='image-plane');check(worldImages.length===2,'Both world images inserted');check(Math.abs(worldImages[1].position.x-worldImages[0].position.x)===2,'World images have separate positions');root.remove();
 const beforeSounds=world.objects.length;root=mount();renderSound(root,['wav'],{target:'virtualWorld'});radio(root,'nv-storage','inline');choose(root.querySelectorAll('input[type=file]')[2],[new File(['RIFF'],'first.wav',{type:'audio/wav'}),new File(['RIFF'],'second.wav',{type:'audio/wav'})]);root.querySelector('form').requestSubmit();await wait(()=>root.querySelector('[data-field=status]').textContent==='Inserted 2 of 2.');check(world.objects.length===beforeSounds+2,'Both world sounds inserted');root.remove();
 const positions=new Float32Array([0,0,0,1,0,0,0,1,0]);const gltf=JSON.stringify({asset:{version:'2.0'},buffers:[{byteLength:36,uri:'data:application/octet-stream;base64,'+btoa(String.fromCharCode(...new Uint8Array(positions.buffer)))}],bufferViews:[{buffer:0,byteLength:36}],accessors:[{bufferView:0,componentType:5126,count:3,type:'VEC3',min:[0,0,0],max:[1,1,0]}],meshes:[{primitives:[{attributes:{POSITION:0}}]}],nodes:[{mesh:0}],scenes:[{nodes:[0]}],scene:0});
 const {getModelPlacement}=await import('/Models/ModelPlacement.mjs');
 root=mount();renderInsertModel(root,['gltf'],{target:'virtualWorld'});choose(root.querySelector('input[type=file]'),[new File([gltf],'first.gltf'),new File([gltf],'second.gltf')]);root.querySelector('form').requestSubmit();await wait(()=>!!getModelPlacement());const first=getModelPlacement();await first.ready;await first.configure({surfaceSnap:false,position:[0,1,0]});await first.commit();
 await wait(()=>getModelPlacement()&&getModelPlacement()!==first);getModelPlacement().cancel();await wait(()=>root.querySelector('[data-media-batch] > button').hidden);check(root.querySelectorAll('[data-media-batch] label').length===1,'World cancellation retains unfinished model');
 root.querySelector('form').requestSubmit();await wait(()=>!!getModelPlacement());const second=getModelPlacement();await second.ready;await second.configure({surfaceSnap:false,position:[3,1,0]});check(!root.querySelector('[data-media-batch] > button').hidden,'Retry waits for remaining model placement');await second.commit();await wait(()=>root.querySelector('[data-field=status]').textContent==='Inserted 1 of 1.');check(world.objects.length===beforeSounds+4,'Model retry inserts both models without duplicates');root.remove();
 window.fetch=originalFetch;
 // Partial failures retain only unfinished files. A second submission cannot overlap the active batch.
 root=mount();root.innerHTML='<form><input type="file"><button>Insert</button><output data-field="status"></output></form>';const form=root.firstChild,batch=createMediaBatch(form);let selected,fail=true,inserted=[];
 batch.bind(form.querySelector('input'),async file=>{selected=file.name;});batch.onSubmit(async()=>{await tick();if(selected==='two.png'&&fail)return false;inserted.push(selected);});choose(form.querySelector('input'),files);form.requestSubmit();form.requestSubmit();await wait(()=>form.querySelector('[data-media-batch] > button').hidden&&inserted.length===1);
 check(inserted.join(',')==='one.png','Double submit does not duplicate inserts');check(form.querySelectorAll('[data-media-batch] label').length===1,'Failure keeps only unfinished item');fail=false;form.requestSubmit();await wait(()=>inserted.length===2);check(inserted.join(',')==='one.png,two.png','Retry avoids duplicating successful items');root.remove();
 // Interactive placement must settle before the next selected item is loaded.
 root=mount();root.innerHTML='<form><input type="file"><button>Insert</button><output data-field="status"></output></form>';const f=root.firstChild,queue=createMediaBatch(f);let loaded=[],finish;
 queue.bind(f.querySelector('input'),async file=>{loaded.push(file.name);});queue.onSubmit(async()=>{await queue.waitForPlacement({finished:new Promise(r=>finish=r),cancel(){finish(null);}});});choose(f.querySelector('input'),files);f.requestSubmit();await wait(()=>!!finish);check(!loaded.includes('two.png'),'Next model waits for placement');finish({id:'placed'});await wait(()=>loaded.includes('two.png'));root.querySelector('[data-media-batch] > button').click();await wait(()=>root.querySelector('[data-media-batch] > button').hidden);check(f.querySelectorAll('[data-media-batch] label').length===1,'Cancelling placement preserves remaining model');root.remove();
 document.getElementById('result').textContent=`PASS: ${count} multi-media checks`;
}catch(error){document.getElementById('result').textContent='FAIL: '+error.stack;}
