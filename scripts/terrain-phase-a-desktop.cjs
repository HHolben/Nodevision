// Nodevision/scripts/terrain-phase-a-desktop.cjs
// Launches Nodevision's actual Electron entry and native GameView against isolated Notebook/settings copies, then exercises its real representation control and persistence without altering the supplied world.
const {app,BrowserWindow}=require('electron');
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const root=path.resolve(__dirname,'..'),delay=ms=>new Promise(r=>setTimeout(r,ms));
app.commandLine.appendSwitch('no-sandbox');app.commandLine.appendSwitch('disable-dev-shm-usage');
app.commandLine.appendSwitch('enable-unsafe-swiftshader');app.commandLine.appendSwitch('use-angle','swiftshader');
(async()=>{
 const temp=await fs.mkdtemp(path.join(os.tmpdir(),'nv-terrain-electron-'));
 process.env.NODEVISION_ROOT=temp;process.env.NODEVISION_PHP_ENABLED='false';
 await fs.mkdir(path.join(temp,'Notebook'));await fs.symlink(path.join(root,'ApplicationSystem'),path.join(temp,'ApplicationSystem'));await fs.symlink(path.join(root,'node_modules'),path.join(temp,'node_modules'));
 const original=await fs.readFile(path.join(root,'Notebook/test.html'),'utf8');await fs.writeFile(path.join(temp,'Notebook/world.html'),original);
 app.setPath('userData',path.join(temp,'ElectronProfile'));
 const timer=setTimeout(()=>{console.error('FAIL: Electron terrain timeout');app.exit(1);},240000);
 try{
  const desktop=await import('../electron-main.js');desktop.setupElectronHandlers();await app.whenReady();
  while(!BrowserWindow.getAllWindows().length)await delay(100);
  const win=BrowserWindow.getAllWindows()[0],js=s=>win.webContents.executeJavaScript(s,true);
  while(win.webContents.isLoading())await delay(100);
  await js(`fetch('/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'admin',password:'admin'})}).then(r=>{if(!r.ok)throw Error('Isolated login failed')})`);
  win.reload();await delay(500);while(win.webContents.isLoading())await delay(100);
  await js(`(async()=>{
   const {setupPanel}=await import('/PanelInstances/ViewPanels/GameView.mjs');
   const {createToolbar}=await import('/panels/createToolbar.mjs');
   window.NodevisionState ||= {};window.NodevisionState.currentMode='Virtual World Editing';window.NodevisionState.virtualWorldMode='creative';
   await createToolbar();
   const panel=document.createElement('div');panel.className='panel';Object.assign(panel.style,{position:'fixed',left:'0',right:'0',top:'150px',bottom:'30px',zIndex:'20'});document.body.append(panel);window.terrainSmokePanel=panel;
   await setupPanel(panel,{filePath:'world.html'});if(!await panel.worldReady)throw Error('Actual GameView failed to open');
   const root=window.VRWorldContext.objects.find(o=>o.userData.terrainRuntime);if(!root)throw Error('No terrain');await root.userData.terrainRuntime.ready;root.userData.terrainRuntime.setRenderDistance(8);
   const buttons=()=>[...document.querySelectorAll('button')];buttons().find(b=>b.textContent.trim()==='View').click();buttons().find(b=>b.textContent.trim().endsWith('Terrain Representation')).click();
  })()`);
  for(let i=0;i<1200;i++){if(await js(`!!document.querySelector('#sub-toolbar [aria-label="Terrain representation"]')&&!document.querySelector('#sub-toolbar [aria-label="Terrain representation"]').disabled&&window.VRWorldContext.objects.find(o=>o.userData.terrainRuntime).userData.terrainRuntime.manager.loaded.size>0`))break;await delay(50);}
  await js(`window.terrainBefore=window.VRWorldContext.objects.find(o=>o.userData.terrainRuntime).children.map(m=>m.geometry.uuid);const mode=document.querySelector('#sub-toolbar [aria-label="Terrain representation"]');mode.value='polygonal';mode.dispatchEvent(new Event('change',{bubbles:true}));`);
  for(let i=0;i<3000;i++){if(await js(`!document.querySelector('#sub-toolbar [aria-label="Terrain representation"]').disabled`))break;await delay(50);}
  const result=await js(`(async()=>{const ctx=window.VRWorldContext,r=ctx.objects.find(o=>o.userData.terrainRuntime);if(r.userData.terrainRuntime.representation!=='polygonal')throw Error('Native UI switch failed');if(r.children.some(m=>window.terrainBefore.includes(m.geometry.uuid)))throw Error('Old meshes retained');const {saveCurrentWorldFile}=await import('/PanelInstances/ViewPanels/GameViewDependencies/worldSave.mjs');if(!await saveCurrentWorldFile({state:ctx.state,movementState:ctx.movementState,objects:ctx.objects,lights:ctx.lights}))throw Error('Save failed');return {representation:r.userData.terrainRuntime.representation,chunks:r.children.length};})()`);
  await fs.writeFile('/tmp/nodevision-terrain-desktop.png',(await win.webContents.capturePage()).toPNG());
  const saved=await fs.readFile(path.join(temp,'Notebook/world.html'),'utf8');if(!saved.includes('"representation": "polygonal"'))throw Error('Saved representation missing');
  if(await fs.readFile(path.join(root,'Notebook/test.html'),'utf8')!==original)throw Error('Original changed');
  console.log('PASS: actual Nodevision Electron GameView menu, new geometry, production save',result);
  await js('window.terrainSmokePanel.cleanup()');clearTimeout(timer);app.quit();
 }catch(error){console.error('FAIL: '+error.stack);clearTimeout(timer);app.exit(1);}
})().catch(error=>{console.error(error);app.exit(1);});
