// Nodevision/ApplicationSystem/public/MetaWorld/ProceduralVoxelWorld/VoxelWorldToolState.mjs
// This module retains one canonical insertion configuration per world bridge and converts surface hits into ordinary procedural-world definitions. It delegates all generation and validation to the existing authoring model.
import { voxelWorldForm, definitionFromVoxelForm } from './VoxelAuthoringDefinition.mjs';
import { PROCEDURAL_VOXEL_TYPE, validateVoxelWorld } from './VoxelWorldDefinition.mjs';
export const VOXEL_WORLD_TOOL_ID = PROCEDURAL_VOXEL_TYPE;
export const VOXEL_WORLD_ICON = '/icons/VoxelWorldIcon.svg';
const settings = new WeakMap();
export function getVoxelWorldToolSettings(bridge) {
  if (!settings.has(bridge)) settings.set(bridge, voxelWorldForm());
  return structuredClone(settings.get(bridge));
}
export function setVoxelWorldToolSettings(bridge, values) {
  const merged = {...getVoxelWorldToolSettings(bridge), ...values};
  if (values.environmentPreset !== undefined && values.startingBiome === undefined) merged.startingBiome = values.environmentPreset === 'aegean' ? 'aegean' : 'auto';
  merged.environmentPreset = merged.startingBiome === 'aegean' ? 'aegean' : 'legacy';
  validateVoxelWorld(definitionFromVoxelForm(merged));
  settings.set(bridge, structuredClone(merged));
  return getVoxelWorldToolSettings(bridge);
}
export function voxelWorldPlacementDefinition(bridge, point, snapToGrid = false) {
  const def = definitionFromVoxelForm(getVoxelWorldToolSettings(bridge));
  const coordinates = [point?.x, point?.y, point?.z];
  if (!coordinates.every(Number.isFinite)) throw Error('Point at a surface to place the Voxel World.');
  const [x,y,z] = coordinates.map(n => snapToGrid ? Math.round(n) : n);
  // The hit marks the horizontal center and local elevation zero, just as the
  // original dialog centered the terrain around world origin.
  def.position = [x-def.size[0]/2, y, z-def.size[2]/2];
  return validateVoxelWorld(def);
}
