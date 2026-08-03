// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/FileViewers/MTL/mtlFormat.mjs
// This module re-exports Wavefront MTL parsing, serialization, material mutation, and formatting helpers through a stable facade.

export { COLOR_KEYS, MAP_KEYS, MTL_KEY_LABELS, NUMBER_KEYS } from "./mtlKeys.mjs";
export { parseMtl, serializeMtl } from "./mtlParse.mjs";
export {
  clamp,
  colorToHex,
  createMaterial,
  escapeHTML,
  findEntries,
  findEntry,
  formatNumber,
  getColor,
  getNumber,
  getTextValue,
  hexToColor,
  materialOpacity,
  materialPreviewColor,
  materialTextureEntries,
  materialUnknownEntries,
  setColor,
  setMaterialName,
  setNumber,
  setTextValue,
  summarizeMtl,
  textureFileName,
  uniqueMaterialName,
} from "./mtlMaterialValues.mjs";
