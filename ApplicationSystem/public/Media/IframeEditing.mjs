// Shared iframe selection/properties, using HTML selection, transactions and media handles.
import { readIframeValues, applyIframeValues } from './IframeProperties.mjs';
import { buildNotebookBaseHref } from '/PanelInstances/EditorPanels/GraphicalEditors/PhpEditorFiles.mjs';
async function panelTools() {
  return { ...(await import('/ToolbarJSONfiles/insertMediaIframe.mjs')), ...(await import('/ToolbarJSONfiles/insertMediaPanel.mjs')) };
}

export function installIframeEditing(root, mediaTools, { commit = () => {}, remove = null, duplicate = null, filePath = '' } = {}) {
  root.classList.add('nv-iframe-edit-surface');
  if (!document.getElementById('nv-iframe-editing-style')) {
    const css = document.createElement('style'); css.id = 'nv-iframe-editing-style';
    css.textContent = '.nv-iframe-edit-surface iframe{pointer-events:none!important;min-width:16px;min-height:16px;outline:1px dashed #718096}'; document.head.append(css);
  }
  function refreshFrames() {
    const provenance = root.__nvSourceProvenance;
    if (!provenance || !filePath) return;
    for (const frame of root.querySelectorAll('iframe')) {
      const source = provenance.sourceAttribute(frame, 'src');
      if (source !== null) {
        let url = 'about:blank';
        try { const resolved = new URL(source, new URL(buildNotebookBaseHref(filePath), location.href)); if (['http:', 'https:'].includes(resolved.protocol)) url = resolved.href; } catch {}
        provenance.resolveAttribute(frame, 'src', url);
      }
      provenance.resolveAttribute(frame, 'sandbox', '');
    }
  }
  const observer = new MutationObserver(() => { refreshFrames(); position(); });
  observer.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ['src','sandbox'] });
  refreshFrames();
  const toolbar = document.createElement('div');
  toolbar.style.cssText = 'position:fixed;z-index:22000;background:white;color:#222;padding:6px;border:1px solid #777;display:none;max-width:90vw';
  toolbar.setAttribute('role','toolbar'); toolbar.setAttribute('aria-label','Iframe'); document.body.append(toolbar);
  let selected = null;
  const run = (label, mutate) => {
    if (!selected || !root.contains(selected)) throw Error('Select an iframe first.');
    const frame = selected;
    if (root.__nvHtmlTransactions) root.__nvHtmlTransactions.run(label, mutate); else mutate();
    commit(frame); mediaTools.syncMediaHandles?.();
  };
  const authoredClone = frame => {
    const container = document.createElement('div'); container.append(frame.cloneNode(true));
    return root.__nvSourceProvenance ? root.__nvSourceProvenance.clean(container).firstElementChild : container.firstElementChild;
  };
  async function edit() {
    const frame = selected; if (!frame || !root.contains(frame)) return;
    const original = readIframeValues(frame, root.__nvSourceProvenance);
    const snapshot = authoredClone(frame).outerHTML;
    const { openInsertMediaPanel, renderIframeForm } = await panelTools();
    const panel = await openInsertMediaPanel('Iframe properties', 'Iframe-properties');
    renderIframeForm(panel.mount, original, values => {
      if (!root.contains(frame) || authoredClone(frame).outerHTML !== snapshot) throw Error('The iframe changed. Reopen its properties.');
      selected = frame;
      run('Iframe properties', () => {
        const clone = authoredClone(frame); applyIframeValues(clone, values, original);
        const provenance = root.__nvSourceProvenance;
        for (const name of new Set([...clone.attributes, ...frame.attributes].map(attr => attr.name))) {
          if (provenance?.isPrivateAttribute(name)) continue;
          const next = clone.getAttribute(name), old = provenance ? provenance.sourceAttribute(frame, name) : frame.getAttribute(name);
          if (next === old) continue;
          if (provenance) provenance.setSourceAttribute(frame, name, next);
          else if (next === null) frame.removeAttribute(name); else frame.setAttribute(name, next);
        }
        provenance?.resolveAttribute(frame, 'sandbox', '');
      });
    }, { editing: true, close: () => panel.closeBtn.click() });
  }
  function select(frame) {
    selected = frame && root.contains(frame) ? frame : null;
    mediaTools.selectMediaElement?.(selected);
    toolbar.style.display = selected ? 'block' : 'none';
    if (!selected) return;
    root.focus();
    const range = document.createRange(); range.selectNode(selected);
    const selection = document.getSelection(); selection.removeAllRanges(); selection.addRange(range);
    root.__nvHtmlSelection?.selectElement(selected);
    window.dispatchEvent(new CustomEvent('nodevision-html-layer-selected', { detail: { element: selected } }));
    position();
  }
  function position() {
    if (!selected || !root.isConnected || !root.contains(selected) || !selected.getClientRects().length) { toolbar.style.display = 'none'; return; }
    const rect = selected.getBoundingClientRect(); toolbar.style.left = Math.max(0, rect.left) + 'px'; toolbar.style.top = Math.max(0, rect.top - 38) + 'px';
  }
  function action(label, fn) {
    const button = document.createElement('button'); button.type = 'button'; button.textContent = label;
    button.addEventListener('click', () => Promise.resolve().then(fn).catch(error => { status.textContent = error.message; })); toolbar.append(button);
  }
  action('Properties', edit);
  action('Preview', async () => {
    if (!selected) return;
    const { openInsertMediaPanel } = await panelTools();
    const panel = await openInsertMediaPanel('Iframe preview — Close to return to editing', 'Iframe-preview');
    const frame = authoredClone(selected);
    // Preview is unprivileged even for imported iframe markup.
    const permissions = (frame.getAttribute('sandbox') || '').split(/\s+/);
    frame.setAttribute('sandbox', permissions.filter(token => !(permissions.includes('allow-scripts') && token === 'allow-same-origin')).join(' '));
    frame.removeAttribute('srcdoc');
    panel.closeBtn.addEventListener('click', () => select(selected), { once: true });
    for (const attr of [...frame.attributes]) if (/^on/i.test(attr.name)) frame.removeAttribute(attr.name);
    frame.src = /^https?:/i.test(selected.src) ? selected.src : 'about:blank'; frame.style.pointerEvents = 'auto'; frame.style.maxWidth = '100%'; panel.mount.append(frame);
    const message = document.createElement('p'); message.textContent = 'If content is blank, the resource may be unavailable or may block embedding. Close this panel to return to editing.'; panel.mount.append(message);
  });
  const deleteSelected = () => { if (remove) remove(selected); else run('Delete iframe', () => selected.remove()); select(null); };
  action('Delete', deleteSelected);
  action('Duplicate', () => { if (duplicate) duplicate(selected); else run('Duplicate iframe', () => selected.after(authoredClone(selected))); });
  const status = document.createElement('span'); status.textContent = ' Embedded content may be blocked by its host.'; toolbar.append(status);
  const click = event => {
    // Frames cannot receive events in selection mode; hit-test their document rectangles.
    const frame = [...root.querySelectorAll('iframe')].reverse().find(node => { const r = node.getBoundingClientRect(); return event.clientX >= r.left && event.clientX <= r.right && event.clientY >= r.top && event.clientY <= r.bottom; });
    if (frame) { event.preventDefault(); select(frame); } else if (selected) select(null);
  };
  const key = event => {
    if (event.key === 'Escape') { select(null); return; }
    if (!selected) return;
    if (event.key.startsWith('Arrow')) { select(null); return; }
    if (event.key === 'Enter') { event.preventDefault(); void edit(); }
    if (['Delete','Backspace'].includes(event.key)) { event.preventDefault(); deleteSelected(); }
  };
  const layer = event => {
    const frame = event.detail?.element;
    if (frame?.localName === 'iframe' && root.contains(frame) && frame !== selected) select(frame);
  };
  const clipboard = event => {
    if (!selected || !root.contains(selected) || !event.clipboardData) return;
    event.clipboardData.setData('text/html', authoredClone(selected).outerHTML);
    event.clipboardData.setData('text/plain', authoredClone(selected).outerHTML);
    event.preventDefault();
    if (event.type === 'cut') deleteSelected();
  };
  root.addEventListener('copy', clipboard); root.addEventListener('cut', clipboard);
  root.__nvIframeCommit = commit;
  root.addEventListener('click', click); root.addEventListener('keydown', key);
  window.addEventListener('nodevision-html-layer-selected', layer);
  window.addEventListener('scroll', position, true); window.addEventListener('resize', position);
  return { select, edit, dispose() { observer.disconnect(); root.removeEventListener('copy',clipboard); root.removeEventListener('cut',clipboard); toolbar.remove(); root.removeEventListener('click',click); root.removeEventListener('keydown',key); window.removeEventListener('nodevision-html-layer-selected',layer); window.removeEventListener('scroll',position,true); window.removeEventListener('resize',position); delete root.__nvIframeCommit; } };
}
