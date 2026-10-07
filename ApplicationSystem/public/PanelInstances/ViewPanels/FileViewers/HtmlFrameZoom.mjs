// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/FileViewers/HtmlFrameZoom.mjs
// This module owns zoom registration across HTML-producing iframe loads. Same-origin documents reuse the HTML viewer's independent reflow and magnification, while inaccessible frames expose only explicit outer-frame geometric controls without intercepting their input.
import { installHtmlViewerZoom } from './HtmlViewerZoom.mjs';
import { installContentPresentationZoom } from '../../../panels/contentPresentationZoom.mjs';

export function installHtmlFrameZoom(owner, iframe) {
  let release = () => {}, disposed = false;
  const loaded = () => {
    if (disposed) return;
    release();
    let accessible = false;
    try { accessible = Boolean(iframe.contentDocument?.body); } catch { /* Cross-origin frame. */ }
    release = accessible ? installHtmlViewerZoom(owner, iframe) : installContentPresentationZoom(owner, iframe);
  };
  iframe.addEventListener('load', loaded);
  loaded();
  return () => {
    disposed = true; iframe.removeEventListener('load', loaded); release(); release = () => {};
  };
}
