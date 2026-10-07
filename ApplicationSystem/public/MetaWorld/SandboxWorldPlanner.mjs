// Nodevision/ApplicationSystem/public/MetaWorld/SandboxWorldPlanner.mjs
// This planner conservatively creates declarative terrain worlds and reuses all authored definitions without allocating rendering or collision resources.

import { earthSandboxAstronomy } from './Astronomy/AstronomyConfig.mjs';
import { createDefaultHtmlWorld } from "./DefaultHtmlWorld.mjs";
import { validateVoxelWorld } from "./ProceduralVoxelWorld/VoxelWorldDefinition.mjs";
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
  return value;
}
export function classifySandboxWorld(definition, filePath) {
  if (definition === null || definition === undefined) return "missing";
  if (JSON.stringify(canonical(definition)) === JSON.stringify(canonical(createDefaultHtmlWorld(filePath)))) return "default";
  if (Array.isArray(definition.objects) && definition.objects.some(object => object?.type === "procedural-voxel-world")) return "procedural";
  return "authored";
}
export function createSandboxSeed(cryptoSource = globalThis.crypto) {
  return cryptoSource.getRandomValues(new Int32Array(1))[0];
}
export function planSandboxWorld(definition, filePath, seedFactory = createSandboxSeed) {
  const kind = classifySandboxWorld(definition, filePath);
  if (kind === "procedural" || kind === "authored") return { kind, created: false, definition };
  const terrain = validateVoxelWorld({ id: "procedural-terrain", type: "procedural-voxel-world",
    position: [-500,0,-500], size: [1000,128,1000], voxelSize: 0.25,
    generator: { id: "nodevision-terrain-v1", version: 1, seed: seedFactory() }, chunks: { voxelsPerAxis: 32, loadRadius: 8 } });
  return { kind, created: true, definition: {
    name: String(filePath).split("/").pop() || "Sandbox", type: "world", worldType: "NodevisionMetaWorld",
    spawnPosition: { x: 0, y: 1.75, z: 0 }, spawnYaw: 0,
    environment: { gasMaterialId: 'EarthTroposphere', gasMaterialFile: '/MetaWorld/Materials/Gasses/EarthTroposphere.json' },
    metadata: { objectGroundOnly: true, astronomy: earthSandboxAstronomy() }, objects: [terrain]
  } };
  // Future HTML-link planning belongs here, producing ordinary portal definitions through a shared planner.
}
