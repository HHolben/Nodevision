// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/GameViewDependencies/worldRenderDistance.mjs
// This module owns the pause-menu terrain distance slider and applies its session-local setting to shared procedural world runtimes.
export function installRenderDistanceControl(menu, objects) {
  const row = document.createElement('label');
  row.className = 'nv-world-render-distance';
  Object.assign(row.style, { display: 'block', margin: '16px 0' });
  const title = document.createElement('span');
  title.textContent = 'Render distance: ';
  const value = document.createElement('output');
  const input = document.createElement('input');
  input.type = 'range'; input.min = '8'; input.max = '64'; input.step = '8';
  input.setAttribute('aria-label', 'Render distance');
  Object.assign(input.style, { display: 'block', width: '100%', marginTop: '8px' });
  const hint = document.createElement('small');
  hint.textContent = 'Terrain distance. Higher settings load more of the world.';
  row.append(title, value, input, hint);
  menu.append(row);
  const runtimes = () => objects.map(object => object?.userData?.proceduralVoxelRuntime)
    .filter(runtime => typeof runtime?.setRenderDistance === 'function');
  const display = () => {
    value.textContent = `${input.value} m`;
    input.setAttribute('aria-valuetext', `${input.value} metres`);
  };
  const refresh = () => {
    const worlds = runtimes();
    input.disabled = !worlds.length;
    input.value = String(worlds[0]?.renderDistance ?? 64);
    display();
    hint.textContent = worlds.length
      ? 'Terrain distance. Higher settings load more of the world.'
      : 'This world has no streamed terrain.';
  };
  const change = event => {
    event.stopPropagation();
    display();
    for (const runtime of runtimes()) runtime.setRenderDistance(Number(input.value));
  };
  input.addEventListener('input', change);
  refresh();
  return { input, refresh, dispose() { input.removeEventListener('input', change); row.remove(); } };
}
