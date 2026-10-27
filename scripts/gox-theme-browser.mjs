// Nodevision/scripts/gox-theme-browser.mjs
// Verifies application theme parity, transient overlays, persistence isolation and listener cleanup.
export async function themeChecks(api,ok){
 const {default:toggle}=await import('/ToolbarCallbacks/view/toggleDarkMode.mjs');
 const {VoxelViewport}=await import('/Voxels/VoxelViewport.mjs');
 const {VoxelExtrusionOverlay}=await import('/Voxels/VoxelExtrusionOverlay.mjs');
 const {goxThemes}=await import('/Voxels/GoxTheme.mjs');
 const THREE=await import('/lib/three/three.module.js');
 const original=document.documentElement.dataset.nvTheme||'light';
 const set=theme=>{if((document.documentElement.dataset.nvTheme||'light')!==theme)toggle();};
 const v=api.viewport,revision=api.doc.revision,dirty=api.doc.dirty,camera=v.camera.position.clone(),grid=v.grid;
 const overlay=new VoxelExtrusionOverlay(v);overlay.update({added:new Map(),overlap:new Map([['1',{pos:[0,0,0]}]]),steps:2,axis:'x',center:[0,0,0]});
 for(const theme of ['dark','light','dark']){
  set(theme);const colors=goxThemes[theme];
  ok(v.scene.background.getHex()===colors.background,theme+' viewport matches sibling 3D editors');
  ok(v.selection.material.color.getHex()===colors.selection&&v.preview.material.color.getHex()===colors.cursor,theme+' selection and brush contrast');
  ok(overlay.arrow.line.material.color.getHex()===colors.cursor&&overlay.batches.get('blocked').material.color.getHex()===colors.blocked,theme+' live extrusion overlay contrast');
  ok(getComputedStyle(api.element).colorScheme===theme,theme+' editor native controls');
  api.openSettings();const dialog=api.element.querySelector('dialog');ok(getComputedStyle(dialog).color===(theme==='dark'?'rgb(226, 232, 240)':'rgb(23, 32, 51)'),theme+' settings text');dialog.querySelector('button').click();
  v.buildOverlay.settings(api.build);const major=v.buildOverlay.guides.children.find(o=>o.type==='GridHelper');const expected=new THREE.Color(colors.major);ok(major&&Math.abs(major.geometry.attributes.color.getX(0)-expected.r)<.00001,theme+' rebuilt construction guide color');
  const minor=new THREE.Color(colors.gridLine);ok(Math.abs(v.grid.geometry.attributes.color.getX(0)-minor.r)<.00001,theme+' minor grid color');
  const widget=v.host.querySelector('[data-theme]');ok(widget?.dataset.theme===theme,theme+' orientation widget parity');
 }
 ok(v.grid===grid&&v.camera.position.equals(camera)&&api.doc.revision===revision&&api.doc.dirty===dirty,'theme changes preserve grid, camera and document');
 overlay.dispose();
 const host=document.createElement('div');host.style.cssText='width:200px;height:200px';document.body.append(host);const second=new VoxelViewport(host);
 ok(second.scene.background.getHex()===goxThemes.dark.background,'new viewport initializes with current dark mode');second.dispose();host.remove();set('light');
 ok(second.scene.background.getHex()===goxThemes.dark.background,'disposed viewport unsubscribes from theme changes');
 set(original);
}
