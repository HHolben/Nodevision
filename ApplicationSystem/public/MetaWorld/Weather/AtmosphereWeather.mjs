// Nodevision/ApplicationSystem/public/MetaWorld/Weather/AtmosphereWeather.mjs
// This module resolves atmosphere weather capabilities from canonical gas metadata without inferring astronomical bodies or lighting.
import { resolveWorldObjectMaterial } from '../Materials/WorldObjectMaterialResolver.mjs';
export function supportsEarthWeather(material) {
  const definition = material?.materialDefinition ?? material;
  return String(definition?.MatterState).toLowerCase() === 'gas'
    && definition?.atmosphere?.supportsWeather === true
    && definition.atmosphere.weatherProfile === 'earth-like';
}
export async function resolveAtmosphereWeather(environment, options = {}) {
  if (environment.gasMaterialFile) {
    const response = await (options.fetch ?? globalThis.fetch)(environment.gasMaterialFile);
    if (!response.ok) throw Error(`Cannot load atmosphere material: ${response.status}`);
    return supportsEarthWeather(await response.json());
  }
  if (!environment.gasMaterialId) return false;
  return supportsEarthWeather(await resolveWorldObjectMaterial(environment.gasMaterialId, options));
}
