// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditorComponents/HtmlLiveContent.mjs
// This module publishes an owning HTML editor's buffer to live viewers on authored input or committed edits without observing selection decorations or replacing another editor's provider.
import { registerLiveFileContentProvider, touchLiveFileContentProvider } from '/LiveFileContent.mjs';
import { incrementPerformanceCounter } from '/PerformanceDiagnostics.mjs';

let sequence = 0;
export function registerHtmlLiveContent(host, context) {
  host.__nvGraphicalLiveCleanup?.();
  const id = `html-editor-${++sequence}`;
  let timer = 0, disposed = false;
  const remove = registerLiveFileContentProvider({
    id, filePath: context.filePath, editorKind: 'html', panelKind: 'GraphicalEditor',
    sourceLabel: 'HTML Editor', mimeType: 'text/html',
    dirty: () => context.isDirty, getContent: () => context.getHTML(),
  });
  const unsubscribe = context.transactions.subscribe(() => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      if (!disposed && host.isConnected) touchLiveFileContentProvider(id, { reason: 'authored-change' });
    }, 80);
  });
  incrementPerformanceCounter('GraphicalEditor.liveProviderRegistered');
  const cleanup = () => {
    if (disposed) return;
    disposed = true;
    clearTimeout(timer);
    unsubscribe();
    remove();
    incrementPerformanceCounter('GraphicalEditor.liveProviderRemoved');
    if (host.__nvGraphicalLiveCleanup === cleanup) host.__nvGraphicalLiveCleanup = null;
  };
  host.__nvGraphicalLiveCleanup = cleanup;
  return cleanup;
}
