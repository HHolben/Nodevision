// Nodevision/ApplicationSystem/public/Voxels/GoxTheme.mjs
// Shared application theme integration for GOX viewports and scoped editor controls.
export const goxThemes={
 light:{background:0xffffff,gridCenter:0x94a3b8,gridLine:0xe2e8f0,major:0x94a3b8,selection:0x007c91,cursor:0x925800,blocked:0xb42318,bounds:0x64748b},
 dark:{background:0x0f141b,gridCenter:0x445067,gridLine:0x2b3444,major:0x64748b,selection:0x00ffff,cursor:0xffdd44,blocked:0xff6666,bounds:0xaaaaaa}
};
export function themeGrid(grid,center,line){
 const p=grid.geometry.attributes.position,c=grid.geometry.attributes.color;
 for(let i=0;i<p.count;i+=2){const color=(p.getX(i)===0&&p.getX(i+1)===0)||(p.getZ(i)===0&&p.getZ(i+1)===0)?center:line;
  c.setXYZ(i,color.r,color.g,color.b);c.setXYZ(i+1,color.r,color.g,color.b);
 }c.needsUpdate=true;
}
export function installGoxStyles(){
 if(document.getElementById('nv-gox-theme-styles'))return;
 const style=document.createElement('style');style.id='nv-gox-theme-styles';
 const scope=':is([data-nv-gox],[data-gox-block-controls],[data-gox-extrude-controls],[data-gox-layers])';
 style.textContent=`
 ${scope}{--gox-bg:#fff;--gox-text:#172033;--gox-control:#f8fafc;--gox-border:#94a3b8;--gox-accent:#00677d;--gox-active:#d8f3fa;color-scheme:light;color:var(--gox-text);background:var(--gox-bg)}
 [data-nv-theme="dark"] ${scope}{--gox-bg:#0f141b;--gox-text:#e2e8f0;--gox-control:#1e293b;--gox-border:#64748b;--gox-accent:#67e8f9;--gox-active:#164e63;color-scheme:dark}
 ${scope} :is(button,input,select,textarea,dialog){color:var(--gox-text);background:var(--gox-control);border:1px solid var(--gox-border);border-radius:3px}
 ${scope} button[aria-pressed="true"]{background:var(--gox-active);border-color:var(--gox-accent);box-shadow:inset 0 -2px var(--gox-accent)}
 ${scope} :is(button,input,select,textarea,summary):focus-visible{outline:2px solid var(--gox-accent);outline-offset:2px}
 ${scope} :disabled{opacity:.55;cursor:not-allowed}
 ${scope} dialog::backdrop{background:rgba(0,0,0,.4)}
 `;document.head.append(style);
}
export function installViewportTheme(viewport,THREE){
 installGoxStyles();
 const apply=()=>{const theme=document.documentElement.dataset.nvTheme==='dark'?'dark':'light',colors=goxThemes[theme];viewport.theme=colors;
  viewport.scene.background.set(colors.background);viewport.host.style.background='#'+viewport.scene.background.getHexString();
  themeGrid(viewport.grid,new THREE.Color(colors.gridCenter),new THREE.Color(colors.gridLine));
  viewport.selection.material.color.set(colors.selection);viewport.preview.material.color.set(colors.cursor);
  viewport.buildOverlay.applyTheme();viewport.host.dispatchEvent(new Event('gox-viewport-theme'));viewport.render();
 };
 window.addEventListener('nv-theme-changed',apply);apply();return()=>window.removeEventListener('nv-theme-changed',apply);
}
