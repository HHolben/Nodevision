// Nodevision/scripts/downloaded-assets-world-browser.mjs
// Verifies downloaded world images use existing layer history, save definitions and authoring guards.
import * as THREE from '/lib/three/three.module.js';
import { loadWorldFromFile } from '/PanelInstances/ViewPanels/GameViewDependencies/worldLoading.mjs';
import { saveCurrentWorldFile } from '/PanelInstances/ViewPanels/GameViewDependencies/worldSave.mjs';
import { getActiveMetaWorldLayerBridge } from '/MetaWorld/MetaWorldLayerState.mjs';
import { acquireWorldViewPermissions } from '/MetaWorld/WorldAuthoringPermissions.mjs';
let count = 0; const check = (condition, message) => { if (!condition) throw Error(message); count++; };
try {
  window.alert = message => { throw new Error(message); };
  window.NodevisionState = { currentMode: 'Virtual World Editing' };
  const panel = document.getElementById('editor'), scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera();
  const state = { currentWorldPath: 'assets.html' }, movementState = { playerMode: 'creative', environment: {} };
  const context = window.VRWorldContext = { THREE, scene, camera, panel, state, movementState, objects: [], colliders: [], lights: [], portals: [], collisionActions: [], useTargets: [], spawnPoints: [], waterVolumes: [], measurementVisuals: [], controls: { getObject: () => camera, unlock() {} } };
  let definition = { name: 'Download fixture', worldType: 'NodevisionMetaWorld', type: 'world', objects: [{ id: 'keep', type: 'box', position: [5, 2, 0], size: [1, 1, 1], color: '#123456' }] }, saved = '';
  const originalFetch = fetch;
  window.fetch = async (url, options) => {
    if (url === '/api/load-world') return { ok: true, json: async () => ({ worldDefinition: structuredClone(definition) }) };
    if (url === '/Notebook/assets.html') return { ok: true, text: async () => '<html><body>Preserve document</body></html>' };
    if (url === '/api/save') { saved = JSON.parse(options.body).content; return { ok: true, json: async () => ({ success: true }) }; }
    return originalFetch(url, options);
  };
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 2; canvas.getContext('2d').fillRect(0, 0, 2, 2);
  const originalLoad = THREE.TextureLoader.prototype.load;
  THREE.TextureLoader.prototype.load = function (_url, onLoad) { const texture = new THREE.CanvasTexture(canvas); queueMicrotask(() => onLoad(texture)); return texture; };
  await loadWorldFromFile('assets.html', state, THREE);
  const bridge = getActiveMetaWorldLayerBridge(); const before = JSON.stringify(bridge.worldData.objects);
  const input = { imageFile: 'Notebook/Project/assets/rock.png', name: 'Rock', position: [0, 1, -2], assetProvenance: { title: 'Rock', creator: 'Artist', license: 'CC0-1.0', credit: 'Rock by Artist — CC0' } };
  const inserted = await bridge.insertDownloadedImage(input);
  const image = () => context.objects.find(object => object.userData.nvType === 'image-plane');
  check(inserted.type === 'image-plane' && image()?.material.map, 'Image uses world image-plane texture loader');
  check(bridge.worldData.objects[0].id === 'keep', 'Existing world definition preserved');
  check(bridge.undo() && !image() && JSON.stringify(bridge.worldData.objects) === before, 'Native undo removes world image and preserves original definitions');
  check(bridge.redo() && image(), 'Native redo restores world image');
  await saveCurrentWorldFile({ state, movementState, objects: context.objects, lights: [] }); check(saved.includes('Rock by Artist') && saved.includes('Project/assets/rock.png') && saved.includes('Preserve document'), 'World save preserves embedded asset provenance, resource reference and document content');
  const release = acquireWorldViewPermissions({ authoring: false });
  check(await bridge.insertDownloadedImage(input) === false, 'Read-only world view rejects image insertion'); release();
  let rejected = false; try { await bridge.insertDownloadedImage({ ...input, validate: () => false }); } catch { rejected = true; }
  check(rejected && bridge.worldData.objects.filter(item => item.type === 'image-plane').length === 1, 'Changed origin rejects async placement without mutation');
  THREE.TextureLoader.prototype.load = originalLoad;
  document.getElementById('result').textContent = `PASS: ${count} world asset integration checks`;
} catch (error) { document.getElementById('result').textContent = `FAIL: ${error.stack}`; }
