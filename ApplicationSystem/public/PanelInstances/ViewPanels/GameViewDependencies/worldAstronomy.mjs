// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/GameViewDependencies/worldAstronomy.mjs
// This adapter owns explicit world astronomy and delegates illumination away from the legacy brightness curve only while astronomy is active.
import { normalizeAstronomy } from '/MetaWorld/Astronomy/AstronomyConfig.mjs';
import { createAstronomyRuntime } from '/MetaWorld/Astronomy/AstronomyRuntime.mjs';
export function installWorldAstronomy(scene) {
  let owner=null,runtime=null,key='',oldLighting=null,oldBackground=null;
  function release(){
    runtime?.dispose();runtime=null;
    if(owner){delete owner.astronomy;if(oldLighting&&owner.consolePanels)owner.consolePanels.updateEnvironmentLighting=oldLighting;}
    if(oldBackground)scene.background=oldBackground;
    oldLighting=null;oldBackground=null;
  }
  return {prepare(){
    const ctx=window.VRWorldContext;if(ctx?.scene!==scene)return;
    owner=ctx;
    const world=ctx.currentWorldDefinition??ctx.state?.currentWorldDefinition;
    const config=normalizeAstronomy(world?.metadata?.astronomy);
    const identity=config?{...config,clock:{...config.clock,timezone:config.clock.timezone??runtime?.clock.timezone??Intl.DateTimeFormat().resolvedOptions().timeZone,savedTime:undefined}}:null;
    const next=JSON.stringify([ctx.currentWorldPath,identity]);
    if(next===key)return;release();key=next;
    if(!config||!ctx.temporalController)return;
    try{
      runtime=createAstronomyRuntime(ctx.THREE,scene,ctx.temporalController,config);
      ctx.astronomy=runtime;oldBackground=scene.background?.clone?.()??scene.background;
      oldLighting=ctx.consolePanels?.updateEnvironmentLighting;
      if(oldLighting)ctx.consolePanels.updateEnvironmentLighting=()=>1;
      scene.traverse(light=>{if(light.isLight&&Number.isFinite(light.userData.nvDayNightBaseIntensity))light.intensity=light.userData.nvDayNightBaseIntensity;});
      runtime.ready.catch(error=>console.warn('Astronomy catalog unavailable:',error));
    }catch(error){console.warn('Astronomy configuration unavailable:',error);}
  },update(camera){
    if(!runtime||!camera)return;
    runtime.update(camera);
    if(runtime.config.clock.mode==='saved')for(const world of [owner.currentWorldDefinition,owner.state?.currentWorldDefinition]){
      if(world?.metadata?.astronomy)world.metadata.astronomy.clock=runtime.clock.snapshot();
    }
  },dispose(){release();owner=null;}};
}
