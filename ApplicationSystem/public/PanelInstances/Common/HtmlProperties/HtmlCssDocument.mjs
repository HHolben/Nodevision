// Nodevision/ApplicationSystem/public/PanelInstances/Common/HtmlProperties/HtmlCssDocument.mjs
// This module discovers an owning HTML document's stylesheets and projects a bounded local CSS subset into a private browser scope while preserving the original source nodes for serialization.
import { acquireCssSource, cssSourceConflict } from './CssSourceStore.mjs';
import { indexCssSource, cssDeclarationTarget } from './CssSourceIndex.mjs';
import { toNotebookAssetUrl } from '/utils/notebookPath.mjs';

export const propertiesDiagnostics = { sourceLoads: 0, discoveries: 0, computedReads: 0, projections: 0 };
function localPath(href, base) {
  try {
  const url = new URL(href, base);
  if (url.origin !== location.origin || !url.pathname.startsWith('/Notebook/') || url.search || url.hash) return null;
  const path = url.pathname.slice('/Notebook/'.length).split('/').map(decodeURIComponent).join('/');
  return /\.css$/i.test(path) ? path : null;
  } catch { return null; }
}
function projectionProblem(index) {
  return index.error || (index.unsupported.length ? 'Imports and unrecognized at-rules are read-only' : '') ||
    (index.rules.some(rule => rule.reason) ? 'Unsupported rule syntax' : '') ||
    (index.rules.some(rule => /(^|[\s,>+~(])(?:html|body)\b|:root|:scope/i.test(rule.selector)) ? 'Document-root selectors require an isolated page viewport: read-only' : '') ||
    (/url\s*\(/i.test(index.source) ? 'Stylesheets containing resource URLs are read-only in this prototype' : '');
}
export async function prepareHtmlCssDocument(context) {
  const snapshot = context.styleSources(), previous = context.__nvPropertiesDocument;
  const root = context.editorElement, owner = root.ownerDocument, provenance = root.__nvSourceProvenance;
  const sameElements = previous && snapshot.elements.every((el, i) => el === previous.elements[i]) && snapshot.elements.length === previous.elements.length;
  if (sameElements && previous.revision === context.revision) return previous.ready;
  const signature = JSON.stringify([snapshot.base, snapshot.elements.map(element => [element.localName === 'style' ? element.textContent : '',
    ...['href', 'media', 'rel', 'disabled', 'title'].map(name => provenance.sourceAttribute(element, name))])]);
  if (sameElements && previous.signature === signature) { previous.revision = context.revision; return previous.ready; }
  previous?.dispose();
  const state = { elements: snapshot.elements, signature, revision: context.revision, entries: [], disposed: false, scope: 'data-nv-css-' + crypto.randomUUID() };
  context.__nvPropertiesDocument = state;
  state.dispose = () => {
    if (state.disposed) return; state.disposed = true;
    for (const entry of state.entries) {
      entry.unsubscribe?.(); entry.projection?.remove(); entry.source?.release();
      if (entry.projection && entry.element.isConnected) provenance.resolveAttribute(entry.element, 'media', provenance.sourceAttribute(entry.element, 'media'));
    }
    root.removeAttribute(state.scope);
  };
  state.ready = (async () => {
    const page = new URL(toNotebookAssetUrl(context.filePath), location.origin);
    const base = new URL(snapshot.base || page.href, page);
    for (let order = 0; order < state.elements.length; order++) {
      const element = state.elements[order], entry = { element, order, media: provenance.sourceAttribute(element, 'media'), reason: '' };
      state.entries.push(entry);
      if (element.localName === 'style') { entry.label = `${context.filePath} <style> ${order + 1}`; entry.index = indexCssSource(element.textContent); entry.reason = 'Style blocks are discovery-only'; }
      else {
        const href = provenance.sourceAttribute(element, 'href'); entry.path = localPath(href, base); entry.label = href;
        if (!entry.path) entry.reason = 'External, managed or nonportable stylesheet: read-only';
        else try { propertiesDiagnostics.sourceLoads++; entry.source = await acquireCssSource(entry.path); entry.index = entry.source.index; }
        catch (error) { entry.reason = error.message; }
      }
      if (state.disposed) { entry.source?.release(); return state; }
    }
    const probe = new CSSStyleSheet(); probe.replaceSync('@scope (.probe) { .test { color: red; } }');
    state.reason = typeof CSSScopeRule === 'undefined' || !(probe.cssRules[0] instanceof CSSScopeRule) ? 'Scoped CSS preview is unavailable in this browser' : '';
    state.reason ||= state.entries.some(entry => entry.element.hasAttribute('disabled') || entry.element.hasAttribute('title') || entry.element.relList?.contains('alternate')) ? 'Disabled or alternate stylesheets are read-only' : '';
    state.reason ||= state.entries.map(entry => entry.index ? projectionProblem(entry.index) : entry.reason).find(Boolean) || '';
    if (!state.reason) {
      root.setAttribute(state.scope, '');
      for (const entry of state.entries) {
        entry.projection = owner.createElement('style');
        const update = () => {
          if (state.disposed) return;
          const text = entry.source?.text ?? entry.element.textContent;
          entry.projection.textContent = `@scope ([${state.scope}]) { ${entry.media ? '@media ' + entry.media + ' {' : ''}\n${text}\n${entry.media ? '}' : ''} }`;
          propertiesDiagnostics.projections++;
        };
        provenance.resolveAttribute(entry.element, 'media', 'not all');
        owner.head.append(entry.projection); update();
        entry.unsubscribe = entry.source?.subscribe(update);
      }
    }
    return state;
  })();
  return state.ready;
}
export async function discoverHtmlProperties(context, element, property) {
  const state = await prepareHtmlCssDocument(context); propertiesDiagnostics.discoveries++;
  if (!context.editorElement.contains(element)) throw new Error('The selected element no longer belongs to this editor');
  const targets = [];
  for (const entry of state.entries) {
    const index = entry.source?.index || entry.index;
    if (!index) { targets.push({ label: entry.label, reason: entry.reason }); continue; }
    for (const rule of index.rules) {
      let matches = false; try { matches = element.matches(rule.selector); } catch {}
      if (!matches) continue;
      const target = cssDeclarationTarget(index, rule.id, property);
      targets.push({ ...target, entry, index, label: `${entry.label} → ${rule.selector} (rule ${rule.order + 1})`,
        reason: state.reason || entry.reason || (entry.source && cssSourceConflict(entry.path)) || target.reason || (entry.media ? 'Link media conditions are read-only' : '') });
    }
  }
  propertiesDiagnostics.computedReads++;
  return { targets, effective: getComputedStyle(element).getPropertyValue(property), inline: element.style.getPropertyValue(property),
    priority: element.style.getPropertyPriority(property), inherited: property === 'color' && !element.style.color && targets.every(t => !t.declaration),
    sourceWarning: state.reason };
}
