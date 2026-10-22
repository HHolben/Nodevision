// Nodevision/ApplicationSystem/AssetDownloads/ProviderDirectory.mjs
// Records proposed sources separately from executable adapters, so planned support is never advertised as working.
export const PROVIDER_FEATURES = Object.freeze(['search', 'preview', 'download', 'licensing', 'attribution', 'formatSelection']);
const rows = [
  ['polyhaven', 'Poly Haven', 'https://polyhaven.com', ['models', 'textures', 'hdri']],
  ['openverse', 'Openverse', 'https://openverse.org', ['images', 'illustrations', 'audio']],
  ['iconify', 'Iconify', 'https://iconify.design', ['svg', 'icons']],
  ['wikimedia', 'Wikimedia Commons', 'https://commons.wikimedia.org', ['images', 'diagrams', 'maps', 'audio']],
  ['ambientcg', 'ambientCG', 'https://ambientcg.com', ['textures', 'materials', 'hdri']],
  ['kenney', 'Kenney', 'https://kenney.nl/assets', ['sprites', 'models', 'game-assets']],
  ['smithsonian3d', 'Smithsonian 3D', 'https://3d.si.edu', ['models', 'scans']],
  ['sketchfab', 'Sketchfab', 'https://sketchfab.com', ['models', 'scans']],
  ['nounproject', 'The Noun Project', 'https://thenounproject.com', ['svg', 'icons', 'images']],
  ['freesound', 'Freesound', 'https://freesound.org', ['audio']],
  ['googlefonts', 'Google Fonts', 'https://fonts.google.com', ['fonts']],
  ['quaternius', 'Quaternius', 'https://quaternius.com', ['models', 'game-assets']],
  ['svgrepo', 'SVG Repo', 'https://www.svgrepo.com', ['svg', 'icons', 'illustrations']],
  ['nasa', 'NASA Image Library', 'https://images.nasa.gov', ['images', 'video', 'audio']],
  ['opengameart', 'OpenGameArt', 'https://opengameart.org', ['sprites', 'textures', 'models', 'audio']],
  ['blendswap', 'Blend Swap', 'https://www.blendswap.com', ['blender-models']],
  ['cgtrader', 'CGTrader', 'https://www.cgtrader.com', ['models', 'cad']],
  ['printables', 'Printables', 'https://www.printables.com', ['stl', '3mf', 'cad']],
  ['thingiverse', 'Thingiverse', 'https://www.thingiverse.com', ['stl', '3mf', 'cad']],
  ['gutenberg', 'Project Gutenberg', 'https://www.gutenberg.org', ['books', 'text', 'html']],
  ['internetarchive', 'Internet Archive', 'https://archive.org', ['books', 'images', 'video', 'audio']],
  ['metmuseum', 'The Met Open Access', 'https://www.metmuseum.org', ['images', 'artwork']],
];
export const providerDirectory = Object.freeze(rows.map(([id, name, website, assetTypes], index) => Object.freeze({
  id, name, website, assetTypes: Object.freeze(assetTypes), proposed: index < 21,
  plannedFeatures: PROVIDER_FEATURES,
  integrationNote: 'Adapter not implemented. Review documented access, authentication, licensing and compatible formats before enabling.',
})));
export function describeProvider(entry, adapter = null) {
  const configured = adapter?.authentication?.configured !== false;
  const active = !!adapter && configured;
  const support = Object.fromEntries(PROVIDER_FEATURES.map(feature => [feature, false]));
  if (active) Object.assign(support, {
    search: typeof adapter.search === 'function', preview: !!adapter.capabilities?.previews,
    download: adapter.capabilities?.download === true, licensing: adapter.capabilities?.metadata === true,
    attribution: adapter.capabilities?.metadata === true, formatSelection: (adapter.formats?.length || 0) > 0,
  });
  return { ...entry, status: adapter && !configured ? 'needs-configuration' : active ? 'available' : 'planned', support,
    formats: active ? [...adapter.formats] : [],
    authentication: adapter?.authentication?.label || (active ? 'No credentials required by this adapter' : 'Not configured; provider access review pending'),
    integrationNote: active ? `Enabled formats: ${adapter.formats.join(', ')}. Other asset types are not enabled by this adapter.` : adapter && !configured ? 'Adapter installed; server-side credentials/configuration are required before use.' : entry.integrationNote,
  };
}
