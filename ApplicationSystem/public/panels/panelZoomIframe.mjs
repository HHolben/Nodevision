// Nodevision/ApplicationSystem/public/panels/panelZoomIframe.mjs
// This module bridges same-origin frame gestures once through the shared owner gate and converts frame coordinates into parent client coordinates.
import { routePanelZoomEvent } from './panelZoomPanParts/shortcuts.mjs';
export function installPanelZoomIframe(iframe, { onPointer = () => {} } = {}) {
  iframe.__nvZoomBridgeCleanup?.();
  let doc;
  try { doc = iframe.contentDocument; } catch { return () => {}; }
  if (!doc) return () => {};
  let pointer = null;
  const remember = event => {
    const rect = iframe.getBoundingClientRect();
    pointer = {
      clientX: rect.left + (event.clientX + iframe.clientLeft) * rect.width / (iframe.offsetWidth || rect.width),
      clientY: rect.top + (event.clientY + iframe.clientTop) * rect.height / (iframe.offsetHeight || rect.height)
    };
    onPointer(pointer);
  };
  const route = event => {
    if (event.type === 'wheel') remember(event);
    routePanelZoomEvent(event, { target: iframe, ...(pointer || {}) });
  };
  doc.addEventListener('pointermove', remember, { passive: true });
  doc.addEventListener('wheel', route, { capture: true, passive: false });
  doc.addEventListener('keydown', route, true);
  return iframe.__nvZoomBridgeCleanup = () => {
    doc.removeEventListener('wheel', route, true); doc.removeEventListener('keydown', route, true);
    doc.removeEventListener('pointermove', remember);
    iframe.__nvZoomBridgeCleanup = null;
  };
}
