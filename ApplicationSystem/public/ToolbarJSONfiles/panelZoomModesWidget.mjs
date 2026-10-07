// Nodevision/ApplicationSystem/public/ToolbarJSONfiles/panelZoomModesWidget.mjs
// This module exposes supported panel zoom modes and discrete semantic levels in the existing toolbar. Mode selection and gestures share the capability owner's state, while level controls reflect the adapter's authoritative presentation state.
import { getPanelZoomCapabilities, executePanelZoom, getPanelZoomState, getPanelZoomMetadata, getPanelZoomMode, setPanelZoomMode } from '../panels/panelZoomCapabilities.mjs';
export function appendPanelZoomModeControls(host, getPanel) {
  host.setAttribute('data-nv-zoom-toolbar', 'true');
  const row = document.createElement('div'), select = document.createElement('select'), levels = document.createElement('select');
  select.setAttribute('aria-label', 'Panel zoom mode');
  levels.setAttribute('aria-label', 'Semantic detail');
  for (const mode of ['geometric', 'semantic', 'fisheye']) select.appendChild(new Option(mode, mode));
  row.append(select, levels);
  const buttons = [];
  for (const [label, factor] of [['−', 1 / 1.1], ['+', 1.1]]) {
    const button = document.createElement('button'); button.type = 'button'; button.textContent = label;
    button.setAttribute('aria-label', label === '+' ? 'Increase panel zoom detail or scale' : 'Decrease panel zoom detail or scale');
    button.onclick = () => { executePanelZoom(getPanel(), select.value, { action: 'zoom', factor }); sync(); };
    row.appendChild(button); buttons.push(button);
  }
  const reset = document.createElement('button'); reset.type = 'button'; reset.textContent = 'Reset mode'; row.append(reset);
  reset.onclick = () => { executePanelZoom(getPanel(), select.value, { action: 'reset' }); sync(); };
  let levelKey = '';
  const sync = () => {
    const panel = getPanel(), supported = getPanelZoomCapabilities(panel);
    select.value = getPanelZoomMode(panel);
    for (const option of select.options) option.disabled = !supported[option.value];
    buttons.forEach(button => { button.disabled = !supported[select.value]; });
    reset.disabled = !supported[select.value];
    const choices = getPanelZoomMetadata(panel, select.value)?.levels || [];
    const key = JSON.stringify(choices);
    if (key !== levelKey) { levels.replaceChildren(...choices.map(item => new Option(item.label, item.value))); levelKey = key; }
    levels.hidden = !choices.length;
    levels.value = getPanelZoomState(panel, select.value)?.level || '';
    select.title = 'Choose the mode for these buttons. Ctrl gestures are semantic; Ctrl+Fn or configured Ctrl+Alt gestures are geometric.';
  };
  select.onchange = () => { setPanelZoomMode(getPanel(), select.value); sync(); };
  levels.onchange = () => { executePanelZoom(getPanel(), select.value, { action: 'set', level: levels.value }); sync(); };
  host.appendChild(row); sync();
  return sync;
}
