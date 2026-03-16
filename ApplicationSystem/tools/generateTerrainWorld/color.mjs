// Nodevision/ApplicationSystem/tools/generateTerrainWorld/color.mjs
// This file defines helpers for blending terrain colors based on elevation. It converts between hex and RGB representations and interpolates channel values.

import { lerp } from "./math.mjs";

function hexToRgb(hex) {
  const cleaned = hex.replace("#", "");
  return {
    r: Number.parseInt(cleaned.slice(0, 2), 16),
    g: Number.parseInt(cleaned.slice(2, 4), 16),
    b: Number.parseInt(cleaned.slice(4, 6), 16)
  };
}

function rgbToHex(rgb) {
  const c = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
  return `#${c(rgb.r)}${c(rgb.g)}${c(rgb.b)}`;
}

export function blendHex(lowHex, highHex, t) {
  const a = hexToRgb(lowHex);
  const b = hexToRgb(highHex);
  return rgbToHex({
    r: lerp(a.r, b.r, t),
    g: lerp(a.g, b.g, t),
    b: lerp(a.b, b.b, t)
  });
}

