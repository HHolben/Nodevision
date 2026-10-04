// Nodevision/ApplicationSystem/public/MetaWorld/ProceduralVoxelWorld/VoxelWorldDefinition.mjs
// This module validates trusted declarative voxel terrain settings before any runtime allocation.

export const PROCEDURAL_VOXEL_TYPE = "procedural-voxel-world";
export function validateVoxelWorld(def) {
  const fail = message => { throw new Error(`Procedural voxel world: ${message}`); };
  const vector = (v, label) => {
    if (!Array.isArray(v) || v.length !== 3 || !v.every(Number.isFinite)) fail(`${label} must contain three finite numbers`);
    return v.slice();
  };
  if (typeof def.id !== "string" || !def.id.trim()) fail("id is required");
  const position = vector(def.position ?? [0, 0, 0], "position");
  const size = vector(def.size, "size");
  if (def.voxelSize !== 0.25) fail("version 1 requires voxelSize 0.25");
  if (!size.every(n => n > 0 && n <= 4096 && Number.isSafeInteger(n / 0.25))) fail("size must be positive voxel multiples up to 4096 meters");
  if (size[0] < 1 || size[2] < 1) fail("horizontal dimensions must fit a player (at least 1 meter)");
  if (!position.every(n => Math.abs(n) <= 1e6)) fail("position exceeds supported range");
  if (def.rotation && !vector(def.rotation, "rotation").every(n => n === 0)) fail("rotation is unsupported");
  if (def.scale && !vector(def.scale, "scale").every(n => n === 1)) fail("scale is unsupported");
  const g = def.generator;
  if (g?.id !== "nodevision-terrain-v1" || g.version !== 1 || !Number.isInteger(g.seed) || g.seed < -2147483648 || g.seed > 2147483647) fail("unsupported generator or signed 32-bit seed");
  if (def.chunks?.voxelsPerAxis !== 32) fail("chunks.voxelsPerAxis must be 32");
  const radius = def.chunks.loadRadius;
  if (!Number.isInteger(radius) || radius < 1 || radius > 8) fail("loadRadius must be an integer from 1 to 8");
  if (def.voxelPattern || def.isVoxel || def.voxelPlacer) fail("authored voxel metadata is unsupported");
  return { ...def, type: PROCEDURAL_VOXEL_TYPE, id: def.id.trim(), position, size,
    voxelSize: 0.25, generator: { id: g.id, version: 1, seed: g.seed },
    chunks: { voxelsPerAxis: 32, loadRadius: radius }, breakable: false, isSolid: true };
}
