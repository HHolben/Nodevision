// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/FileViewers/HtmlViewerZoom.mjs
// This module gives an HTML viewer independent page scale and read-only Outline/Page presentation through the shared zoom capability owner. It reuses the HTML Layers renderer outside the authored iframe and keeps document selection, source, and page state intact across semantic transitions.
import { createHtmlLayersContext } from '../../Common/Layers/htmlLayersContext.mjs';
import { installContentPresentationZoom } from '../../../panels/contentPresentationZoom.mjs';
import { installPanelZoomIframe } from '../../../panels/panelZoomIframe.mjs';
import { executePanelZoom } from '../../../panels/panelZoomCapabilities.mjs';

export function installHtmlViewerZoom(owner, iframe) {
  const doc = iframe.contentDocument;
  if (!doc?.body) return () => {};
  let level = 'page', detachOutline = null, disposed = false;
  const previousDisplay = iframe.style.display;
  const outline = document.createElement('section');
  outline.dataset.nvHtmlOutline = 'true';
  outline.setAttribute('aria-label', 'HTML document outline');
  outline.hidden = true;
  outline.style.cssText = 'height:100%;overflow:auto;box-sizing:border-box;padding:8px;';
  const heading = document.createElement('h2');
  heading.textContent = 'Document outline';
  const hint = document.createElement('p');
  hint.textContent = 'Read-only regions and elements. Choose an entry to reveal it on the page.';
  const back = document.createElement('button');
  back.type = 'button'; back.textContent = 'Show page';
  back.onclick = () => executePanelZoom(owner, 'semantic', { action: 'set', level: 'page' });
  const list = document.createElement('div');
  list.style.cssText = 'height:calc(100% - 130px);min-height:80px;overflow:auto;';
  outline.append(heading, hint, back, list);
  owner.append(outline);
  const context = createHtmlLayersContext(doc.body, { readOnly: true, onReveal() {
    executePanelZoom(owner, 'semantic', { action: 'set', level: 'page' });
  } });
  const unregister = installContentPresentationZoom(owner, iframe, {
    semanticMetadata: { actions: ['zoom', 'step', 'set', 'reset'], levels: [
      { value: 'outline', label: 'Outline' }, { value: 'page', label: 'Page' }
    ] },
    semanticState: () => ({ level }),
    semantic(command) {
      let next;
      if (command.action === 'reset') next = 'page';
      else if (command.action === 'set') next = command.level;
      else {
        const direction = command.direction ?? (command.action === 'in' ? 1 : command.action === 'out' ? -1 : Math.sign((command.factor ?? 1) - 1));
        next = direction > 0 ? 'page' : direction < 0 ? 'outline' : level;
      }
      if (!['outline', 'page'].includes(next)) return false;
      if (next === level) return true;
      const moveFocus = next === 'outline' ? document.activeElement === iframe : outline.contains(document.activeElement);
      level = next;
      // Keep the original frame/document alive; no clone, navigation, or authored style change.
      iframe.style.display = level === 'outline' ? 'none' : previousDisplay;
      outline.hidden = level !== 'outline';
      if (level === 'outline' && !detachOutline) detachOutline = context.attachHost(list);
      if (moveFocus) (level === 'outline' ? back : iframe).focus({ preventScroll: true });
      return true;
    }
  });
  const unbridge = installPanelZoomIframe(iframe);
  return () => {
    if (disposed) return;
    disposed = true;
    unregister(); unbridge(); detachOutline?.(); outline.remove();
    iframe.style.display = previousDisplay;
  };
}
