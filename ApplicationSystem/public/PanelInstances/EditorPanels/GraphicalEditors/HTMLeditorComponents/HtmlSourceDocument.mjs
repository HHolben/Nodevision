// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditorComponents/HtmlSourceDocument.mjs
// This module preserves the parsed HTML document shell and inert source nodes while projecting editable head and body content into the graphical editor and serializing ordinary HTML again.

import { createHtmlSourceProvenance } from './HtmlSourceProvenance.mjs';
// Script records retain the existing hidden-script editing contract; comments keep position.
export function createHtmlSourceDocument({ head, body, hidden }) {
  const owner = body.ownerDocument;
  const parser = new owner.defaultView.DOMParser();
  const prefix = `nv-source-${owner.defaultView.crypto.randomUUID()}:`;
  let sourceDocument;
  let originalContent = '';
  let nextId = 0;
  const retained = new Map();
  const provenance = createHtmlSourceProvenance(body);
  body.__nvSourceProvenance = provenance;

  function projectChildren(source, target) {
    for (const child of source.childNodes) {
      const clone = child.cloneNode(true);
      protect(clone);
      if (clone.__nvSourceReplacement) target.append(clone.__nvSourceReplacement);
      else target.append(clone);
    }
  }

  function protect(node) {
    if (node.nodeType !== 1) return;
    // Templates are already inert, including their scripts and nested templates.
    if (node.localName === 'template') return;
    if (['script', 'base', 'meta'].includes(node.localName)) {
      const id = prefix + nextId++;
      retained.set(id, node.cloneNode(true));
      if (node.localName === 'script') {
        const record = owner.createElement('div');
        record.dataset.sourceId = id;
        record.dataset.script = node.textContent;
        hidden.append(record);
      }
      const marker = owner.createComment(id);
      if (node.parentNode) node.replaceWith(marker);
      else node.__nvSourceReplacement = marker;
      return;
    }
    for (const child of [...node.childNodes]) protect(child);
  }

  function restore(target, records) {
    const walker = owner.createTreeWalker(target, 128 /* SHOW_COMMENT */);
    const markers = [];
    while (walker.nextNode()) {
      if (retained.has(walker.currentNode.data)) markers.push(walker.currentNode);
    }
    for (const marker of markers) {
      const original = retained.get(marker.data).cloneNode(true);
      if (original.localName === 'script') {
        const record = records.get(marker.data);
        if (!record) { marker.remove(); continue; }
        original.textContent = record.dataset.script;
      }
      marker.replaceWith(original);
    }
  }

  // Loading is shared by initial render and setEditorHTML; reject non-HTML source explicitly.
  function load(content) {
    const text = String(content ?? '');
    if (/<\?(?:php\b|=|xml\b)/i.test(text)) {
      throw new Error('PHP and XML source must be edited in the source editor; graphical HTML cannot preserve their syntax.');
    }
    const parsed = parser.parseFromString(text, 'text/html');
    sourceDocument = parsed;
    originalContent = text;
    retained.clear();
    head.replaceChildren();
    body.replaceChildren();
    hidden.replaceChildren();
    const headStage = owner.createElement('div'), bodyStage = owner.createElement('div');
    projectChildren(parsed.head, headStage);
    projectChildren(parsed.body, bodyStage);
    provenance.capture(headStage, bodyStage);
    for (const element of [...headStage.querySelectorAll('*'), ...bodyStage.querySelectorAll('*')]) {
      for (const attribute of [...element.attributes]) {
        if (/^on/i.test(attribute.name)) provenance.resolveAttribute(element, attribute.name, null);
        if (['href', 'src'].includes(attribute.name) && /^javascript:/i.test(attribute.value.trim())) {
          provenance.resolveAttribute(element, attribute.name, 'about:blank');
        }
      }
      if (element.localName === 'iframe') provenance.resolveAttribute(element, 'sandbox', '');
    }
    head.append(...headStage.childNodes);
    body.append(...bodyStage.childNodes);
    body.dataset.nvDocumentBodyStyle = parsed.body.getAttribute('style') || '';
    return parsed;
  }

  // Serialize detached clones only; author scripts never enter the live application document.
  function serialize(bodyClone, { supportHeadHtml = '' } = {}) {
    // Copy the shell without cloning the entire original body just to discard it.
    const result = sourceDocument.cloneNode(false);
    for (const node of sourceDocument.childNodes) {
      if (node !== sourceDocument.documentElement) { result.append(node.cloneNode(true)); continue; }
      const shell = node.cloneNode(false);
      for (const child of node.childNodes) shell.append(child.cloneNode(child !== sourceDocument.head && child !== sourceDocument.body));
      result.append(shell);
    }
    result.head.replaceChildren(...provenance.clean(head.cloneNode(true)).childNodes);
    result.body.replaceChildren(...bodyClone.childNodes);
    const records = new Map([...hidden.children].map(record => [record.dataset.sourceId, record]));
    restore(result.head, records);
    restore(result.body, records);
    for (const record of hidden.children) {
      if (record.dataset.sourceId || !Object.hasOwn(record.dataset, 'script')) continue;
      const script = result.createElement('script');
      script.textContent = record.dataset.script;
      result.body.append(script);
    }
    const style = body.dataset.nvDocumentBodyStyle || '';
    if (style !== (sourceDocument.body.getAttribute('style') || '')) {
      if (style) result.body.setAttribute('style', style);
      else result.body.removeAttribute('style');
    }
    if (supportHeadHtml) {
      const template = result.createElement('template');
      template.innerHTML = supportHeadHtml;
      result.head.append(template.content);
    }
    const serializer = new owner.defaultView.XMLSerializer();
    return [...result.childNodes].map(node => node.nodeType === 1
      ? node.outerHTML : serializer.serializeToString(node)).join('');
  }

  return {
    load, serialize, provenance,
    styleSources: () => ({ base: sourceDocument.querySelector('base[href]')?.getAttribute('href') || '',
      elements: [...head.querySelectorAll('style, link[rel~="stylesheet"]'), ...body.querySelectorAll('style, link[rel~="stylesheet"]')] }),
    has: selector => Boolean(sourceDocument.querySelector(selector)),
    get originalContent() { return originalContent; },
  };
}
