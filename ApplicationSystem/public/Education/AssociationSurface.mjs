// Nodevision/ApplicationSystem/public/Education/AssociationSurface.mjs
// This module builds theme-inheriting association controls inside existing inspectors. It owns local button handlers and status messages without adding panels, toolbar commands, or global selection listeners.

export function associationSurface(host, title) {
  const cleanup = [];
  const section = document.createElement('fieldset');
  section.dataset.documentAssociations = '';
  const legend = document.createElement('legend');
  legend.textContent = title;
  const status = document.createElement('p');
  status.setAttribute('role', 'status');
  section.append(legend, status);
  host.append(section);
  function select(label) {
    const row = document.createElement('label');
    row.style.display = 'block';
    row.append(label + ' ');
    const input = document.createElement('select');
    input.setAttribute('aria-label', label);
    row.append(input);
    section.insertBefore(row, status);
    return input;
  }
  function action(label, callback) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    button.onclick = async () => {
      button.disabled = true;
      try { await callback(); status.textContent = 'Association updated. Save each changed document when ready.'; }
      catch (error) { status.textContent = error.message; }
      finally { button.disabled = false; }
    };
    section.insertBefore(button, status);
    return button;
  }
  function options(input, entries, empty = 'Choose') {
    const previous = input.value;
    input.replaceChildren(new Option(empty, ''), ...entries.map(([value, label]) => new Option(label, value)));
    input.value = previous;
  }
  function listen(target, event, callback) {
    target.addEventListener(event, callback);
    cleanup.push(() => target.removeEventListener(event, callback));
  }
  return { section, status, select, action, options, listen,
    dispose() { for (const release of cleanup.splice(0)) release(); section.remove(); },
  };
}
