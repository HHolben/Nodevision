// Nodevision/ApplicationSystem/public/panels/panelZoomInput.mjs
// This module translates physical gestures into independent zoom intents with a configurable fallback for keyboards that do not expose Fn.
export const ZoomIntent = Object.freeze({ Geometric: 'geometric', Semantic: 'semantic', Fisheye: 'fisheye' });
let geometricFallback = 'Alt';
export function configurePanelZoomInput({ geometricModifier = 'Alt' } = {}) {
  if (!['Alt', 'None'].includes(geometricModifier)) throw new TypeError('Geometric modifier must be Alt or None');
  geometricFallback = geometricModifier;
}
export function getPanelZoomInputConfiguration() { return { preferredGeometricModifier: 'Fn', geometricModifier: geometricFallback }; }
export function panelZoomModeForEvent(event) {
  const typingPlus = event.type === 'keydown' && event.key === '+';
  if (event.shiftKey && !typingPlus) return ZoomIntent.Fisheye;
  if (event.getModifierState?.('Fn') || (geometricFallback === 'Alt' && event.altKey)) return ZoomIntent.Geometric;
  return ZoomIntent.Semantic;
}
export function panelZoomCommandForEvent(event, height = 800) {
  if (!(event.ctrlKey || event.metaKey)) return null;
  if (event.type === 'wheel') {
    const delta = Number(event.deltaY) * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? height : 1);
    if (!Number.isFinite(delta) || !delta) return null;
    return { action: 'zoom', factor: Math.exp(-Math.max(-600, Math.min(600, delta)) * .0015), delta,
      clientX: event.clientX, clientY: event.clientY };
  }
  const key = event.key, code = event.code;
  const action = ['+', '='].includes(key) || ['Equal', 'NumpadAdd', 'NumpadEqual'].includes(code) ? 'in'
    : ['-', '_'].includes(key) || ['Minus', 'NumpadSubtract'].includes(code) ? 'out'
    : key === '0' || ['Digit0', 'Numpad0'].includes(code) ? 'reset' : null;
  return action ? { action, factor: action === 'in' ? 1.1 : 1 / 1.1 } : null;
}
