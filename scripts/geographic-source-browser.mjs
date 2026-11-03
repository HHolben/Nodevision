// Nodevision/scripts/geographic-source-browser.mjs
// This regression follows recognizable GeoTIFF elevations through native creation, streamed rendering, the Y inspector, history, and HTML save/reopen using isolated persistence.
import * as THREE from '/lib/three/three.module.js';
import { loadWorldFromFile } from '/PanelInstances/ViewPanels/GameViewDependencies/worldLoading.mjs';
import { saveCurrentWorldFile } from '/PanelInstances/ViewPanels/GameViewDependencies/worldSave.mjs';
import { createObjectInspector } from '/PanelInstances/ViewPanels/GameViewDependencies/objectInspector.mjs';
import { getActiveMetaWorldLayerBridge } from '/MetaWorld/MetaWorldLayerState.mjs';
import { openVoxelWorldDialog } from '/MetaWorld/ProceduralVoxelWorld/VoxelWorldDialog.mjs';
import { recognizableElevation } from '/MetaWorld/Geographic/Fixtures.mjs';
import { voxelWorldForm, definitionFromVoxelForm } from '/MetaWorld/ProceduralVoxelWorld/VoxelAuthoringDefinition.mjs';
import { createVoxelGenerator } from '/MetaWorld/ProceduralVoxelWorld/VoxelTerrainGenerator.mjs';

let checks = 0;
const ok = (value, message) => { if (!value) throw Error(message); checks++; };
const wait = async predicate => {
  const until = performance.now() + 20000;
  while (!predicate()) {
    if (performance.now() > until) throw Error('Timeout: ' + document.querySelector('[data-geographic-preview]')?.textContent);
    await new Promise(resolve => setTimeout(resolve, 20));
  }
};
try {
  window.NodevisionState = { currentMode: 'Virtual World Editing' };
  const warnings = [];
  window.confirm = message => { warnings.push(message); return true; };
  const panel = document.getElementById('editor'), scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, 4 / 3, .1, 1000);
  const state = { currentWorldPath: 'page.html' }, movementState = { playerMode: 'creative', playerHeight: 1.75 };
  const context = window.VRWorldContext = {
    THREE, scene, camera, panel, state, movementState, objects: [], colliders: [], lights: [], portals: [],
    collisionActions: [], useTargets: [], spawnPoints: [], waterVolumes: [], measurementVisuals: [], controls: { getObject: () => camera },
  };
  let definition = { worldType: 'NodevisionMetaWorld', type: 'world', objects: [
    { id: 'keep-object', type: 'box', position: [0, 70, 0], size: [1, 1, 1] },
  ] }, saved = '';
  const nativeFetch = window.fetch;
  window.fetch = async (url, options) => {
    if (url === '/api/load-world') return Response.json({ worldDefinition: structuredClone(definition) });
    if (url === '/Notebook/page.html') return new Response('<html><body><p>Keep HTML</p></body></html>');
    if (url === '/api/save') { saved = JSON.parse(options.body).content; return Response.json({ success: true }); }
    return nativeFetch(url, options);
  };
  await loadWorldFromFile('page.html', state, THREE);
  let bridge = getActiveMetaWorldLayerBridge();
  const form = () => document.querySelector('[data-voxel-world-dialog]');
  const button = label => [...form().querySelectorAll('button')].find(b => b.textContent === label);
  const set = (name, value) => { form().elements[name].value = value; form().elements[name].dispatchEvent(new Event('input')); };
  const chooseGeographic = () => { set('terrainSource', 'geographic'); form().elements.terrainSource.dispatchEvent(new Event('change')); };
  const preview = () => form().querySelector('[data-geographic-preview]').textContent;
  openVoxelWorldDialog(bridge); chooseGeographic(); set('geo_elevation', '/Notebook/features.tif');
  button('Import / Preview').click(); await wait(() => preview().includes('Choose crop bounds'));
  ok(!context.objects.some(o => o.userData.proceduralVoxelRuntime), 'no guessed center crop or procedural fallback');
  button('Fit to source').click(); await wait(() => preview().includes('Crop updated'));
  set('geo_horizontalScale', '.25'); set('geo_verticalExaggeration', '.5'); set('geo_verticalOffset', '-39');
  form().elements.vegetation.checked = false;
  button('Import / Preview').click(); await wait(() => preview().startsWith('Ready.'));
  button('Generate').click(); ok(!form(), 'geographic creation accepted');
  let root = context.objects.find(o => o.userData.proceduralVoxelRuntime), runtime = root.userData.proceduralVoxelRuntime;
  ok(await runtime.ready, 'runtime material initialization');
  const geographic = runtime.definition.geographic;
  ok(runtime.definition.terrainSource === 'geographic', 'source mode stored in definition');
  const sampleCells = [[3, 3], [11, 3], [4, 12], [11, 12]].map(([px, pz]) => {
    const e = geographic.elevation;
    const x = Math.floor((e.origin[0] + (px + .5) * 10 - geographic.origin[0]) * geographic.horizontalScale / .25);
    const z = Math.floor((geographic.origin[1] - (e.origin[1] - (pz + .5) * 10)) * geographic.horizontalScale / .25);
    // Independently compute bilinear values at the actual voxel centers.
    const sx = (geographic.origin[0] + (x + .5) * .25 / geographic.horizontalScale - e.origin[0]) / 10 - .5;
    const sz = (e.origin[1] - geographic.origin[1] + (z + .5) * .25 / geographic.horizontalScale) / 10 - .5;
    const ix = Math.floor(sx), iz = Math.floor(sz), dx = sx - ix, dz = sz - iz;
    const elevation = recognizableElevation(ix, iz) * (1 - dx) * (1 - dz)
      + recognizableElevation(ix + 1, iz) * dx * (1 - dz)
      + recognizableElevation(ix, iz + 1) * (1 - dx) * dz + recognizableElevation(ix + 1, iz + 1) * dx * dz;
    const expected = Math.floor((elevation * .5 - 39) / .25 + 1e-9);
    ok(runtime.generator.getTerrainHeight(x, z) === expected, `DEM elevation at feature ${px},${pz}: actual ${runtime.generator.getTerrainHeight(x,z)}, expected ${expected}; xz ${x},${z}, scales ${geographic.horizontalScale},${geographic.verticalExaggeration},${geographic.verticalOffset}`);
    return [x, z, expected];
  });
  const changedSeed = createVoxelGenerator({ ...runtime.serialize(), generator: { ...runtime.definition.generator, seed: 123456 } });
  for (const [x, z, height] of sampleCells) ok(changedSeed.getTerrainHeight(x, z) === height, 'seed cannot replace DEM elevations');
  changedSeed.features.clear(); changedSeed.clearColumns();
  for (const x of [31, 32, 63, 64]) {
    const z = 12, h = runtime.generator.getTerrainHeight(x, z);
    const chunk = runtime.generator.generateChunk(Math.floor(x / 32), Math.floor((h - 1) / 32), 0);
    ok(chunk[x % 32 + z * 32 + ((h - 1) % 32) * 1024] !== 0, 'chunk boundaries retain raster ground');
  }
  const inspector = createObjectInspector({ THREE, panel, scene, sceneObjects: context.objects, colliders: context.colliders, portals: context.portals, spawnPoints: context.spawnPoints });
  inspector.inspectTarget(root);
  ok(document.querySelector('[data-voxel-world-properties]').textContent.includes('Source: Geographic DEM.') && document.querySelector('[data-voxel-world-properties]').textContent.includes('/Notebook/features.tif'), 'Y inspector reports DEM reference');
  const renderer = new THREE.WebGLRenderer(); renderer.setSize(400, 300); panel.append(renderer.domElement);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x888888, 2));
  for (const [x, z, height] of sampleCells) {
    const point = new THREE.Vector3(root.position.x + (x + .5) * .25, 100, root.position.z + (z + .5) * .25);
    let hit;
    await wait(() => {
      runtime.update(new THREE.Vector3(point.x, height * .25 + 2, point.z));
      scene.updateMatrixWorld(true);
      hit = new THREE.Raycaster(point, new THREE.Vector3(0, -1, 0)).intersectObject(root, true)[0];
      return hit;
    });
    ok(Math.abs(hit.point.y - (root.position.y + height * .25)) < .001, 'rendered voxel mesh height equals the DEM-derived height');
  }
  camera.position.set(0, 70, 65); camera.lookAt(0, 10, 0); renderer.render(scene, camera);
  ok(renderer.info.render.triangles > 0, 'actual terrain triangles rendered');
  await runtime.setRepresentation('polygonal');
  ok(runtime.representation === 'polygonal', 'polygonal representation available');
  for (const [x, z, height] of sampleCells) ok(runtime.generator.getTerrainHeight(x, z) === height, 'polygonal representation uses identical elevation field');
  await runtime.setRepresentation('voxel');
  bridge.setEducationalLinks(root.userData.metaWorldLayerId, [{ document: 'page.html', recordId: 'stable-element' }]);
  openVoxelWorldDialog(bridge, root.userData.metaWorldLayerId); set('seed', 'different decoration seed'); button('Regenerate').click();
  ok(warnings.some(text => text.includes('Undo')), 'regeneration warns and retains recoverable history');
  ok(bridge.undo() && bridge.redo(), 'terrain regeneration undo/redo');
  await saveCurrentWorldFile({ state, movementState, objects: context.objects, lights: [] });
  definition = JSON.parse(new DOMParser().parseFromString(saved, 'text/html').querySelector('script').textContent);
  ok(saved.includes('Keep HTML'), 'world save preserves authored document');
  inspector.dispose(); await nativeFetch('/test/offline');
  await loadWorldFromFile('page.html', state, THREE); bridge = getActiveMetaWorldLayerBridge();
  root = context.objects.find(o => o.userData.proceduralVoxelRuntime); runtime = root.userData.proceduralVoxelRuntime;
  await runtime.geographicStatus.ready;
  ok(runtime.geographicStatus.message.includes('unavailable') && runtime.geographicStatus.message.includes('not substituted'), 'missing source diagnostic retains saved geographic terrain');
  ok(runtime.definition.terrainSource === 'geographic' && runtime.definition.geographic.elevation.asset.path === '/Notebook/features.tif', 'source reference survives save/reopen');
  for (const [x, z, height] of sampleCells) ok(runtime.generator.getTerrainHeight(x, z) === height, 'reopened cached geographic heights unchanged');
  ok(bridge.getEducationalLinks(root.userData.metaWorldLayerId)[0].recordId === 'stable-element', 'semantic identity survives regeneration and reopening');
  ok(context.objects.some(o => o.userData.metaWorldLayerId === 'keep-object'), 'authored object retained');
  await nativeFetch('/test/online');
  bridge.removeObjectLayer(root.userData.metaWorldLayerId);
  const procedural = definitionFromVoxelForm({ ...voxelWorldForm(), sizeX: 16, sizeZ: 16, seed: '42', vegetation: false });
  bridge.addVoxelWorld(procedural);
  await saveCurrentWorldFile({ state, movementState, objects: context.objects, lights: [] });
  definition = JSON.parse(new DOMParser().parseFromString(saved, 'text/html').querySelector('script').textContent);
  await loadWorldFromFile('page.html', state, THREE); bridge = getActiveMetaWorldLayerBridge();
  root = context.objects.find(o => o.userData.proceduralVoxelRuntime);
  ok(root.userData.proceduralVoxelRuntime.definition.terrainSource === 'procedural', 'procedural source survives save/reopen');
  bridge.removeObjectLayer(root.userData.metaWorldLayerId);
  // Exercise the supplied raw DEM through the same worker and native generation dialog.
  let pelion = 'fixture unavailable';
  if ((await nativeFetch('/Notebook/pelion-raw.tiff')).ok) {
    openVoxelWorldDialog(bridge); chooseGeographic(); set('geo_elevation', '/Notebook/pelion-rgb.tiff');
    button('Import / Preview').click(); await wait(() => preview().includes('RGB/topographic'));
    set('geo_elevation', '/Notebook/pelion-raw.tiff'); set('geo_crop', '23.040,39.392,23.042,39.394');
    set('geo_verticalExaggeration', '.2'); form().elements.vegetation.checked = false;
    button('Import / Preview').click(); await wait(() => preview().startsWith('Ready.'));
    button('Generate').click(); ok(!form(), 'raw Mount Pelion DEM creates native terrain');
    runtime = context.objects.find(o => o.userData.proceduralVoxelRuntime).userData.proceduralVoxelRuntime;
    ok(runtime.definition.geographic.elevation.asset.path.endsWith('pelion-raw.tiff'), 'raw source reference retained');
    const heights = [40, 100, 200, 400].map(x => runtime.generator.getTerrainHeight(x, 100));
    ok(new Set(heights).size > 1, 'raw DEM produces varying terrain heights');
    pelion = JSON.stringify({ crop: runtime.definition.geographic.crop, heights, access: runtime.definition.geographic.access });
  }
  renderer.dispose(); for (const object of context.objects) object.userData.proceduralVoxelRuntime?.dispose();
  document.getElementById('result').textContent = `PASS: ${checks} geographic source checks; raw Pelion: ${pelion}`;
} catch (error) { document.getElementById('result').textContent = 'FAIL: ' + error.stack; }
