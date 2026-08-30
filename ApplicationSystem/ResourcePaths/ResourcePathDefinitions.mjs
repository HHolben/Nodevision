// Nodevision/ApplicationSystem/ResourcePaths/ResourcePathDefinitions.mjs
// This module defines built-in Notebook-relative resource path keys shared by server routes and local services.

export const RESOURCE_PATHS_FILENAME = "ResourcePaths.json";
export const RESOURCE_PATH_CONFIG_VERSION = 1;

export const BUILT_IN_RESOURCE_PATHS = Object.freeze([
  {
    key: "aviation.sectionalMaps",
    name: "FAA Sectional Maps",
    defaultPath: "Resources/Aviation/Sectionals",
    description: "FAA sectional GeoTIFF ZIP packages owned by the active Notebook.",
  },
  {
    key: "maps.streetMaps",
    name: "Street Maps",
    defaultPath: "Resources/Maps/StreetMaps",
    description: "Offline street map resources for map viewers and importers.",
  },
  {
    key: "maps.terrain",
    name: "Terrain / Elevation Data",
    defaultPath: "Resources/Maps/Terrain",
    description: "Terrain and elevation datasets available to map and world tools.",
  },
  {
    key: "fonts",
    name: "Fonts",
    defaultPath: "Resources/Fonts",
    description: "Notebook-owned fonts available to editors and renderers.",
  },
  {
    key: "dictionaries",
    name: "Dictionaries",
    defaultPath: "Resources/Dictionaries",
    description: "Notebook-owned dictionaries and word lists.",
  },
  {
    key: "materials",
    name: "Materials",
    defaultPath: "Resources/Materials",
    description: "Notebook-owned material definitions for world tools.",
  },
  {
    key: "electronics.components",
    name: "Circuit Component Libraries",
    defaultPath: "Library/Electronics/Components",
    description: "Notebook-owned circuit component library documents and related electronics assets.",
  },
  {
    key: "contacts",
    name: "Contacts",
    defaultPath: "Resources/Contacts",
    description: "Notebook-owned contact resources for future local features.",
  },
]);

export function getBuiltInResourcePathDefinitions() {
  return BUILT_IN_RESOURCE_PATHS.map((entry) => ({ ...entry, builtIn: true, protected: true }));
}

export function getBuiltInResourcePathDefinition(key) {
  return getBuiltInResourcePathDefinitions().find((entry) => entry.key === String(key || "")) || null;
}

export function isBuiltInResourcePathKey(key) {
  return Boolean(getBuiltInResourcePathDefinition(key));
}
