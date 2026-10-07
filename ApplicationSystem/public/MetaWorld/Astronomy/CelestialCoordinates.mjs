// Nodevision/ApplicationSystem/public/MetaWorld/Astronomy/CelestialCoordinates.mjs
// This module maps equatorial catalog coordinates and library ephemerides into an east-up-south world frame using UTC and an independent geographic observer.
import SunCalc from '../../vendor/suncalc/suncalc.mjs';
export const RAD = Math.PI / 180;
export function horizontalDirection(position) {
  const c = Math.cos(position.altitude);
  return [-Math.sin(position.azimuth) * c, Math.sin(position.altitude), Math.cos(position.azimuth) * c];
}
export function celestialMatrix(THREE, instant, observer) {
  const days = instant / 86400000 + 2440587.5 - 2451545;
  const angle = (280.16 + 360.9856235 * days + observer.longitude) * RAD, latitude = observer.latitude * RAD;
  const c = Math.cos(angle), s = Math.sin(angle), cp = Math.cos(latitude), sp = Math.sin(latitude);
  return new THREE.Matrix4().set(-s,c,0,0, cp*c,cp*s,sp,0, sp*c,sp*s,-cp,0, 0,0,0,1);
}
export function skyAt(instant, observer) {
  const date = new Date(instant), { latitude, longitude } = observer;
  const sun = SunCalc.getPosition(date, latitude, longitude), moon = SunCalc.getMoonPosition(date, latitude, longitude);
  const phase = SunCalc.getMoonIllumination(date);
  const rising = SunCalc.getPosition(new Date(instant + 60000), latitude, longitude).altitude > sun.altitude;
  return { sun, moon, phase, state: sun.altitude >= 0 ? 'day' : sun.altitude >= -6*RAD ? (rising ? 'dawn' : 'dusk') : 'night' };
}
export function nextSolarEvent(instant, observer, kind) {
  const threshold = (kind === 'daybreak' ? -.833 : -6) * RAD, rising = kind === 'daybreak';
  const altitude = t => SunCalc.getPosition(new Date(t), observer.latitude, observer.longitude).altitude - threshold;
  let previousTime = instant + 1000, previous = altitude(previousTime);
  // Three days keeps polar searches bounded and reports unavailable events instead of choosing a fixed hour.
  for (let t = previousTime + 600000; t <= instant + 3*86400000; t += 600000) {
    const value = altitude(t);
    if (rising ? previous < 0 && value >= 0 : previous > 0 && value <= 0) {
      let lo = previousTime, hi = t;
      for (let i = 0; i < 24; i++) { const mid = (lo+hi)/2; if (rising ? altitude(mid) < 0 : altitude(mid) > 0) lo = mid; else hi = mid; }
      return hi;
    }
    previous = value; previousTime = t;
  }
  return null;
}
