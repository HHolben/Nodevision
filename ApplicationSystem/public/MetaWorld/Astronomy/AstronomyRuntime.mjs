// Nodevision/ApplicationSystem/public/MetaWorld/Astronomy/AstronomyRuntime.mjs
// This runtime combines an explicitly configured observer and calendar with independent body rendering, batched stars and solar-event commands.
import { createWorldCalendar, seasonAt } from './WorldCalendar.mjs';
import { skyAt, nextSolarEvent, RAD } from './CelestialCoordinates.mjs';
import { createBodyRenderer } from './BodyRenderer.mjs';
import { loadStarCatalog, createStarRenderer } from './StarRenderer.mjs';
export function createAstronomyRuntime(THREE,scene,temporal,configuration,options={}) {
  const config=structuredClone(configuration),clock=createWorldCalendar(temporal,config.clock,options);
  const bodies=createBodyRenderer(THREE,scene,config.bodies);
  let stars=null,disposed=false,lastInstant=NaN,sky=null;
  const hasSun=config.bodies.some(b=>b.type==='sun');
  const ready=config.stars.enabled?(options.catalog?Promise.resolve(options.catalog):loadStarCatalog()).then(catalog=>{
    if(disposed)return;stars=createStarRenderer(THREE,catalog);scene.add(stars.points);
  }):Promise.resolve();
  return {clock,config,bodies,ready,get stars(){return stars;},get sky(){return sky;},hasSun,
    get season(){return seasonAt(clock.instant,config.observer.latitude,clock.timezone);},
    sleep(kind){
      if(!hasSun||!['daybreak','nightfall'].includes(kind))return {ok:false,message:'This world has no supported Sun.'};
      const event=nextSolarEvent(clock.instant,config.observer,kind);
      if(event===null)return {ok:false,message:'No matching solar event occurs within the next three days.'};
      clock.jumpTo(event);lastInstant=NaN;return {ok:true,instant:event,message:`Advanced to ${clock.localDateTime} (${clock.timezone})`};
    },
    update(camera){
      if(disposed)return;
      const instant=clock.instant;
      if(!sky||!Number.isFinite(lastInstant)||Math.abs(instant-lastInstant)>=1000){sky=skyAt(instant,config.observer);lastInstant=instant;}
      bodies.update(sky,camera);
      const visibility=hasSun?Math.max(0,Math.min(1,(-sky.sun.altitude/RAD)/6)):1;
      stars?.update(instant,config.observer,visibility);
      if(hasSun){const day=Math.max(0,Math.min(1,(sky.sun.altitude/RAD+6)/12));
        scene.background=new THREE.Color('#03050e').lerp(new THREE.Color('#7fb7e8'),day);}
    },
    snapshot(){return {...config,clock:clock.snapshot()};},
    dispose(){if(disposed)return;disposed=true;stars?.dispose();bodies.dispose();}
  };
}
