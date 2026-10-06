// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/CodeEditorZoom.mjs
// This module registers Monaco text sizing as geometric zoom and leaves source, selection, and surrounding controls unchanged.
import { registerPanelZoomCapabilities } from '/panels/panelZoomCapabilities.mjs';
export function installCodeEditorZoom(target, readSize, applySize) {
  target.__nvCodeEditorZoomHandlersInstalled?.dispose();
  target.setAttribute('data-nv-panel-zoom-scope', 'local');
  const release = registerPanelZoomCapabilities(target, {
    metadata: { geometric: { actions: ['zoom', 'set', 'reset'], unit: 'text pixels' } },
    semantic: false, fisheye: false,
    getState(mode) { const session = target.__nvCodeEditorSession;
      return mode === 'geometric' && session ? { fontSize: readSize(session.editor, session), unit: 'px' } : null; },
    geometric(command) {
      const session = target.__nvCodeEditorSession;
      if (!session?.editor) return false;
      const current = readSize(session.editor, session);
      const next = command.action === 'reset' ? session.defaultFontSize || 14
        : command.fontSize ?? current + (command.factor > 1 ? 1 : command.factor < 1 ? -1 : 0);
      return applySize(session.editor, next, session);
    }
  });
  target.__nvCodeEditorZoomHandlersInstalled = { dispose: release };
  return release;
}
