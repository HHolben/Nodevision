// Iframe media uses the standard Insert Media panel and a captured editor target.
import { openInsertMediaPanel, captureInsertMediaOriginContext } from './insertMediaPanel.mjs';
import { captureAssetEditorContext, validateAssetEditorContext, editorHosts } from '/AssetDownloads/AssetEditorContext.mjs';
import { iframeDefaults, validateIframeValues, validateIframePatch, createIframeElement, iframeWorldDefinition } from '/Media/IframeProperties.mjs';
import { markupInsertionAllowed } from './insertMediaCode.mjs';

export function renderIframeForm(root, initial, apply, { editing = false, close = () => {} } = {}) {
  const form = document.createElement('form');
  form.style.cssText = 'display:flex;flex-direction:column;gap:8px;font:13px sans-serif';
  form.setAttribute('aria-label', editing ? 'Iframe properties' : 'Insert iframe');
  const controls = {};
  const fields = [['sourceKind','Resource',['notebook','internet']], ['src','Source URL or relative path'], ['width','Width'], ['height','Height'], ['title','Title'], ['loading','Loading',['','lazy','eager']], ['sandbox','Sandbox permissions (empty restricts all)'], ['allow','Permissions policy'], ['allowfullscreen','Allow fullscreen','checkbox'], ['border','Border (CSS)']];
  for (const [key, label, choices] of fields) {
    const row = document.createElement('label'); row.textContent = label;
    const input = document.createElement(Array.isArray(choices) ? 'select' : 'input'); input.name = key;
    if (Array.isArray(choices)) for (const value of choices) { const option = document.createElement('option'); option.value = value; option.textContent = value === 'notebook' ? 'Notebook' : value === 'internet' ? 'Internet' : value || 'Unspecified'; input.append(option); }
    else input.type = choices || 'text';
    if (choices === 'checkbox') input.checked = !!initial[key]; else input.value = initial[key] ?? '';
    input.style.cssText = 'display:block;width:100%;box-sizing:border-box'; controls[key] = input; row.append(input); form.append(row);
  }
  const note = document.createElement('p'); note.textContent = 'Notebook paths are relative to this document. Some sites block embedding. Editor previews restrict scripts; use the document preview to interact.';
  const status = document.createElement('div'); status.setAttribute('role','alert');
  const submit = document.createElement('button'); submit.type = 'submit'; submit.textContent = editing ? 'Apply' : 'Insert';
  const cancel = document.createElement('button'); cancel.type = 'button'; cancel.textContent = 'Cancel'; cancel.onclick = close;
  form.append(note, status, submit, cancel); root.append(form);
  form.addEventListener('keydown', event => { if (event.key === 'Escape') { event.stopPropagation(); close(); } });
  form.addEventListener('submit', async event => {
    event.preventDefault(); submit.disabled = true;
    try {
      const values = Object.fromEntries(Object.entries(controls).map(([key, input]) => [key, input.type === 'checkbox' ? input.checked : input.value]));
      // Preserve absent sandbox on imported elements unless explicitly edited.
      if (editing && initial.sandbox === null && values.sandbox === '') values.sandbox = null;
      if (values.border && values.border !== initial.border && !CSS.supports('border', values.border)) throw Error('Enter a valid CSS border, such as 1px solid gray.');
      await apply(editing ? validateIframePatch(values, initial) : validateIframeValues(values)); close();
    } catch (error) { status.textContent = error.message; }
    finally { submit.disabled = false; }
  });
  controls.src.focus(); return { form, controls, status };
}

export async function captureIframeTarget() {
  const origin = captureInsertMediaOriginContext({ familyKey: 'Iframe' });
  const { host, tab } = editorHosts(origin.originCell);
  const php = host?.querySelector('.nv-php-input');
  if (origin.targetMode === 'PHPediting' && php) return { kind: 'php', input: php, source: php.value, start: php.selectionStart, end: php.selectionEnd, origin, cell: origin.originCell, host, tabId: tab?.tabId || '', path: origin.originEditorPath };
  const context = await captureAssetEditorContext(origin.originCell);
  if (context?.kind === 'html' && !context.range) { context.range = context.root.ownerDocument.createRange(); context.range.selectNodeContents(context.root); context.range.collapse(false); }
  if (!context || !['html','world'].includes(context.kind)) throw Error('Open an HTML, PHP, or virtual world editor first.');
  return context;
}
export async function insertIframeAtTarget(target, values) {
  const valid = validateIframeValues(values);
  if (target.kind === 'php') {
    const reason = validateAssetEditorContext(target); if (reason) throw Error(reason);
    const { input, source, start, end } = target;
    if (!input.isConnected || input.value !== source) throw Error('The PHP source changed. Reopen Insert iframe.');
    if (!markupInsertionAllowed(source, start, 'php') || !markupInsertionAllowed(source, end, 'php') || /[<>]/.test(source.slice(start,end))) throw Error('Place the caret in HTML text outside PHP blocks and tags.');
    input.focus(); input.setSelectionRange(start, end);
    const html = createIframeElement(document, valid).outerHTML;
    if (!document.execCommand('insertText', false, html)) throw Error('The PHP source editor rejected insertion.');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  }
  const reason = validateAssetEditorContext(target); if (reason) throw Error(reason);
  if (target.kind === 'world') {
    if (!target.api?.addGameObjectLayer) throw Error('World iframe insertion is unavailable.');
    const def = iframeWorldDefinition(valid, target.position);
    def.iframeDocumentPath = target.path;
    const measure = document.createElement('div');
    measure.style.cssText = 'position:absolute;visibility:hidden;pointer-events:none';
    measure.style.width = valid.width; measure.style.height = valid.height;
    target.host.append(measure);
    const bounds = measure.getBoundingClientRect(); measure.remove();
    def.iframeViewport = [Math.max(16, bounds.width), Math.max(16, bounds.height)];
    def.size[1] = def.size[0] * def.iframeViewport[1] / def.iframeViewport[0];
    // Keep the relative source in the definition; resolve against the captured world path at runtime.
    if (!target.api.addGameObjectLayer(def)) throw Error('The world rejected iframe insertion.');
    return true;
  }
  const frame = createIframeElement(target.root.ownerDocument, valid);
  const selection = target.root.ownerDocument.getSelection(); target.root.focus(); selection.removeAllRanges(); selection.addRange(target.range.cloneRange());
  if (!target.api.insertHTMLAtCaret(frame.outerHTML)) throw Error('The HTML editor rejected iframe insertion.');
  return true;
}
export async function openIframeInsertion() {
  const target = await captureIframeTarget();
  const panel = await openInsertMediaPanel('Insert iframe', 'Iframe', { originContext: target.origin });
  return renderIframeForm(panel.mount, iframeDefaults, values => insertIframeAtTarget(target, values), { close: () => panel.closeBtn.click() });
}
