// Nodevision/ApplicationSystem/public/RasterAnalysis/GrayscaleLayerControls.mjs
// This view adds live threshold controls and explicit mask dependencies to the existing image analysis results panel. Stable control nodes preserve slider focus while measurements update asynchronously.
export function mountAnalysisLayerControls(container, analysis, store, add) {
  const root = document.createElement('section'); root.dataset.grayscaleAnalysis = '';
  const heading = document.createElement('h3'); heading.textContent = 'Analysis layers';
  const addButton = document.createElement('button'); addButton.type = 'button'; addButton.textContent = 'Add grayscale layer'; addButton.onclick = add;
  root.style.cssText = 'min-width:0;font-size:13px'; heading.style.fontSize = '16px';
  const list = document.createElement('div'); root.append(heading, addButton, list); container.append(root);
  let signature = '', rows = new Map();
  function element(tag, text, parent) { const node = document.createElement(tag); if (text) node.textContent = text; parent?.append(node); return node; }
  function button(parent, text, action) { const node = element('button', text, parent); node.type = 'button'; node.onclick = action; return node; }
  function icon(parent, title, file, action, rotation = 0) {
    const node = button(parent, '', action); node.title = title; node.setAttribute('aria-label', title);
    node.style.cssText = 'width:28px;height:28px;padding:4px;flex:none';
    const img = element('img', '', node); img.src = `/icons/${file}.png`; img.alt = ''; img.style.cssText = `width:18px;height:18px;transform:rotate(${rotation}deg)`;
  }
  function checkbox(parent, text, checked, change) {
    const label = element('label', '', parent), input = element('input', '', label); input.type = 'checkbox'; input.checked = checked;
    label.append(document.createTextNode(text)); input.onchange = () => change(input.checked); return input;
  }
  function build(layer) {
    const row = element('fieldset', '', list); row.dataset.analysisLayerId = layer.id; row.style.cssText = 'margin:10px 0;min-width:0;padding:8px';
    element('legend', layer.name, row);
    const actions = element('div', '', row); actions.style.cssText = 'display:flex;gap:6px;align-items:center;flex-wrap:wrap';
    const enabled = checkbox(actions, 'Enabled', layer.enabled, value => store.update(layer.id, { enabled: value }));
    const visible = checkbox(actions, 'Visible', layer.visible, value => store.update(layer.id, { visible: value }));
    icon(actions, 'Move layer down', 'PositionArrowIcon', () => store.move(layer.id, -1), 90);
    icon(actions, 'Move layer up', 'PositionArrowIcon', () => store.move(layer.id, 1), -90);
    icon(actions, 'Remove layer', 'TrashIcon', () => store.remove(layer.id));
    const controls = {};
    if (layer.type === 'grayscale') {
      for (const [key, title] of [['lower', 'Lower Threshold (%)'], ['upper', 'Upper Threshold (%)']]) {
        const label = element('label', title, row); label.style.display = 'block';
        const range = element('input', '', label), number = element('input', '', label);
        range.type = 'range'; number.type = 'number';
        label.style.cssText = 'display:grid;grid-template-columns:minmax(0,1fr) 78px;gap:6px;margin-top:8px';
        const caption = element('span', title); label.firstChild.remove(); label.prepend(caption); caption.style.gridColumn = '1 / -1';
        range.style.cssText = 'min-width:0;width:100%'; number.style.cssText = 'min-width:0;width:100%;box-sizing:border-box';
        for (const input of [range, number]) {
          input.min = '0'; input.max = '100'; input.step = 'any'; input.value = layer.config[key];
          input.setAttribute('aria-label', title); input.dataset.threshold = key;
          input.oninput = () => {
            if (input.value === '' || !Number.isFinite(input.valueAsNumber)) return;
            const value = Math.max(0, Math.min(100, input.valueAsNumber));
            const next = key === 'lower' ? Math.min(value, layer.config.upper) : Math.max(value, layer.config.lower);
            store.update(layer.id, { config: { [key]: next } });
          };
          input.onchange = () => { input.value = layer.config[key]; };
        }
        controls[key] = [range, number];
      }
    }
    if (layer.type === 'intersection') {
      const options = element('div', '', row); options.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;margin:8px 0';
      element('span', 'AND inputs:', options);
      const candidates = store.layers.filter(item => item.id !== layer.id && item.type !== 'intersection');
      for (const id of layer.config.inputs) if (!store.layers.some(item => item.id === id)) candidates.push({ id, name: `Missing layer (${id.slice(0, 8)})` });
      for (const candidate of candidates) {
        checkbox(options, candidate.name, layer.config.inputs.includes(candidate.id), checked => {
          const inputs = checked ? [...layer.config.inputs, candidate.id] : layer.config.inputs.filter(id => id !== candidate.id);
          store.update(layer.id, { config: { inputs } });
        });
      }
    }
    if (layer.type !== 'region') {
      const label = element('label', 'Visualization ', row), mode = element('select', '', label);
      label.style.cssText = 'display:block;margin:8px 0'; mode.style.maxWidth = '100%';
      for (const [value, text] of [['highlight','Highlight Selection'], ['binary','Binary Mask'], ['isolate','Isolate Selection']]) {
        const option = element('option', text, mode); option.value = value;
      }
      mode.value = layer.config.mode; mode.onchange = () => store.update(layer.id, { config: { mode: mode.value } });
      const colorLabel = element('label', ' Overlay color ', row), color = element('input', '', colorLabel); color.type = 'color'; color.value = layer.config.color;
      color.oninput = () => store.update(layer.id, { config: { color: color.value } });
      const opacityLabel = element('label', ' Opacity ', row), opacity = element('input', '', opacityLabel); opacity.type = 'range'; opacity.min = '0'; opacity.max = '1'; opacity.step = '.01'; opacity.value = layer.config.opacity;
      opacity.oninput = () => store.update(layer.id, { config: { opacity: opacity.valueAsNumber } });
    }
    const output = element('p', '', row); output.setAttribute('aria-live', 'polite'); output.dataset.layerMeasurement = '';
    output.style.overflowWrap = 'anywhere';
    rows.set(layer.id, { enabled, visible, controls, output });
  }
  function render() {
    const next = store.layers.map(layer => `${layer.id}:${layer.order}`).join('|');
    if (next !== signature) { signature = next; rows = new Map(); list.replaceChildren(); store.layers.forEach(build); }
    for (const layer of store.layers) {
      const row = rows.get(layer.id); if (!row) continue;
      row.enabled.checked = layer.enabled; row.visible.checked = layer.visible;
      for (const [key, inputs] of Object.entries(row.controls)) for (const input of inputs) input.value = layer.config[key];
      const result = analysis.layerResults.find(item => item.id === layer.id);
      if (!layer.enabled) row.output.textContent = 'Disabled';
      else if (!result || result.count === null) row.output.textContent = 'Output unavailable';
      else if (layer.type === 'region') row.output.textContent = `Region: ${result.count} pixels (including transparent pixels).`;
      else if (layer.type === 'intersection' && result.regionCount !== null) row.output.textContent = `Selected Grayscale Area: ${result.regionPercentage === null ? 'N/A' : result.regionPercentage.toFixed(2) + '%'} of Region. ${result.count} matching / ${result.regionCount} region pixels.`;
      else row.output.textContent = `${result.eligible} eligible image pixels; ${result.count} selected (${result.percentage === null ? 'N/A' : result.percentage.toFixed(2) + '%'} of eligible image).`;
    }
  }
  analysis.renderLayers = render; const unsubscribe = store.subscribe(render); render();
  return () => { unsubscribe(); if (analysis.renderLayers === render) analysis.renderLayers = null; root.remove(); };
}
