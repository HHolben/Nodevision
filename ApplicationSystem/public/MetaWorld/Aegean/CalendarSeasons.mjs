// Nodevision/ApplicationSystem/public/MetaWorld/Aegean/CalendarSeasons.mjs
// This adapter derives seasonal terrain appearance from the existing astronomy calendar without owning time, mutating saved settings or creating history entries.
import { seasonAt } from '../Astronomy/WorldCalendar.mjs';
export function createCalendarSeasonBinding(environment,applySeason) {
  let previousClock=null,second=NaN,latitude=null,timezone=null;
  const state={season:environment?.season,source:'manual'};
  function apply(season,source){state.season=season;state.source=source;return applySeason(season);}
  return {state,update(astronomy){
    if(environment?.id!=='aegean')return false;
    const clock=astronomy?.clock,instant=clock?.instant,lat=astronomy?.config?.observer?.latitude;
    if(environment.seasonMode!=='calendar'||!clock||!Number.isFinite(instant)||!Number.isFinite(lat)){
      previousClock=null;second=NaN;
      return apply(environment.season,environment.seasonMode==='calendar'?'calendar unavailable; manual fallback':'manual');
    }
    const nextSecond=Math.floor(instant/1000),zone=clock.timezone||'UTC';
    if(clock===previousClock&&second===nextSecond&&lat===latitude&&zone===timezone)return false;
    previousClock=clock;second=nextSecond;latitude=lat;timezone=zone;
    return apply(seasonAt(instant,lat,zone),'world calendar');
  }};
}
