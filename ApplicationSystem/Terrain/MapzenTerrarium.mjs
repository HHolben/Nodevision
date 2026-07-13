// Nodevision/ApplicationSystem/Terrain/MapzenTerrarium.mjs
// Terrarium PNG elevation decoding shared by Mapzen terrain adapters and tests.

export function decodeMapzenTerrariumPixel(red, green, blue) {
  const r = Number(red);
  const g = Number(green);
  const b = Number(blue);
  if (![r, g, b].every(Number.isFinite)) throw new Error("Terrarium pixel channels must be finite numbers.");
  if (r < 0 || r > 255 || g < 0 || g > 255 || b < 0 || b > 255) throw new Error("Terrarium pixel channels must be 0-255.");
  return (r * 256) + g + (b / 256) - 32768;
}

export function encodeMapzenTerrariumElevation(elevationMeters) {
  const value = Number(elevationMeters) + 32768;
  if (!Number.isFinite(value) || value < 0 || value >= 65536) throw new Error("Elevation is outside Terrarium encodable range.");
  const red = Math.floor(value / 256);
  const green = Math.floor(value - red * 256);
  const blue = Math.round((value - red * 256 - green) * 256);
  return { red, green, blue };
}
