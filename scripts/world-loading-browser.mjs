// Nodevision/scripts/world-loading-browser.mjs
// Exercises the actual viewer loader, geographic runtime, HTML serializer, HTTP save endpoint, and reopening with a large terrain cache, without mocking world transport.
import * as THREE from '/lib/three/three.module.js';
import { createHtmlSourceDocument } from '/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditorComponents/HtmlSourceDocument.mjs';
import { detectWorldKind, loadWorldFromFile } from '/PanelInstances/ViewPanels/GameViewDependencies/worldLoading.mjs';
import { saveCurrentWorldFile } from '/PanelInstances/ViewPanels/GameViewDependencies/worldSave.mjs';
import { rasterData } from '/MetaWorld/Geographic/Snapshot.mjs';
const check = (value, message) => { if (!value) throw Error(message); };
try {
  window.NodevisionState = { currentMode: 'Virtual World Editing' };
  window.alert = message => { throw Error(message); };
  const html = await (await fetch('/Notebook/world.html')).text();
  const raw = html.match(/<script\b[^>]*id="nodevision-metaworld"[^>]*>([\s\S]*?)<\/script>/i)[1];
  const scriptText = source => new DOMParser().parseFromString(source, 'text/html').getElementById('nodevision-metaworld').textContent;
  check(scriptText(html) === raw, 'Browser HTML parser preserves script characters');
  const head = document.createElement('div'), body = document.createElement('div'), hidden = document.createElement('div');
  const projection = createHtmlSourceDocument({ head, body, hidden }); projection.load(html);
  check(scriptText(projection.serialize(body.cloneNode(true))) === raw, 'HTML editor source projection preserves script characters');
  check((await detectWorldKind('world.html')).kind !== 'unknown', 'Actual viewer document detection succeeds');
  const original = await (await fetch('/test/original')).json();
  const expected = original.objects.find(o => o.type === 'procedural-voxel-world');
  const panel = document.getElementById('editor'), scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera();
  const state = { currentWorldPath: 'world.html' }, movementState = { playerMode: 'creative', playerHeight: 1.75 };
  const context = window.VRWorldContext = { THREE, scene, camera, panel, state, movementState,
    objects: [], colliders: [], lights: [], portals: [], collisionActions: [], useTargets: [], spawnPoints: [],
    waterVolumes: [], measurementVisuals: [], controls: { getObject: () => camera } };
  const verify = async () => {
    const root = context.objects.find(o => o.userData.proceduralVoxelRuntime);
    check(root, 'Viewer created the geographic runtime');
    const runtime = root.userData.proceduralVoxelRuntime; await runtime.ready;
    check(runtime.definition.terrainSource === 'geographic', 'Geographic source retained');
    check(JSON.stringify(runtime.definition.geographic) === JSON.stringify(expected.geographic), 'Full geographic recipe unchanged');
    const samples = rasterData(runtime.definition.geographic.elevation), wanted = rasterData(expected.geographic.elevation);
    check(samples.length === 64960, 'All 64,960 samples decoded');
    check(samples.every((value, i) => Object.is(value, wanted[i])), 'Every decoded elevation preserved');
    for (const object of original.objects) check(state.currentWorldDefinition.objects.some(o => o.id === object.id), 'Object preserved: ' + object.id);
  };
  await loadWorldFromFile('world.html', state, THREE, { throwOnError: true }); await verify();
  check((await (await fetch('/test/trace')).json())[0]?.identicalToOriginal, 'Actual server parser received original script');
  check(await saveCurrentWorldFile({ state, movementState, objects: context.objects, lights: context.lights }), 'Production save succeeded');
  await loadWorldFromFile('world.html', state, THREE, { throwOnError: true }); await verify();
  document.getElementById('result').textContent = 'PASS: actual viewer HTTP loading, exact JSON input, 64,960 elevations, full source metadata, objects, save/reopen';
} catch (error) { document.getElementById('result').textContent = 'FAIL: ' + error.stack; }
