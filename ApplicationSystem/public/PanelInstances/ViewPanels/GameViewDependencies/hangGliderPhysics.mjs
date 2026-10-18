// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/GameViewDependencies/hangGliderPhysics.mjs
// This module defines a bounded gameplay gliding model in the world's existing per-frame physics units. Lift redirects a fraction of downward acceleration into forward motion while drag dissipates speed; the model never supplies upward thrust.
export const HANG_GLIDER_FIELDS = [
  {key:'lift',label:'Lift / weight',min:0,max:.95,step:.01,value:.9},
  {key:'thrust',label:'Weight to forward thrust',min:0,max:1,step:.01,value:.65},
  {key:'drag',label:'Drag coefficient',min:.005,max:.3,step:.005,value:.03},
  {key:'steering',label:'Steering response',min:.01,max:.3,step:.01,value:.08},
  {key:'maxSpeed',label:'Speed limit (m/s)',min:3,max:60,step:1,value:24},
];
export function normalizeHangGliderSettings(values = {}) {
  return Object.fromEntries(HANG_GLIDER_FIELDS.map(({key,min,max,value}) => {
    const number = values[key] === '' || values[key] == null ? NaN : Number(values[key]);
    return [key,Number.isFinite(number) ? Math.max(min,Math.min(max,number)) : value];
  }));
}
export function hangGliderForces(speed,velocityY,gravity,values) {
  const settings = normalizeHangGliderSettings(values);
  const descending = velocityY <= 0;
  const redirected = descending ? gravity * settings.lift : 0;
  return {
    speed:Math.min(settings.maxSpeed/60,Math.max(0,speed)*(1-settings.drag)+redirected*settings.thrust),
    velocityY:descending ? velocityY*(1-settings.drag) : velocityY,
    gravity:gravity-redirected,
  };
}
