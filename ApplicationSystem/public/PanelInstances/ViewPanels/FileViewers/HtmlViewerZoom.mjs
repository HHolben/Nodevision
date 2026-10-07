// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/FileViewers/HtmlViewerZoom.mjs
// This module registers independent reading reflow and direct geometric magnification for HTML viewers. Both modes keep the original page visible and leave Layers inspection as a separate user action.
import { installDocumentFrameZoom } from '../../../panels/documentFrameZoom.mjs';
export function installHtmlViewerZoom(owner, iframe) {
  if (!iframe.contentDocument?.body) return () => {};
  return installDocumentFrameZoom(owner, iframe);
}
