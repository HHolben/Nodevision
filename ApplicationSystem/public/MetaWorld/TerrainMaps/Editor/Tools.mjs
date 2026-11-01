// Nodevision/ApplicationSystem/public/MetaWorld/TerrainMaps/Editor/Tools.mjs
// This module defines shared terrain-map tool identities and their display labels. It keeps cursor providers and editor controls aligned without duplicating tool definitions.
export const MAP_TOOLS=Object.freeze(['pan','select','raise','lower','smooth','flatten','set','pick-elevation','biome','pick-biome','material','erase-material','pick-material']);
export const toolLabel=id=>({'set':'Set Elevation','pick-elevation':'Sample Elevation','pick-biome':'Sample Biome','pick-material':'Sample Material','erase-material':'Erase Override'}[id]||id[0].toUpperCase()+id.slice(1));
