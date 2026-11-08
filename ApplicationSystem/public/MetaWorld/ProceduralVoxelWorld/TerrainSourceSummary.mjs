// Nodevision/ApplicationSystem/public/MetaWorld/ProceduralVoxelWorld/TerrainSourceSummary.mjs
// This module describes the authoritative terrain source for the existing world inspector. Geographic metadata is distinguished from optional procedural decoration settings without changing the saved definition or allocating terrain.

import {infiniteWorld,worldExtentDescription} from './WorldExtent.mjs';

export function terrainSourceSummary(def) {
  const dimensions = `${worldExtentDescription(def)} ${infiniteWorld(def)?'':`Size: ${def.size[0]} × ${def.size[2]} m.`} Elevation: ${def.heightLimits?.min ?? 0} to ${def.heightLimits?.max ?? def.size[1]} m. Voxels: ${def.voxelSize} m; chunks: ${def.chunks.voxelsPerAxis}³. Position: ${def.position.join(', ')}.`;
  if (def.terrainSource === 'geographic') {
    const g = def.geographic;
    return [
      'Source: Geographic DEM.',
      `File: ${g.elevation.asset.path}. Format: GeoTIFF. Source CRS: EPSG:${g.elevation.crs}; local projection: ${g.projection}.`,
      `Crop (west, south, east, north): ${g.crop?.join(', ') ?? 'not recorded'}. Geographic origin: ${g.geographicOrigin?.join(', ') ?? 'not recorded'}; projected origin: ${g.origin.join(', ')}.`,
      `Horizontal scale: ${g.horizontalScale}. Elevation scale: ${g.verticalExaggeration}; vertical offset: ${g.verticalOffset} m.`,
      `Biome source: ${g.landcover?.asset?.path ?? 'default ' + g.defaultBiome}${!g.landcover && g.landcoverSource ? ' (land-cover source has no overlap: ' + g.landcoverSource.path + ')' : ''}; ${g.regions?.length ?? 0} polygon overrides.`,
      `Auxiliary seed: ${def.generator.seed} (vegetation${g.detail ? ' and explicitly enabled surface detail' : '; no elevation noise'}).`,
      dimensions,
    ].join(' ');
  }
  if (['map', 'hybrid'].includes(def.terrainSource)) {
    return `Source: Authored map${def.terrainSource === 'hybrid' ? ' with procedural detail' : ''}. File: ${def.terrainMap.path}. Outside coverage: ${def.terrainMap.outside}. Auxiliary seed: ${def.generator.seed}. ${dimensions}`;
  }
  return `Source: Procedural. Seed: ${def.generator.seed} · ${def.generator.id} / version ${def.generator.version}. ${dimensions}`;
}

// Availability diagnostics supplement rendering errors rather than hiding them.
export function terrainRuntimeStatus(runtime, def) {
  const messages = [`Active representation: ${runtime.representation || def.representation || 'voxel'}.`];
  if (runtime.mapError) messages.push('Terrain map: ' + runtime.mapError.message);
  if (runtime.materialError) messages.push('Material loading failed: ' + runtime.materialError.message);
  if (runtime.geographicStatus?.message) messages.push(runtime.geographicStatus.message);
  if (def.geographic?.warnings?.length) messages.push(...def.geographic.warnings);
  if (runtime.map?.warnings?.length) messages.push(...runtime.map.warnings);
  messages.push(`${runtime.stats.loaded} chunks loaded; ${runtime.stats.queued} queued chunks/columns. Terrain streams as the camera moves.`);
  if (def.environment?.id === 'aegean') messages.push(`Season: ${runtime.seasonState.season} (${runtime.seasonState.source}).`);
  return messages.join(' ');
}
