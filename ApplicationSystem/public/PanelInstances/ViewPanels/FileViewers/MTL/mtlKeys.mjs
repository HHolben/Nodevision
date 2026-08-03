// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/FileViewers/MTL/mtlKeys.mjs
// This module defines Wavefront MTL keyword groups, display labels, and canonical output keys shared by MTL parsing and editing helpers.

export const COLOR_KEYS = new Set(["ka", "kd", "ks", "ke", "tf"]);
export const NUMBER_KEYS = new Set(["ns", "ni", "d", "tr", "sharpness"]);
export const MAP_KEYS = new Set([
  "map_ka",
  "map_kd",
  "map_ks",
  "map_ke",
  "map_ns",
  "map_d",
  "map_bump",
  "bump",
  "disp",
  "decal",
  "refl",
  "norm",
]);

export const MTL_KEY_LABELS = {
  ka: "Ambient",
  kd: "Diffuse",
  ks: "Specular",
  ke: "Emission",
  tf: "Transmission filter",
  ns: "Shininess",
  ni: "Optical density",
  d: "Opacity",
  tr: "Transparency",
  illum: "Illumination",
  map_ka: "Ambient map",
  map_kd: "Diffuse map",
  map_ks: "Specular map",
  map_ke: "Emission map",
  map_ns: "Shininess map",
  map_d: "Opacity map",
  map_bump: "Bump map",
  bump: "Bump map",
  disp: "Displacement map",
  decal: "Decal map",
  refl: "Reflection map",
  norm: "Normal map",
};

export const CANONICAL_KEY = {
  ka: "Ka",
  kd: "Kd",
  ks: "Ks",
  ke: "Ke",
  tf: "Tf",
  ns: "Ns",
  ni: "Ni",
  d: "d",
  tr: "Tr",
  illum: "illum",
  map_ka: "map_Ka",
  map_kd: "map_Kd",
  map_ks: "map_Ks",
  map_ke: "map_Ke",
  map_ns: "map_Ns",
  map_d: "map_d",
  map_bump: "map_Bump",
  bump: "bump",
  disp: "disp",
  decal: "decal",
  refl: "refl",
  norm: "norm",
};
