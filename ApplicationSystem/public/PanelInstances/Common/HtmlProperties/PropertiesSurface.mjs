// Nodevision/ApplicationSystem/public/PanelInstances/Common/HtmlProperties/PropertiesSurface.mjs
// This module builds a small theme-inheriting Properties surface using native panel controls and the shared hex-color control without interpreting or normalizing authored CSS values.
import { createHexColorControl } from '/Controls/HexColorControl.mjs';
export function createPropertiesSurface(host) {
  host.replaceChildren(); host.classList.add('nv-html-properties');
  const make = (tag, text = '') => { const node = document.createElement(tag); node.textContent = text; return node; };
  const row = (text, control) => { const label = make('label', text + ' '); label.append(control); host.append(label); };
  const identity = make('p'), effective = make('p'), authored = make('p'), sources = make('ul'), status = make('p');
  status.setAttribute('role', 'status');
  host.append(make('h3', 'HTML Properties'), identity);
  const property = make('select');
  for (const name of ['color', 'margin-left']) { const option = make('option', name); option.value = name; property.append(option); }
  row('Property', property); host.append(effective, authored);
  const destination = make('select'); row('Edit destination', destination);
  const value = make('input'); value.type = 'text'; value.setAttribute('aria-label', 'Authored CSS value'); row('Value', value);
  const picker = createHexColorControl({ label: 'Choose hex color', onCommit: text => { value.value = text; } });
  picker.resetButton.hidden = true; host.append(picker.element);
  const actions = make('p'), buttons = {};
  for (const [name, label] of [['preview', 'Preview'], ['apply', 'Apply'], ['cancel', 'Cancel'], ['undo', 'Undo Properties'], ['redo', 'Redo Properties'], ['save', 'Save destination'], ['refresh', 'Refresh']]) {
    const button = make('button', label); button.type = 'button'; button.dataset.action = name; actions.append(button); buttons[name] = button;
  }
  host.append(actions, status, make('p', 'Effective values describe this editing surface. Matching rules are candidates, not a computed cascade winner.'), sources);
  host.append(make('p', 'After an inline Properties edit, native undo is paused for this document. Properties Undo is available only before another document edit. Save and reopen to resume native history.'));
  return { identity, effective, authored, sources, status, property, destination, value, picker, buttons,
    destinations(targets) {
      destination.replaceChildren();
      const entries = [['', 'Choose a destination'], ['inline', 'Inline style'], ...targets.map((target, i) => [String(i), target.label + (target.reason ? ' — read-only' : '')])];
      for (const [key, label] of entries) { const option = make('option', label); option.value = key; option.disabled = key !== '' && key !== 'inline' && Boolean(targets[Number(key)].reason); destination.append(option); }
      sources.replaceChildren(...targets.map(target => make('li', `${target.label}: ${target.declaration?.value || 'no declaration'}${target.declaration?.priority ? ' !important' : ''}${target.rule?.ancestry.length ? ' · ' + target.rule.ancestry.join(' → ') : ''}${target.reason ? ' · ' + target.reason : ''}`)));
    },
  };
}
