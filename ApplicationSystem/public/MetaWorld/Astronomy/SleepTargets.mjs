// Nodevision/ApplicationSystem/public/MetaWorld/Astronomy/SleepTargets.mjs
// This module derives upcoming named sleep targets from local solar events and orders them relative to the current world instant.
import SunCalc from '../../vendor/suncalc/suncalc.mjs';
import { nextSolarEvent } from './CelestialCoordinates.mjs';
export const SLEEP_TARGETS = Object.freeze([
  ['daybreak','Daybreak'],['mid-morning','Mid morning'],['noon','Noon'],['mid-afternoon','Mid afternoon'],
  ['evening','Evening'],['nightfall','Nightfall'],['midnight','Midnight']
]);
export function nextSleepTarget(instant,observer,kind) {
  if(kind==='daybreak'||kind==='nightfall')return nextSolarEvent(instant,observer,kind);
  if(!SLEEP_TARGETS.some(([id])=>id===kind))return null;
  let best=Infinity;
  for(let day=-1;day<=3;day++){
    const times=SunCalc.getTimes(new Date(instant+day*86400000),observer.latitude,observer.longitude);
    const rise=Number(times.sunrise),noon=Number(times.solarNoon),set=Number(times.sunset);
    const values={'mid-morning':(rise+noon)/2,noon,'mid-afternoon':(noon+set)/2,evening:set,midnight:noon+43200000};
    const time=values[kind];if(Number.isFinite(time)&&time>instant+1000&&time<=instant+3*86400000)best=Math.min(best,time);
  }
  return Number.isFinite(best)?best:null;
}
export function upcomingSleepTargets(instant,observer) {
  return SLEEP_TARGETS.map(([id,label])=>({id,label,instant:nextSleepTarget(instant,observer,id)}))
    .filter(target=>target.instant!==null).sort((a,b)=>a.instant-b.instant);
}
