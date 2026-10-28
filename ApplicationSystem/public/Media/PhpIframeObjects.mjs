// Static PHP iframe objects are edited by source-range replacement; PHP is never parsed as HTML or executed.
import { markupInsertionAllowed } from '/ToolbarJSONfiles/insertMediaCode.mjs';
import { createHtmlSourceProvenance } from '/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditorComponents/HtmlSourceProvenance.mjs';
import { initializeHtmlImageHandles } from '/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditorComponents/HTMLeditorImplParts/InitializeHtmlImageHandles.mjs';
import { installIframeEditing } from './IframeEditing.mjs';
import { buildNotebookBaseHref } from '/PanelInstances/EditorPanels/GraphicalEditors/PhpEditorFiles.mjs';

export function phpIframeRanges(source) {
  const matches = [];
  const pattern = /<iframe\b(?:[^>"']|"[^"]*"|'[^']*')*>[\s\S]*?<\/iframe\s*>/gi;
  for (const match of source.matchAll(pattern)) {
    if (match[0].includes('<?') || !markupInsertionAllowed(source, match.index, 'php')) continue;
    matches.push({ start: match.index, end: match.index + match[0].length, html: match[0] });
  }
  return matches;
}
export function installPhpIframeObjects(input, host, filePath) {
  const section = document.createElement('section'); section.setAttribute('aria-label','Embedded iframe objects');
  const heading = document.createElement('h3'); heading.textContent = 'Embedded iframe objects'; section.append(heading);
  const choices = document.createElement('div'); section.append(choices);
  const root = document.createElement('div'); root.tabIndex = 0; root.style.cssText = 'position:relative;overflow:auto;max-height:420px;background:white;padding:12px'; section.append(root); host.append(section);
  const provenance = createHtmlSourceProvenance(root); root.__nvSourceProvenance = provenance;
  const imageToolsState = {}; initializeHtmlImageHandles({ imageToolsState, wysiwyg: root });
  for (const handle of imageToolsState.cornerHandles.values()) handle.style.cssText += ';position:fixed;width:12px;height:12px;border:1px solid #2f80ff;border-radius:50%;background:white;transform:translate(-50%,-50%);z-index:26000;cursor:nwse-resize;touch-action:none';
  const media = { selectMediaElement: imageToolsState.setSelectedImageForHandles, syncMediaHandles: imageToolsState.scheduleImageHandleSync };
  let records = new WeakMap(), snapshot = '', disposed = false;
  function patch(frame, replacement) {
    const record = records.get(frame);
    if (!record || input.value !== snapshot || !input.isConnected) throw Error('PHP source changed. Select the iframe again.');
    input.focus(); input.setSelectionRange(record.start, record.end);
    if (!document.execCommand('insertText', false, replacement)) throw Error('PHP editor rejected the change.');
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }
  const clean = frame => { const clone = document.createElement('div'); clone.append(frame.cloneNode(true)); return provenance.clean(clone).innerHTML; };
  const editing = installIframeEditing(root, media, { commit: frame => patch(frame, clean(frame)), remove: frame => patch(frame, ''), duplicate: frame => patch(frame, clean(frame) + '\n' + clean(frame)) });
  function refresh() {
    if (disposed || snapshot === input.value && root.children.length) return;
    snapshot = input.value; records = new WeakMap(); editing.select(null); choices.replaceChildren(); root.replaceChildren();
    const stage = document.createElement('div');
    for (const record of phpIframeRanges(snapshot)) {
      const template = document.createElement('template'); template.innerHTML = record.html;
      const frame = template.content.firstElementChild; if (frame?.localName !== 'iframe') continue;
      records.set(frame, record); stage.append(frame);
      const button = document.createElement('button'); button.type = 'button'; button.textContent = frame.getAttribute('title') || frame.getAttribute('src') || 'Iframe';
      button.addEventListener('click', () => editing.select(frame)); choices.append(button);
    }
    provenance.capture(stage);
    for (const frame of stage.children) {
      provenance.resolveAttribute(frame, 'sandbox', '');
      for (const attr of [...frame.attributes]) if (/^on/i.test(attr.name)) provenance.resolveAttribute(frame, attr.name, null);
      const source = frame.getAttribute('src') || '';
      const allowed = !/^[a-z][a-z\d+.-]*:/i.test(source) || /^https?:/i.test(source);
      provenance.resolveAttribute(frame, 'src', allowed ? new URL(source, new URL(buildNotebookBaseHref(filePath), location.href)).href : 'about:blank');
    }
    root.append(...stage.childNodes); section.hidden = !root.children.length;
  }
  input.addEventListener('input', refresh); refresh();
  return () => { disposed = true; input.removeEventListener('input',refresh); editing.dispose(); provenance.dispose(); window.removeEventListener('resize',imageToolsState.onGlobalGeometryChange); window.removeEventListener('nv-panel-zoom-pan-updated',imageToolsState.onGlobalGeometryChange); window.removeEventListener('scroll',imageToolsState.onGlobalGeometryChange,true); root.removeEventListener('scroll',imageToolsState.onGlobalGeometryChange,true); root.removeEventListener('input',imageToolsState.onGlobalGeometryChange); imageToolsState.removed = true; imageToolsState.setSelectedImageForHandles(null); imageToolsState.cornerHandles.forEach(handle => handle.remove()); if (imageToolsState.handleSyncRaf) cancelAnimationFrame(imageToolsState.handleSyncRaf); section.remove(); };
}
