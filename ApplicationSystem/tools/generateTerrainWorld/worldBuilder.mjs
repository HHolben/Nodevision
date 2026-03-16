// Nodevision/ApplicationSystem/tools/generateTerrainWorld/worldBuilder.mjs
// This file defines terrain world construction for the generator CLI. It builds a world object list with deterministic heights, colors, and spawn metadata.

import { fractalNoise2D } from "./noise.mjs";
import { lerp } from "./math.mjs";
import { blendHex } from "./color.mjs";

export function buildTerrainWorld(params) {
  const objects = [];
  const side = params.tiles;
  const halfSpan = (side * params.tileSize) / 2;
  let centerHeight = params.minHeight;

  for (let ix = 0; ix < side; ix += 1) {
    for (let iz = 0; iz < side; iz += 1) {
      const noiseX = ix * params.noiseScale;
      const noiseZ = iz * params.noiseScale;
      const noise = fractalNoise2D(noiseX, noiseZ, params);
      const h = lerp(params.minHeight, params.maxHeight, noise);

      const x = -halfSpan + params.tileSize * 0.5 + ix * params.tileSize;
      const z = -halfSpan + params.tileSize * 0.5 + iz * params.tileSize;
      const y = h / 2;
      const colorT = (h - params.minHeight) / Math.max(1e-9, params.maxHeight - params.minHeight);
      const color = blendHex(params.colorLow, params.colorHigh, colorT);

      objects.push({
        type: "box",
        position: [x, y, z],
        size: [params.tileSize, h, params.tileSize],
        color,
        isSolid: true,
        tag: "terrain"
      });

      if (ix === Math.floor(side / 2) && iz === Math.floor(side / 2)) {
        centerHeight = h;
      }
    }
  }

  objects.push({
    type: "box",
    position: [0, centerHeight + params.spawnHeightOffset, 0],
    size: [0.8, 1.8, 0.8],
    color: "#f5f5f5",
    isSolid: false,
    tag: "spawn",
    spawnId: "terrain_spawn",
    spawnYaw: 0
  });

  return {
    worldMode: "3d",
    metadata: {
      generator: "tools/generateTerrainWorld.mjs",
      generatedAt: new Date().toISOString(),
      params: {
        tiles: params.tiles,
        tileSize: params.tileSize,
        minHeight: params.minHeight,
        maxHeight: params.maxHeight,
        noiseScale: params.noiseScale,
        octaves: params.octaves,
        persistence: params.persistence,
        lacunarity: params.lacunarity,
        seed: params.seed
      }
    },
    objects
  };
}

