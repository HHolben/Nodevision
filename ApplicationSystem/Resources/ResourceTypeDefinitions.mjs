// Nodevision/ApplicationSystem/Resources/ResourceTypeDefinitions.mjs
// Defines typed resource categories, source kinds, and resolution strategies for Nodevision resources.

export const RESOURCE_CONFIG_VERSION = 2;
export const RESOURCE_SOURCE_TYPES = Object.freeze({
  APPLICATION: "application",
  MANAGED: "managed",
  NOTEBOOK: "notebook",
});
export const RESOURCE_RESOLUTION_STRATEGIES = Object.freeze({
  COLLECTION: "collection",
  OVERLAY: "overlay",
});

export const RESOURCE_TYPE_IDS = Object.freeze({
  IMAGE: "image",
  AUDIO: "audio",
  VIDEO: "video",
  MODEL: "model",
  FONT: "font",
  DICTIONARY: "dictionary",
  FAA_SECTIONAL: "faa.sectional",
  MATERIAL: "material",
  ELECTRONICS_COMPONENT: "electronics.component",
});

const IMAGE_EXTENSIONS = Object.freeze([".apng", ".avif", ".bmp", ".gif", ".ico", ".jpeg", ".jpg", ".png", ".svg", ".webp"]);
const AUDIO_EXTENSIONS = Object.freeze([".aac", ".flac", ".m4a", ".mp3", ".oga", ".ogg", ".opus", ".wav", ".weba"]);
const VIDEO_EXTENSIONS = Object.freeze([".avi", ".m4v", ".mov", ".mp4", ".mpeg", ".ogv", ".webm"]);
const MODEL_EXTENSIONS = Object.freeze([".3mf", ".dae", ".fbx", ".glb", ".gltf", ".obj", ".ply", ".scad", ".stl", ".usd", ".usda", ".usdc", ".usdz"]);
const FONT_EXTENSIONS = Object.freeze([".ttf", ".otf", ".woff", ".woff2"]);
const DICTIONARY_EXTENSIONS = Object.freeze([".json", ".dictionary.json", ".wordlist", ".txt"]);
const FAA_SECTIONAL_EXTENSIONS = Object.freeze([".zip", ".tif", ".tiff", ".geotiff"]);
const MATERIAL_EXTENSIONS = Object.freeze([".json"]);
const ELECTRONICS_COMPONENT_EXTENSIONS = Object.freeze([
  ".json",
  ".component.json",
  ".nvcircuit-component.json",
  ".kicad_sym",
  ".lib",
  ".kicad_mod",
  ".mod",
  ".cir",
  ".sp",
  ".spi",
  ".subckt",
  ".ibs",
  ".pdf",
  ".step",
  ".stp",
  ".stl",
  ".obj",
  ".glb",
  ".gltf",
]);

export const RESOURCE_TYPES = Object.freeze([
  Object.freeze({
    id: RESOURCE_TYPE_IDS.IMAGE,
    displayName: "Images",
    description: "Image files available to documents, SVG tools, and world-object surfaces.",
    resolutionStrategy: RESOURCE_RESOLUTION_STRATEGIES.COLLECTION,
    legacyPathKey: "media.images",
    supportedExtensions: IMAGE_EXTENSIONS,
    defaultSources: Object.freeze([
      Object.freeze({ id: "image.managed", name: "Managed Images", sourceType: RESOURCE_SOURCE_TYPES.MANAGED, path: "Resources/Media/Images", enabled: true, priority: 100, protected: true, removable: false, editable: false }),
      Object.freeze({ id: "image.notebook.default", name: "Notebook Images", sourceType: RESOURCE_SOURCE_TYPES.NOTEBOOK, path: "Resources/Media/Images", enabled: true, priority: 200, protected: true, removable: false, editable: true, legacyPath: true }),
    ]),
  }),
  Object.freeze({
    id: RESOURCE_TYPE_IDS.AUDIO,
    displayName: "Audio",
    description: "Audio files available to HTML documents and virtual world sound objects.",
    resolutionStrategy: RESOURCE_RESOLUTION_STRATEGIES.COLLECTION,
    legacyPathKey: "media.audio",
    supportedExtensions: AUDIO_EXTENSIONS,
    defaultSources: Object.freeze([
      Object.freeze({ id: "audio.managed", name: "Managed Audio", sourceType: RESOURCE_SOURCE_TYPES.MANAGED, path: "Resources/Media/Audio", enabled: true, priority: 100, protected: true, removable: false, editable: false }),
      Object.freeze({ id: "audio.notebook.default", name: "Notebook Audio", sourceType: RESOURCE_SOURCE_TYPES.NOTEBOOK, path: "Resources/Media/Audio", enabled: true, priority: 200, protected: true, removable: false, editable: true, legacyPath: true }),
    ]),
  }),
  Object.freeze({
    id: RESOURCE_TYPE_IDS.VIDEO,
    displayName: "Video",
    description: "Video files available to HTML documents and media panels.",
    resolutionStrategy: RESOURCE_RESOLUTION_STRATEGIES.COLLECTION,
    legacyPathKey: "media.video",
    supportedExtensions: VIDEO_EXTENSIONS,
    defaultSources: Object.freeze([
      Object.freeze({ id: "video.managed", name: "Managed Video", sourceType: RESOURCE_SOURCE_TYPES.MANAGED, path: "Resources/Media/Video", enabled: true, priority: 100, protected: true, removable: false, editable: false }),
      Object.freeze({ id: "video.notebook.default", name: "Notebook Video", sourceType: RESOURCE_SOURCE_TYPES.NOTEBOOK, path: "Resources/Media/Video", enabled: true, priority: 200, protected: true, removable: false, editable: true, legacyPath: true }),
    ]),
  }),
  Object.freeze({
    id: RESOURCE_TYPE_IDS.MODEL,
    displayName: "3D Models",
    description: "3D model files available to HTML model panels and virtual world object-file layers.",
    resolutionStrategy: RESOURCE_RESOLUTION_STRATEGIES.COLLECTION,
    legacyPathKey: "models",
    supportedExtensions: MODEL_EXTENSIONS,
    defaultSources: Object.freeze([
      Object.freeze({ id: "model.managed", name: "Managed 3D Models", sourceType: RESOURCE_SOURCE_TYPES.MANAGED, path: "Resources/Models", enabled: true, priority: 100, protected: true, removable: false, editable: false }),
      Object.freeze({ id: "model.notebook.default", name: "Notebook 3D Models", sourceType: RESOURCE_SOURCE_TYPES.NOTEBOOK, path: "Resources/Models", enabled: true, priority: 200, protected: true, removable: false, editable: true, legacyPath: true }),
      Object.freeze({ id: "model.notebook.legacy", name: "Notebook Models", sourceType: RESOURCE_SOURCE_TYPES.NOTEBOOK, path: "models", enabled: true, priority: 300, protected: true, removable: false, editable: true }),
    ]),
  }),
  Object.freeze({
    id: RESOURCE_TYPE_IDS.FONT,
    displayName: "Fonts",
    description: "Font files available to editors and documents.",
    resolutionStrategy: RESOURCE_RESOLUTION_STRATEGIES.COLLECTION,
    legacyPathKey: "fonts",
    supportedExtensions: FONT_EXTENSIONS,
    defaultSources: Object.freeze([
      Object.freeze({ id: "font.application", name: "Application Fonts", sourceType: RESOURCE_SOURCE_TYPES.APPLICATION, path: "fonts", enabled: true, priority: 0, protected: true, removable: false, editable: false }),
      Object.freeze({ id: "font.managed", name: "Managed Fonts", sourceType: RESOURCE_SOURCE_TYPES.MANAGED, path: "Resources/Fonts", enabled: true, priority: 100, protected: true, removable: false, editable: false }),
      Object.freeze({ id: "font.notebook.default", name: "Notebook Fonts", sourceType: RESOURCE_SOURCE_TYPES.NOTEBOOK, path: "Resources/Fonts", enabled: true, priority: 200, protected: true, removable: false, editable: true, legacyPath: true }),
    ]),
  }),
  Object.freeze({
    id: RESOURCE_TYPE_IDS.DICTIONARY,
    displayName: "Dictionaries",
    description: "Dictionary layers for spelling, definitions, annotations, and overrides.",
    resolutionStrategy: RESOURCE_RESOLUTION_STRATEGIES.OVERLAY,
    legacyPathKey: "dictionaries",
    supportedExtensions: DICTIONARY_EXTENSIONS,
    defaultSources: Object.freeze([
      Object.freeze({ id: "dictionary.application", name: "Application Dictionaries", sourceType: RESOURCE_SOURCE_TYPES.APPLICATION, path: "Dictionaries", enabled: true, priority: 0, protected: true, removable: false, editable: false }),
      Object.freeze({ id: "dictionary.managed", name: "Managed Dictionaries", sourceType: RESOURCE_SOURCE_TYPES.MANAGED, path: "Resources/Dictionaries", enabled: true, priority: 100, protected: true, removable: false, editable: false }),
      Object.freeze({ id: "dictionary.notebook.default", name: "Notebook Dictionaries", sourceType: RESOURCE_SOURCE_TYPES.NOTEBOOK, path: "Resources/Dictionaries", enabled: true, priority: 200, protected: true, removable: false, editable: true, legacyPath: true }),
    ]),
  }),
  Object.freeze({
    id: RESOURCE_TYPE_IDS.FAA_SECTIONAL,
    displayName: "FAA Sectional Charts",
    description: "FAA sectional chart packages for aviation overlays.",
    resolutionStrategy: RESOURCE_RESOLUTION_STRATEGIES.COLLECTION,
    legacyPathKey: "aviation.sectionalMaps",
    supportedExtensions: FAA_SECTIONAL_EXTENSIONS,
    defaultSources: Object.freeze([
      Object.freeze({ id: "faa.sectional.managed", name: "Managed FAA Sectionals", sourceType: RESOURCE_SOURCE_TYPES.MANAGED, path: "Resources/Maps/FAASectionals", enabled: true, priority: 100, protected: true, removable: false, editable: false }),
      Object.freeze({ id: "faa.sectional.notebook.default", name: "Notebook FAA Sectionals", sourceType: RESOURCE_SOURCE_TYPES.NOTEBOOK, path: "Resources/Aviation/Sectionals", enabled: true, priority: 200, protected: true, removable: false, editable: true, legacyPath: true }),
    ]),
  }),
  Object.freeze({
    id: RESOURCE_TYPE_IDS.MATERIAL,
    displayName: "Materials",
    description: "World-object material definitions merged as non-destructive overlays.",
    resolutionStrategy: RESOURCE_RESOLUTION_STRATEGIES.OVERLAY,
    legacyPathKey: "materials",
    supportedExtensions: MATERIAL_EXTENSIONS,
    defaultSources: Object.freeze([
      Object.freeze({ id: "material.application", name: "Application Materials", sourceType: RESOURCE_SOURCE_TYPES.APPLICATION, path: "MetaWorld/Materials", enabled: true, priority: 0, protected: true, removable: false, editable: false }),
      Object.freeze({ id: "material.managed", name: "Managed Materials", sourceType: RESOURCE_SOURCE_TYPES.MANAGED, path: "Resources/Materials", enabled: true, priority: 100, protected: true, removable: false, editable: false }),
      Object.freeze({ id: "material.notebook.default", name: "Notebook Materials", sourceType: RESOURCE_SOURCE_TYPES.NOTEBOOK, path: "Resources/Materials", enabled: true, priority: 200, protected: true, removable: false, editable: true, legacyPath: true }),
    ]),
  }),
  Object.freeze({
    id: RESOURCE_TYPE_IDS.ELECTRONICS_COMPONENT,
    displayName: "Circuit Component Libraries",
    description: "Electronic component definitions, symbols, footprints, simulation models, datasheets, and package assets.",
    resolutionStrategy: RESOURCE_RESOLUTION_STRATEGIES.COLLECTION,
    legacyPathKey: "electronics.components",
    supportedExtensions: ELECTRONICS_COMPONENT_EXTENSIONS,
    defaultSources: Object.freeze([
      Object.freeze({ id: "electronics.component.application", name: "Application Circuit Components", sourceType: RESOURCE_SOURCE_TYPES.APPLICATION, path: "Electronics/Components", enabled: true, priority: 0, protected: true, removable: false, editable: false }),
      Object.freeze({ id: "electronics.component.managed", name: "Managed Circuit Components", sourceType: RESOURCE_SOURCE_TYPES.MANAGED, path: "Resources/Electronics/Components", enabled: true, priority: 100, protected: true, removable: false, editable: false }),
      Object.freeze({ id: "electronics.component.notebook.library", name: "Notebook Circuit Library", sourceType: RESOURCE_SOURCE_TYPES.NOTEBOOK, path: "Library/Electronics/Components", enabled: true, priority: 200, protected: true, removable: false, editable: true, legacyPath: true }),
      Object.freeze({ id: "electronics.component.notebook.personal", name: "Personal Notebook Components", sourceType: RESOURCE_SOURCE_TYPES.NOTEBOOK, path: "PersonalNotebook/Electronics/Components", enabled: true, priority: 300, protected: true, removable: false, editable: true }),
    ]),
  }),
]);

const RESOURCE_TYPE_BY_ID = new Map(RESOURCE_TYPES.map((type) => [type.id, type]));

export function getResourceTypeDefinition(typeId) {
  const normalized = normalizeResourceTypeId(typeId);
  const definition = RESOURCE_TYPE_BY_ID.get(normalized);
  if (!definition) throw new Error(`Unknown resource type: ${normalized}`);
  return definition;
}

export function getResourceTypeDefinitions() {
  return RESOURCE_TYPES.map((type) => ({
    ...type,
    supportedExtensions: [...type.supportedExtensions],
    defaultSources: type.defaultSources.map((source) => ({ ...source })),
  }));
}

export function normalizeResourceTypeId(value) {
  const id = String(value || "").trim().toLowerCase();
  if (!/^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)*$/.test(id)) {
    throw new Error("Resource type IDs must use dot-separated lowercase segments.");
  }
  return id;
}

export function isKnownResourceType(typeId) {
  try {
    return RESOURCE_TYPE_BY_ID.has(normalizeResourceTypeId(typeId));
  } catch {
    return false;
  }
}

export function normalizeResourceSourceType(value) {
  const type = String(value || "").trim().toLowerCase();
  if (!Object.values(RESOURCE_SOURCE_TYPES).includes(type)) {
    throw new Error("Resource source type must be application, managed, or notebook.");
  }
  return type;
}

export function normalizeResolutionStrategy(value, fallback = RESOURCE_RESOLUTION_STRATEGIES.COLLECTION) {
  const strategy = String(value || fallback || "").trim().toLowerCase();
  if (!Object.values(RESOURCE_RESOLUTION_STRATEGIES).includes(strategy)) {
    throw new Error("Resource resolution strategy must be collection or overlay.");
  }
  return strategy;
}

export function getLegacyPathTypeId(legacyPathKey) {
  const key = String(legacyPathKey || "").trim();
  return RESOURCE_TYPES.find((type) => type.legacyPathKey === key)?.id || "";
}
